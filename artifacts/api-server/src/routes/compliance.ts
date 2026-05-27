import { Router, type IRouter } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  db,
  certificatesTable,
  tenantsTable,
  verificationSubmissionsTable,
  verificationDocumentsTable,
  type Certificate,
} from "@workspace/db";
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

// ---- Verification badge routes --------------------------------------------

router.get("/v1/compliance/verification-status", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;

  const [tenant] = await db
    .select({ verifiedBadge: tenantsTable.verifiedBadge, badgeAwardedAt: tenantsTable.badgeAwardedAt })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId));

  const [latestSub] = await db
    .select()
    .from(verificationSubmissionsTable)
    .where(eq(verificationSubmissionsTable.tenantId, tenantId))
    .orderBy(desc(verificationSubmissionsTable.createdAt))
    .limit(1);

  let badgeStatus: "not_applied" | "under_review" | "verified" | "rejected" = "not_applied";
  if (tenant?.verifiedBadge) {
    badgeStatus = "verified";
  } else if (latestSub?.status === "pending") {
    badgeStatus = "under_review";
  } else if (latestSub?.status === "rejected") {
    badgeStatus = "rejected";
  }

  let documents: Array<{
    certificateId: string;
    kind: string;
    reference: string | null;
    documentUrl: string | null;
    expiresAt: string | null;
  }> = [];

  if (latestSub) {
    const docs = await db
      .select({
        certificateId: verificationDocumentsTable.certificateId,
        kind: certificatesTable.kind,
        reference: certificatesTable.reference,
        documentUrl: certificatesTable.documentUrl,
        expiresAt: certificatesTable.expiresAt,
      })
      .from(verificationDocumentsTable)
      .innerJoin(certificatesTable, eq(certificatesTable.id, verificationDocumentsTable.certificateId))
      .where(eq(verificationDocumentsTable.submissionId, latestSub.id));

    documents = docs.map((d) => ({
      certificateId: d.certificateId,
      kind: d.kind,
      reference: d.reference ?? null,
      documentUrl: d.documentUrl ?? null,
      expiresAt: d.expiresAt?.toISOString() ?? null,
    }));
  }

  res.json({
    badgeStatus,
    verifiedBadge: tenant?.verifiedBadge ?? false,
    badgeAwardedAt: tenant?.badgeAwardedAt?.toISOString() ?? null,
    latestSubmission: latestSub
      ? {
          id: latestSub.id,
          status: latestSub.status,
          submittedAt: latestSub.submittedAt.toISOString(),
          reviewedAt: latestSub.reviewedAt?.toISOString() ?? null,
          rejectionReason: latestSub.rejectionReason ?? null,
        }
      : null,
    documents,
  });
});

router.post("/v1/compliance/request-verification", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;

  const [existingPending] = await db
    .select({ id: verificationSubmissionsTable.id })
    .from(verificationSubmissionsTable)
    .where(and(eq(verificationSubmissionsTable.tenantId, tenantId), eq(verificationSubmissionsTable.status, "pending")));

  if (existingPending) {
    res.status(409).json({ error: "A verification submission is already under review" });
    return;
  }

  const certs = await db
    .select()
    .from(certificatesTable)
    .where(eq(certificatesTable.tenantId, tenantId))
    .orderBy(asc(certificatesTable.expiresAt));

  if (certs.length === 0) {
    res.status(400).json({ error: "Please add at least one certificate before requesting verification" });
    return;
  }

  const [sub] = await db
    .insert(verificationSubmissionsTable)
    .values({ tenantId })
    .returning();

  if (certs.length > 0) {
    await db.insert(verificationDocumentsTable).values(
      certs.map((c) => ({ submissionId: sub.id, certificateId: c.id })),
    );
  }

  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "compliance.verification_requested",
    message: `Verification badge requested (${certs.length} document(s) submitted).`,
    metadata: { documentCount: certs.length },
  });

  res.status(201).json({
    id: sub.id,
    status: sub.status,
    submittedAt: sub.submittedAt.toISOString(),
    documentCount: certs.length,
  });
});

export default router;
