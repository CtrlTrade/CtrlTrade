import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  branchesTable,
  posLicencesTable,
  posTerminalsTable,
} from "@workspace/db";
import {
  RequestExtraTillBody,
  UpdatePosLicenceBranchBody,
  RegisterPosTerminalBody,
  UpdatePosTerminalBody,
  ValidatePosLicenceBody,
} from "@workspace/api-zod";
import { requireRole, requireTenant } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import {
  generateLicenceKey,
  loadLicenceList,
  nextTerminalCode,
  serializeLicence,
  serializeTerminal,
  validateLicenceForOpen,
} from "../lib/posLicence";
import { broadcastLicenceChange } from "../lib/posLiveChannel";

/** Resolve a licence key by id (tenant-scoped) and push its new mode to live tills. */
async function broadcastLicenceById(tenantId: string, licenceId: string | null | undefined): Promise<void> {
  if (!licenceId) return;
  const [lic] = await db
    .select({ licenceKey: posLicencesTable.licenceKey })
    .from(posLicencesTable)
    .where(and(eq(posLicencesTable.tenantId, tenantId), eq(posLicencesTable.id, licenceId)));
  if (lic) await broadcastLicenceChange(lic.licenceKey);
}

const router: IRouter = Router();

async function branchNameFor(tenantId: string, branchId: string | null): Promise<string | null> {
  if (!branchId) return null;
  const [b] = await db
    .select()
    .from(branchesTable)
    .where(and(eq(branchesTable.tenantId, tenantId), eq(branchesTable.id, branchId)));
  return b?.name ?? null;
}

/** True when branchId is null/absent or belongs to the tenant. Guards against cross-tenant ID injection. */
async function ownsBranch(tenantId: string, branchId: string | null | undefined): Promise<boolean> {
  if (!branchId) return true;
  const [b] = await db
    .select({ id: branchesTable.id })
    .from(branchesTable)
    .where(and(eq(branchesTable.tenantId, tenantId), eq(branchesTable.id, branchId)));
  return !!b;
}

/** True when licenceId is null/absent or belongs to the tenant. Guards against cross-tenant ID injection. */
async function ownsLicence(tenantId: string, licenceId: string | null | undefined): Promise<boolean> {
  if (!licenceId) return true;
  const [l] = await db
    .select({ id: posLicencesTable.id })
    .from(posLicencesTable)
    .where(and(eq(posLicencesTable.tenantId, tenantId), eq(posLicencesTable.id, licenceId)));
  return !!l;
}

// GET /v1/pos-licences — list tenant's licences + terminals + billing
router.get("/v1/pos-licences", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  res.json(await loadLicenceList(tenantId));
});

// POST /v1/pos-licences/request — request an extra till (issues a trial licence)
router.post(
  "/v1/pos-licences/request",
  requireTenant,
  requireRole("owner", "admin"),
  async (req, res): Promise<void> => {
    const parsed = RequestExtraTillBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const tenantId = req.auth!.tenant!.id;
    if (!(await ownsBranch(tenantId, parsed.data.branchId))) {
      res.status(400).json({ error: "Branch not found for this business" });
      return;
    }
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const [row] = await db
      .insert(posLicencesTable)
      .values({
        tenantId,
        branchId: parsed.data.branchId ?? null,
        licenceKey: generateLicenceKey(),
        type: parsed.data.type,
        status: "trial",
        trialEndsAt,
      })
      .returning();
    await logAudit({
      tenantId,
      actorUserId: req.auth!.user.id,
      actorLabel: req.auth!.user.email,
      kind: "pos.licence.requested",
      message: `Extra till requested (${parsed.data.type}, 14-day trial)`,
    });
    res.status(201).json(serializeLicence(row, await branchNameFor(tenantId, row.branchId), []));
  },
);

// PATCH /v1/pos-licences/:licenceId — assign licence to a branch
router.patch(
  "/v1/pos-licences/:licenceId",
  requireTenant,
  requireRole("owner", "admin"),
  async (req, res): Promise<void> => {
    const parsed = UpdatePosLicenceBranchBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const tenantId = req.auth!.tenant!.id;
    const licenceId = req.params.licenceId as string;
    const [existing] = await db
      .select()
      .from(posLicencesTable)
      .where(and(eq(posLicencesTable.tenantId, tenantId), eq(posLicencesTable.id, licenceId)));
    if (!existing) {
      res.status(404).json({ error: "Licence not found" });
      return;
    }
    if (!(await ownsBranch(tenantId, parsed.data.branchId))) {
      res.status(400).json({ error: "Branch not found for this business" });
      return;
    }
    const [updated] = await db
      .update(posLicencesTable)
      .set({ branchId: parsed.data.branchId ?? null })
      .where(eq(posLicencesTable.id, licenceId))
      .returning();
    await logAudit({
      tenantId,
      actorUserId: req.auth!.user.id,
      actorLabel: req.auth!.user.email,
      kind: "pos.licence.rebranched",
      message: `Till licence ${updated.licenceKey} assigned to branch`,
    });
    await broadcastLicenceChange(updated.licenceKey);
    res.json(serializeLicence(updated, await branchNameFor(tenantId, updated.branchId), []));
  },
);

// POST /v1/pos-terminals — register / create a terminal
router.post(
  "/v1/pos-terminals",
  requireTenant,
  requireRole("owner", "admin"),
  async (req, res): Promise<void> => {
    const parsed = RegisterPosTerminalBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const tenantId = req.auth!.tenant!.id;

    // Resolve the licence either by key (self-registration) or id (admin pick).
    let licenceId: string | null = parsed.data.licenceId ?? null;
    if (!licenceId && parsed.data.licenceKey) {
      const [lic] = await db
        .select()
        .from(posLicencesTable)
        .where(and(eq(posLicencesTable.tenantId, tenantId), eq(posLicencesTable.licenceKey, parsed.data.licenceKey)));
      if (!lic) {
        res.status(400).json({ error: "Licence key not recognised for this business" });
        return;
      }
      licenceId = lic.id;
    } else if (licenceId && !(await ownsLicence(tenantId, licenceId))) {
      res.status(400).json({ error: "Licence not found for this business" });
      return;
    }
    if (!licenceId) {
      res.status(400).json({ error: "A licence key or licence is required to register a terminal" });
      return;
    }
    if (!(await ownsBranch(tenantId, parsed.data.branchId))) {
      res.status(400).json({ error: "Branch not found for this business" });
      return;
    }

    // Enforce 1:1 licence↔terminal — a licence may only have one ACTIVE
    // terminal at a time. This guards per-till billing (£59.99/till) and
    // prevents licence sharing across multiple physical tills.
    const [existingActive] = await db
      .select({ id: posTerminalsTable.id, code: posTerminalsTable.terminalCode })
      .from(posTerminalsTable)
      .where(
        and(
          eq(posTerminalsTable.licenceId, licenceId),
          eq(posTerminalsTable.status, "active"),
        ),
      );
    if (existingActive) {
      res.status(409).json({
        error: `This licence already has an active terminal (${existingActive.code}). Deactivate it first, or use a different licence.`,
      });
      return;
    }

    const code = await nextTerminalCode(tenantId);
    const now = new Date();
    const [row] = await db
      .insert(posTerminalsTable)
      .values({
        tenantId,
        branchId: parsed.data.branchId ?? null,
        licenceId,
        terminalCode: code,
        name: parsed.data.name,
        mode: parsed.data.mode ?? "trade_counter",
        status: "active",
        registeredAt: now,
        lastSeenAt: now,
      })
      .returning();
    await logAudit({
      tenantId,
      actorUserId: req.auth!.user.id,
      actorLabel: req.auth!.user.email,
      kind: "pos.terminal.registered",
      message: `Terminal ${code} (${row.name}) registered`,
    });
    res.status(201).json(serializeTerminal(row, await branchNameFor(tenantId, row.branchId)));
  },
);

// PATCH /v1/pos-terminals/:terminalId — rename / re-branch / mode / deactivate
router.patch(
  "/v1/pos-terminals/:terminalId",
  requireTenant,
  requireRole("owner", "admin"),
  async (req, res): Promise<void> => {
    const parsed = UpdatePosTerminalBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const tenantId = req.auth!.tenant!.id;
    const terminalId = req.params.terminalId as string;
    const [existing] = await db
      .select()
      .from(posTerminalsTable)
      .where(and(eq(posTerminalsTable.tenantId, tenantId), eq(posTerminalsTable.id, terminalId)));
    if (!existing) {
      res.status(404).json({ error: "Terminal not found" });
      return;
    }
    if (parsed.data.branchId !== undefined && !(await ownsBranch(tenantId, parsed.data.branchId))) {
      res.status(400).json({ error: "Branch not found for this business" });
      return;
    }
    if (parsed.data.licenceId !== undefined && !(await ownsLicence(tenantId, parsed.data.licenceId))) {
      res.status(400).json({ error: "Licence not found for this business" });
      return;
    }

    // When rebinding to a different licence, ensure the target licence does
    // not already have another active terminal (1:1 per-till billing invariant).
    const newLicenceId = parsed.data.licenceId;
    const isRebinding = newLicenceId !== undefined && newLicenceId !== existing.licenceId;
    const isActivating =
      parsed.data.status === "active" && existing.status !== "active" && existing.licenceId;
    const licenceToCheck = isRebinding ? newLicenceId : isActivating ? existing.licenceId : null;
    if (licenceToCheck) {
      const [conflict] = await db
        .select({ id: posTerminalsTable.id, code: posTerminalsTable.terminalCode })
        .from(posTerminalsTable)
        .where(
          and(
            eq(posTerminalsTable.licenceId, licenceToCheck),
            eq(posTerminalsTable.status, "active"),
          ),
        );
      // Allow the terminal to keep its own active slot (not a conflict with itself)
      if (conflict && conflict.id !== terminalId) {
        res.status(409).json({
          error: `Licence already has an active terminal (${conflict.code}). Deactivate it first.`,
        });
        return;
      }
    }

    const patch: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.branchId !== undefined) patch.branchId = parsed.data.branchId;
    if (parsed.data.mode !== undefined) patch.mode = parsed.data.mode;
    if (parsed.data.status !== undefined) patch.status = parsed.data.status;
    if (parsed.data.licenceId !== undefined) patch.licenceId = parsed.data.licenceId;

    const [updated] = await db
      .update(posTerminalsTable)
      .set(patch)
      .where(eq(posTerminalsTable.id, terminalId))
      .returning();
    await logAudit({
      tenantId,
      actorUserId: req.auth!.user.id,
      actorLabel: req.auth!.user.email,
      kind: "pos.terminal.updated",
      message: `Terminal ${updated.terminalCode} updated`,
    });
    // Push to tills on both the previous and current licence (a rebind changes
    // the binding on both sides; a status/mode change affects the current one).
    await broadcastLicenceById(tenantId, existing.licenceId);
    if (updated.licenceId && updated.licenceId !== existing.licenceId) {
      await broadcastLicenceById(tenantId, updated.licenceId);
    }
    res.json(serializeTerminal(updated, await branchNameFor(tenantId, updated.branchId)));
  },
);

// POST /v1/pos-terminals/validate — validate a licence on till open (web)
router.post("/v1/pos-terminals/validate", requireTenant, async (req, res): Promise<void> => {
  const parsed = ValidatePosLicenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const outcome = await validateLicenceForOpen({
    tenantId,
    licenceKey: parsed.data.licenceKey,
    terminalCode: parsed.data.terminalCode ?? null,
    surface: parsed.data.surface ?? "web",
  });
  res.json(outcome);
});

export default router;
