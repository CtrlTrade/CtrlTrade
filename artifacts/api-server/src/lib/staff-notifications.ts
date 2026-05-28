import { db, staffNotificationsTable } from "@workspace/db";
import { logger } from "./logger";

export type StaffNotificationKind =
  | "quote_accepted"
  | "quote_declined"
  | "invoice_paid"
  | "customer_message"
  | "review_submitted";

export async function createStaffNotification(opts: {
  tenantId: string;
  kind: StaffNotificationKind;
  title: string;
  message: string;
  linkPath: string;
}): Promise<void> {
  try {
    await db.insert(staffNotificationsTable).values({
      tenantId: opts.tenantId,
      kind: opts.kind,
      title: opts.title,
      message: opts.message,
      linkPath: opts.linkPath,
    });
  } catch (err) {
    logger.warn({ err, tenantId: opts.tenantId, kind: opts.kind }, "Failed to create staff notification");
  }
}
