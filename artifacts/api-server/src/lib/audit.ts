import { db, auditLogsTable } from "@workspace/db";

export async function logAudit(opts: {
  tenantId?: string | null;
  actorUserId?: string | null;
  actorLabel?: string | null;
  kind: string;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(auditLogsTable).values({
    tenantId: opts.tenantId ?? null,
    actorUserId: opts.actorUserId ?? null,
    actorLabel: opts.actorLabel ?? null,
    kind: opts.kind,
    message: opts.message,
    metadata: opts.metadata ?? null,
  });
}
