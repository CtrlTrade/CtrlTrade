import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  automationRulesTable,
  automationRunsTable,
  approvalRequestsTable,
} from "@workspace/db";
import { requireTenant } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { WORKFLOW_EVENTS } from "../lib/automationEngine";

const router: IRouter = Router();

// ---- Trigger events list -----------------------------------------------------

router.get("/v1/automation/events", requireTenant, (_req, res) => {
  res.json({ events: WORKFLOW_EVENTS });
});

// ---- Rules -------------------------------------------------------------------

router.get("/v1/automation/rules", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenant!.id;
  const rules = await db
    .select()
    .from(automationRulesTable)
    .where(eq(automationRulesTable.tenantId, tenantId))
    .orderBy(desc(automationRulesTable.createdAt));
  res.json({ rules: rules.map(serializeRule) });
});

router.post("/v1/automation/rules", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenant!.id;
  const { name, description, triggerEvent, conditions, actions, enabled } = req.body ?? {};
  if (!name || !triggerEvent) {
    res.status(400).json({ error: "name and triggerEvent required" });
    return;
  }
  const [rule] = await db
    .insert(automationRulesTable)
    .values({
      tenantId,
      name: String(name),
      description: description ? String(description) : null,
      triggerEvent: String(triggerEvent),
      conditions: conditions ?? [],
      actions: actions ?? [],
      enabled: enabled !== false,
    })
    .returning();
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user!.id,
    actorLabel: req.auth!.user!.email,
    kind: "automation_rule.created",
    message: `Automation rule "${rule!.name}" created`,
    metadata: { ruleId: rule!.id },
  });
  req.log.info({ ruleId: rule!.id }, "automation rule created");
  res.status(201).json({ rule: serializeRule(rule!) });
});

router.get("/v1/automation/rules/:id", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenant!.id;
  const [rule] = await db
    .select()
    .from(automationRulesTable)
    .where(and(eq(automationRulesTable.id, req.params.id as string), eq(automationRulesTable.tenantId, tenantId)));
  if (!rule) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ rule: serializeRule(rule) });
});

router.patch("/v1/automation/rules/:id", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenant!.id;
  const { name, description, triggerEvent, conditions, actions, enabled } = req.body ?? {};
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) patch.name = String(name);
  if (description !== undefined) patch.description = String(description);
  if (triggerEvent !== undefined) patch.triggerEvent = String(triggerEvent);
  if (conditions !== undefined) patch.conditions = conditions;
  if (actions !== undefined) patch.actions = actions;
  if (enabled !== undefined) patch.enabled = Boolean(enabled);
  const [rule] = await db
    .update(automationRulesTable)
    .set(patch as any)
    .where(and(eq(automationRulesTable.id, req.params.id as string), eq(automationRulesTable.tenantId, tenantId)))
    .returning();
  if (!rule) { res.status(404).json({ error: "Not found" }); return; }
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user!.id,
    actorLabel: req.auth!.user!.email,
    kind: "automation_rule.updated",
    message: `Automation rule "${rule.name}" updated`,
    metadata: { ruleId: rule.id },
  });
  res.json({ rule: serializeRule(rule) });
});

router.delete("/v1/automation/rules/:id", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenant!.id;
  const [rule] = await db
    .delete(automationRulesTable)
    .where(and(eq(automationRulesTable.id, req.params.id as string), eq(automationRulesTable.tenantId, tenantId)))
    .returning({ id: automationRulesTable.id });
  if (!rule) { res.status(404).json({ error: "Not found" }); return; }
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user!.id,
    actorLabel: req.auth!.user!.email,
    kind: "automation_rule.deleted",
    message: `Automation rule deleted`,
    metadata: { ruleId: rule.id },
  });
  res.json({ ok: true });
});

// ---- Runs --------------------------------------------------------------------

router.get("/v1/automation/runs", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenant!.id;
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? 50), 10)));
  const runs = await db
    .select()
    .from(automationRunsTable)
    .where(eq(automationRunsTable.tenantId, tenantId))
    .orderBy(desc(automationRunsTable.startedAt))
    .limit(limit);
  res.json({ runs: runs.map(serializeRun) });
});

// ---- Approvals ---------------------------------------------------------------

router.get("/v1/automation/approvals", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenant!.id;
  const statusFilter = req.query.status ? String(req.query.status) : "pending";
  const approvals = await db
    .select()
    .from(approvalRequestsTable)
    .where(
      and(
        eq(approvalRequestsTable.tenantId, tenantId),
        eq(approvalRequestsTable.status, statusFilter),
      ),
    )
    .orderBy(desc(approvalRequestsTable.createdAt))
    .limit(50);
  res.json({ approvals: approvals.map(serializeApproval) });
});

router.get("/v1/automation/approvals/count", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenant!.id;
  const rows = await db
    .select()
    .from(approvalRequestsTable)
    .where(and(eq(approvalRequestsTable.tenantId, tenantId), eq(approvalRequestsTable.status, "pending")));
  res.json({ count: rows.length });
});

router.post("/v1/automation/approvals/:id/decide", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenant!.id;
  const { decision } = req.body ?? {};
  if (!["approved", "rejected"].includes(decision)) {
    res.status(400).json({ error: "decision must be approved or rejected" });
    return;
  }
  const [approval] = await db
    .update(approvalRequestsTable)
    .set({
      status: decision,
      decidedBy: req.auth!.user!.id,
      decidedAt: new Date(),
    })
    .where(
      and(
        eq(approvalRequestsTable.id, req.params.id as string),
        eq(approvalRequestsTable.tenantId, tenantId),
        eq(approvalRequestsTable.status, "pending"),
      ),
    )
    .returning();
  if (!approval) { res.status(404).json({ error: "Not found or already decided" }); return; }
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user!.id,
    actorLabel: req.auth!.user!.email,
    kind: "approval_request.decided",
    message: `Approval request ${decision}`,
    metadata: { approvalId: approval.id, decision },
  });
  res.json({ approval: serializeApproval(approval) });
});

// ---- Serializers -------------------------------------------------------------

function serializeRule(r: typeof automationRulesTable.$inferSelect) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    enabled: r.enabled,
    triggerEvent: r.triggerEvent,
    conditions: r.conditions,
    actions: r.actions,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function serializeRun(r: typeof automationRunsTable.$inferSelect) {
  return {
    id: r.id,
    ruleId: r.ruleId,
    ruleName: r.ruleName,
    triggerEvent: r.triggerEvent,
    status: r.status,
    actionsRun: r.actionsRun,
    error: r.error,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
  };
}

function serializeApproval(a: typeof approvalRequestsTable.$inferSelect) {
  return {
    id: a.id,
    runId: a.runId,
    ruleId: a.ruleId,
    entityKind: a.entityKind,
    entityId: a.entityId,
    promptTitle: a.promptTitle,
    promptBody: a.promptBody,
    status: a.status,
    decidedBy: a.decidedBy,
    decidedAt: a.decidedAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

export default router;
