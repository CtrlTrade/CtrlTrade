import { eq, and } from "drizzle-orm";
import {
  db,
  automationRulesTable,
  automationRunsTable,
  approvalRequestsTable,
  type AutomationRule,
} from "@workspace/db";
import { logger } from "./logger";
import { dispatchNotification } from "./notifications";
import { enqueueJob } from "./queue";

export type WorkflowEvent =
  | "lead.created"
  | "lead.updated"
  | "lead.won"
  | "lead.lost"
  | "quote.created"
  | "quote.sent"
  | "quote.accepted"
  | "quote.declined"
  | "job.created"
  | "job.scheduled"
  | "job.started"
  | "job.completed"
  | "invoice.created"
  | "invoice.sent"
  | "invoice.paid"
  | "invoice.overdue"
  | "call.received"
  | "call.completed"
  | "voicemail.received";

export const WORKFLOW_EVENTS: { event: WorkflowEvent; label: string; category: string }[] = [
  { event: "lead.created", label: "Lead created", category: "Leads" },
  { event: "lead.updated", label: "Lead updated", category: "Leads" },
  { event: "lead.won", label: "Lead won", category: "Leads" },
  { event: "lead.lost", label: "Lead lost", category: "Leads" },
  { event: "quote.created", label: "Quote created", category: "Quotes" },
  { event: "quote.sent", label: "Quote sent", category: "Quotes" },
  { event: "quote.accepted", label: "Quote accepted", category: "Quotes" },
  { event: "quote.declined", label: "Quote declined", category: "Quotes" },
  { event: "job.created", label: "Job created", category: "Jobs" },
  { event: "job.scheduled", label: "Job scheduled", category: "Jobs" },
  { event: "job.started", label: "Job started", category: "Jobs" },
  { event: "job.completed", label: "Job completed", category: "Jobs" },
  { event: "invoice.created", label: "Invoice created", category: "Invoices" },
  { event: "invoice.sent", label: "Invoice sent", category: "Invoices" },
  { event: "invoice.paid", label: "Invoice paid", category: "Invoices" },
  { event: "invoice.overdue", label: "Invoice overdue", category: "Invoices" },
  { event: "call.received", label: "Call received", category: "Voice" },
  { event: "call.completed", label: "Call completed", category: "Voice" },
  { event: "voicemail.received", label: "Voicemail received", category: "Voice" },
];

export interface ConditionNode {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "gt" | "lt" | "is_empty" | "is_not_empty";
  value?: string | number;
}

export interface ActionNode {
  kind:
    | "send_notification"
    | "send_sms"
    | "send_email"
    | "create_approval"
    | "enqueue_job"
    | "add_tag"
    | "update_field";
  params: Record<string, unknown>;
}

function evaluateCondition(cond: ConditionNode, payload: Record<string, unknown>): boolean {
  const raw = payload[cond.field];
  const v = raw ?? null;
  switch (cond.operator) {
    case "equals":
      return String(v) === String(cond.value ?? "");
    case "not_equals":
      return String(v) !== String(cond.value ?? "");
    case "contains":
      return typeof v === "string" && v.toLowerCase().includes(String(cond.value ?? "").toLowerCase());
    case "gt":
      return Number(v) > Number(cond.value ?? 0);
    case "lt":
      return Number(v) < Number(cond.value ?? 0);
    case "is_empty":
      return v === null || v === undefined || v === "";
    case "is_not_empty":
      return v !== null && v !== undefined && v !== "";
    default:
      return true;
  }
}

function evaluateConditions(conditions: ConditionNode[], payload: Record<string, unknown>): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((c) => evaluateCondition(c, payload));
}

async function executeAction(
  action: ActionNode,
  tenantId: string,
  payload: Record<string, unknown>,
  runId: string,
): Promise<void> {
  switch (action.kind) {
    case "send_notification": {
      const eventKind = String(action.params.eventKind ?? "automation.triggered");
      const to = action.params.to as any;
      if (!to) return;
      await dispatchNotification({
        tenantId,
        eventKind,
        vars: { ...payload, ...(action.params.vars as any ?? {}) },
        to,
        channels: action.params.channels as any,
      }).catch((err: Error) => logger.warn({ err, runId }, "automation: send_notification failed"));
      break;
    }

    case "send_sms": {
      await enqueueJob({
        kind: "send_sms",
        payload: {
          tenantId,
          to: String(action.params.to ?? payload.phone ?? ""),
          text: String(action.params.text ?? ""),
        },
      }).catch((err: Error) => logger.warn({ err, runId }, "automation: send_sms enqueue failed"));
      break;
    }

    case "send_email": {
      await enqueueJob({
        kind: "send_email",
        payload: {
          tenantId,
          to: String(action.params.to ?? payload.email ?? ""),
          subject: String(action.params.subject ?? ""),
          text: String(action.params.text ?? ""),
        },
      }).catch((err: Error) => logger.warn({ err, runId }, "automation: send_email enqueue failed"));
      break;
    }

    case "create_approval": {
      await db.insert(approvalRequestsTable).values({
        tenantId,
        runId,
        promptTitle: String(action.params.title ?? "Approval required"),
        promptBody: String(action.params.body ?? ""),
        entityKind: action.params.entityKind as string | undefined,
        entityId: action.params.entityId as string | undefined,
      }).catch((err: Error) => logger.warn({ err, runId }, "automation: create_approval failed"));
      break;
    }

    case "enqueue_job": {
      const kind = action.params.kind as string;
      if (!kind) return;
      await enqueueJob({
        kind: kind as any,
        payload: { tenantId, ...((action.params.payload as any) ?? {}), ...payload },
      }).catch((err: Error) => logger.warn({ err, runId }, "automation: enqueue_job failed"));
      break;
    }

    default:
      logger.debug({ kind: action.kind, runId }, "automation: unknown action kind — skipped");
  }
}

export async function emitWorkflowEvent(
  tenantId: string,
  event: WorkflowEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  let rules: AutomationRule[];
  try {
    rules = await db
      .select()
      .from(automationRulesTable)
      .where(
        and(
          eq(automationRulesTable.tenantId, tenantId),
          eq(automationRulesTable.triggerEvent, event),
          eq(automationRulesTable.enabled, true),
        ),
      );
  } catch (err) {
    logger.warn({ err, tenantId, event }, "automationEngine: failed to load rules");
    return;
  }

  if (rules.length === 0) return;

  for (const rule of rules) {
    const conditions = (rule.conditions as ConditionNode[]) ?? [];
    const actions = (rule.actions as ActionNode[]) ?? [];

    if (!evaluateConditions(conditions, payload)) continue;

    const [run] = await db
      .insert(automationRunsTable)
      .values({
        tenantId,
        ruleId: rule.id,
        ruleName: rule.name,
        triggerEvent: event,
        triggerPayload: payload,
        status: "running",
      })
      .returning();

    if (!run) continue;

    let actionsRun = 0;
    let error: string | undefined;

    try {
      for (const action of actions) {
        await executeAction(action, tenantId, payload, run.id);
        actionsRun++;
      }
    } catch (err: any) {
      error = err?.message ?? String(err);
      logger.warn({ err, ruleId: rule.id, runId: run.id }, "automationEngine: action error");
    }

    await db
      .update(automationRunsTable)
      .set({
        status: error ? "failed" : "completed",
        actionsRun,
        error,
        finishedAt: new Date(),
      })
      .where(eq(automationRunsTable.id, run.id))
      .catch((err: Error) => logger.warn({ err, runId: run.id }, "automationEngine: run update failed"));
  }
}
