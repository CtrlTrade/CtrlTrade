import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  tenantsTable,
  usersTable,
  membershipsTable,
  certificatesTable,
  verificationSubmissionsTable,
  verificationDocumentsTable,
  type VerificationSubmission,
} from "@workspace/db";
import { requireSuperAdmin } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { dispatchNotification } from "../lib/notifications";

const router: IRouter = Router();

router.use(requireSuperAdmin);

function serializeSubmission(
  sub: VerificationSubmission,
  tenantName: string,
  tenantSlug: string,
  reviewerEmail?: string | null,
) {
  return {
    id: sub.id,
    tenantId: sub.tenantId,
    tenantName,
    tenantSlug,
    status: sub.status,
    submittedAt: sub.submittedAt.toISOString(),
    reviewedAt: sub.reviewedAt?.toISOString() ?? null,
    reviewerEmail: reviewerEmail ?? null,
    rejectionReason: sub.rejectionReason ?? null,
    createdAt: sub.createdAt.toISOString(),
  };
}

router.get("/v1/admin/compliance-queue", async (req, res): Promise<void> => {
  const statusFilter = (req.query.status as string | undefined) ?? "pending";
  const subs = await db
    .select()
    .from(verificationSubmissionsTable)
    .where(
      statusFilter !== "all"
        ? eq(verificationSubmissionsTable.status, statusFilter)
        : undefined,
    )
    .orderBy(desc(verificationSubmissionsTable.submittedAt));

  if (subs.length === 0) {
    res.json([]);
    return;
  }

  const tenantIds = [...new Set(subs.map((s) => s.tenantId))];
  const reviewerIds = [
    ...new Set(subs.map((s) => s.reviewedByUserId).filter(Boolean) as string[]),
  ];

  const tenants = await db
    .select({ id: tenantsTable.id, name: tenantsTable.name, slug: tenantsTable.slug })
    .from(tenantsTable)
    .where(inArray(tenantsTable.id, tenantIds));

  const reviewers =
    reviewerIds.length > 0
      ? await db
          .select({ id: usersTable.id, email: usersTable.email })
          .from(usersTable)
          .where(inArray(usersTable.id, reviewerIds))
      : [];

  const tenantMap = new Map(tenants.map((t) => [t.id, t]));
  const reviewerMap = new Map(reviewers.map((u) => [u.id, u.email]));

  const subIds = subs.map((s) => s.id);
  const docs =
    subIds.length > 0
      ? await db
          .select({
            submissionId: verificationDocumentsTable.submissionId,
            certificateId: verificationDocumentsTable.certificateId,
            certKind: certificatesTable.kind,
            certReference: certificatesTable.reference,
            certDocumentUrl: certificatesTable.documentUrl,
            certExpiresAt: certificatesTable.expiresAt,
          })
          .from(verificationDocumentsTable)
          .innerJoin(
            certificatesTable,
            eq(certificatesTable.id, verificationDocumentsTable.certificateId),
          )
          .where(inArray(verificationDocumentsTable.submissionId, subIds))
      : [];

  const docsBySubmission = new Map<string, typeof docs>();
  for (const d of docs) {
    if (!docsBySubmission.has(d.submissionId)) docsBySubmission.set(d.submissionId, []);
    docsBySubmission.get(d.submissionId)!.push(d);
  }

  const result = subs.map((sub) => {
    const tenant = tenantMap.get(sub.tenantId);
    return {
      ...serializeSubmission(
        sub,
        tenant?.name ?? sub.tenantId,
        tenant?.slug ?? "",
        reviewerMap.get(sub.reviewedByUserId ?? ""),
      ),
      documents: (docsBySubmission.get(sub.id) ?? []).map((d) => ({
        certificateId: d.certificateId,
        kind: d.certKind,
        reference: d.certReference ?? null,
        documentUrl: d.certDocumentUrl ?? null,
        expiresAt: d.certExpiresAt?.toISOString() ?? null,
      })),
    };
  });

  res.json(result);
});

router.post(
  "/v1/admin/compliance-queue/:submissionId/approve",
  async (req, res): Promise<void> => {
    const { submissionId } = req.params;
    const [sub] = await db
      .select()
      .from(verificationSubmissionsTable)
      .where(eq(verificationSubmissionsTable.id, submissionId));
    if (!sub) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }
    if (sub.status !== "pending") {
      res.status(409).json({ error: "Submission is not pending" });
      return;
    }

    const now = new Date();

    await db
      .update(verificationSubmissionsTable)
      .set({
        status: "approved",
        reviewedAt: now,
        reviewedByUserId: req.auth!.user.id,
      })
      .where(eq(verificationSubmissionsTable.id, submissionId));

    await db
      .update(tenantsTable)
      .set({ verifiedBadge: true, badgeAwardedAt: now })
      .where(eq(tenantsTable.id, sub.tenantId));

    await logAudit({
      tenantId: sub.tenantId,
      actorUserId: req.auth!.user.id,
      actorLabel: `superadmin:${req.auth!.user.email}`,
      kind: "compliance.verification_approved",
      message: "CtrlTrade Verified badge awarded by super admin.",
    });

    await notifyTenant(sub.tenantId, "approved", null);

    res.json({ id: submissionId, status: "approved" });
  },
);

router.post(
  "/v1/admin/compliance-queue/:submissionId/reject",
  async (req, res): Promise<void> => {
    const { submissionId } = req.params;
    const reason = String(req.body?.reason ?? "").trim();
    if (!reason) {
      res.status(400).json({ error: "A rejection reason is required" });
      return;
    }

    const [sub] = await db
      .select()
      .from(verificationSubmissionsTable)
      .where(eq(verificationSubmissionsTable.id, submissionId));
    if (!sub) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }
    if (sub.status !== "pending") {
      res.status(409).json({ error: "Submission is not pending" });
      return;
    }

    await db
      .update(verificationSubmissionsTable)
      .set({
        status: "rejected",
        reviewedAt: new Date(),
        reviewedByUserId: req.auth!.user.id,
        rejectionReason: reason,
      })
      .where(eq(verificationSubmissionsTable.id, submissionId));

    await logAudit({
      tenantId: sub.tenantId,
      actorUserId: req.auth!.user.id,
      actorLabel: `superadmin:${req.auth!.user.email}`,
      kind: "compliance.verification_rejected",
      message: `CtrlTrade Verified application rejected. Reason: ${reason}`,
      metadata: { reason },
    });

    await notifyTenant(sub.tenantId, "rejected", reason);

    res.json({ id: submissionId, status: "rejected" });
  },
);

async function notifyTenant(
  tenantId: string,
  outcome: "approved" | "rejected",
  reason: string | null,
): Promise<void> {
  const recipients = await db
    .select({ userId: usersTable.id, email: usersTable.email, name: usersTable.name })
    .from(membershipsTable)
    .innerJoin(usersTable, eq(usersTable.id, membershipsTable.userId))
    .where(
      and(
        eq(membershipsTable.tenantId, tenantId),
        inArray(membershipsTable.role, ["owner", "admin"]),
      ),
    );

  for (const r of recipients) {
    await dispatchNotification({
      tenantId,
      eventKind: outcome === "approved" ? "compliance.verification_approved" : "compliance.verification_rejected",
      vars: { reason: reason ?? "" },
      to: { email: r.email, name: r.name },
      subject:
        outcome === "approved"
          ? "You are now CtrlTrade Verified!"
          : "CtrlTrade verification application update",
      text:
        outcome === "approved"
          ? "Congratulations! Your CtrlTrade Verified badge has been awarded. It will now appear on your customer portal."
          : `Your CtrlTrade verification application was not approved.\n\nReason: ${reason}`,
      html: undefined,
      recipientUserIds: [r.userId],
      metadata: { outcome, reason },
    });
  }
}

export default router;
