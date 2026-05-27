import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, certificatesTable, type Certificate } from "@workspace/db";
import {
  ListCertificatesResponse,
  CreateCertificateBody,
  UpdateCertificateBody,
  UpdateCertificateResponse,
} from "@workspace/api-zod";
import { requireTenant } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { isTenantMember } from "../lib/tenantGuards";

const router: IRouter = Router();

function serializeCertificate(c: Certificate) {
  return {
    id: c.id,
    holderUserId: c.holderUserId,
    holderLabel: c.holderLabel,
    kind: c.kind,
    reference: c.reference,
    issuedAt: c.issuedAt?.toISOString() ?? null,
    expiresAt: c.expiresAt?.toISOString() ?? null,
    documentUrl: c.documentUrl,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/v1/compliance/certificates", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const rows = await db
    .select()
    .from(certificatesTable)
    .where(eq(certificatesTable.tenantId, tenantId))
    .orderBy(asc(certificatesTable.expiresAt));
  res.json(ListCertificatesResponse.parse(rows.map(serializeCertificate)));
});

router.post("/v1/compliance/certificates", requireTenant, async (req, res): Promise<void> => {
  const parsed = CreateCertificateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  if (parsed.data.holderUserId && !(await isTenantMember(tenantId, parsed.data.holderUserId))) {
    res.status(400).json({ error: "Holder is not a member of this tenant" });
    return;
  }
  const [c] = await db
    .insert(certificatesTable)
    .values({
      tenantId,
      holderUserId: parsed.data.holderUserId ?? null,
      holderLabel: parsed.data.holderLabel ?? null,
      kind: parsed.data.kind,
      reference: parsed.data.reference ?? null,
      issuedAt: parsed.data.issuedAt ?? null,
      expiresAt: parsed.data.expiresAt ?? null,
      documentUrl: parsed.data.documentUrl ?? null,
      notes: parsed.data.notes ?? null,
    })
    .returning();
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "certificate.created",
    message: `Certificate added: ${c.kind}`,
  });
  res.status(201).json(UpdateCertificateResponse.parse(serializeCertificate(c)));
});

router.patch("/v1/compliance/certificates/:certificateId", requireTenant, async (req, res): Promise<void> => {
  const parsed = UpdateCertificateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  if (parsed.data.holderUserId && !(await isTenantMember(tenantId, parsed.data.holderUserId))) {
    res.status(400).json({ error: "Holder is not a member of this tenant" });
    return;
  }
  const updates: Record<string, unknown> = {};
  for (const k of ["holderUserId", "holderLabel", "kind", "reference", "issuedAt", "expiresAt", "documentUrl", "notes"] as const) {
    if (parsed.data[k] !== undefined) updates[k] = parsed.data[k];
  }
  const [c] = await db
    .update(certificatesTable)
    .set(updates)
    .where(and(eq(certificatesTable.tenantId, tenantId), eq(certificatesTable.id, (req.params.certificateId as string))))
    .returning();
  if (!c) {
    res.status(404).json({ error: "Certificate not found" });
    return;
  }
  res.json(UpdateCertificateResponse.parse(serializeCertificate(c)));
});

router.delete("/v1/compliance/certificates/:certificateId", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const result = await db
    .delete(certificatesTable)
    .where(and(eq(certificatesTable.tenantId, tenantId), eq(certificatesTable.id, (req.params.certificateId as string))))
    .returning({ id: certificatesTable.id });
  if (result.length === 0) {
    res.status(404).json({ error: "Certificate not found" });
    return;
  }
  res.status(204).send();
});

export default router;
