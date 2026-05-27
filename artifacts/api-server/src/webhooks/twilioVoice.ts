import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  tenantsTable,
  tenantPhoneNumbersTable,
  callRecordsTable,
  voicemailsTable,
  customersTable,
} from "@workspace/db";
import { logger } from "../lib/logger";
import { verifyTwilioSignature } from "../lib/twilio";
import { transcribeAudio, generateReceptionistResponseWithAI, isAIAvailable } from "../lib/ai";
import { recordUsage } from "../lib/usage";
import { emitWorkflowEvent } from "../lib/automationEngine";
import { findCustomerByContact } from "../lib/notifications";

async function resolveTenantForVoice(toNumber: string): Promise<string | null> {
  const norm = toNumber.trim();
  if (norm) {
    const [match] = await db
      .select({ tenantId: tenantPhoneNumbersTable.tenantId })
      .from(tenantPhoneNumbersTable)
      .where(eq(tenantPhoneNumbersTable.phoneNumber, norm))
      .limit(1);
    if (match) return match.tenantId;
    const [tenantMatch] = await db
      .select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.phone, norm))
      .limit(1);
    if (tenantMatch) return tenantMatch.id;
  }
  if (process.env.NODE_ENV !== "production") {
    const [fallback] = await db.select({ id: tenantsTable.id }).from(tenantsTable).limit(1);
    return fallback?.id ?? null;
  }
  return null;
}

/**
 * Handle inbound Twilio Voice webhook — returns TwiML to answer the call.
 * With recording enabled, Twilio will POST to /webhooks/twilio/recording when done.
 */
export async function handleTwilioVoice(req: Request, res: Response): Promise<void> {
  const params = (req.body ?? {}) as Record<string, string>;
  const proto = req.headers["x-forwarded-proto"] ?? req.protocol;
  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  const fullUrl = `${proto}://${host}${req.originalUrl}`;

  if (!verifyTwilioSignature(fullUrl, params, req.headers["x-twilio-signature"] as string | undefined)) {
    logger.warn({ url: fullUrl }, "Twilio voice signature failed");
    res.status(403).type("text/xml").send("<Response/>");
    return;
  }

  const callSid = String(params["CallSid"] ?? "");
  const from = String(params["From"] ?? "");
  const to = String(params["To"] ?? "");
  const callStatus = String(params["CallStatus"] ?? "");

  const tenantId = await resolveTenantForVoice(to);
  if (!tenantId) {
    logger.warn({ to }, "Twilio voice — no tenant matched");
    res.status(200).type("text/xml").send("<Response><Hangup/></Response>");
    return;
  }

  const customer = await findCustomerByContact(tenantId, { phone: from }).catch(() => null);

  // Upsert the call record
  const [existing] = await db
    .select()
    .from(callRecordsTable)
    .where(eq(callRecordsTable.twilioCallSid, callSid));

  if (!existing) {
    await db.insert(callRecordsTable).values({
      tenantId,
      twilioCallSid: callSid,
      direction: "inbound",
      fromNumber: from,
      toNumber: to,
      customerId: customer?.id ?? null,
      status: callStatus || "in-progress",
      startedAt: new Date(),
    }).catch((err: Error) => logger.warn({ err }, "voice: call record insert failed"));
  } else {
    await db.update(callRecordsTable)
      .set({ status: callStatus || existing.status, customerId: existing.customerId ?? (customer?.id ?? null) })
      .where(eq(callRecordsTable.twilioCallSid, callSid))
      .catch(() => {});
  }

  await emitWorkflowEvent(tenantId, "call.received", { callSid, from, to, customerId: customer?.id ?? null })
    .catch(() => {});

  await recordUsage(tenantId, "voice_minute", 1, { callSid, direction: "inbound" }).catch(() => {});

  const [tenant] = await db.select({ name: tenantsTable.name }).from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  const tenantName = tenant?.name ?? "us";
  const baseDomain = process.env.REPLIT_DOMAINS?.split(",")[0];
  const recordingCb = baseDomain ? `https://${baseDomain}/api/webhooks/twilio/recording` : "";

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record maxLength="30" timeout="5" action="${recordingCb}" method="POST" playBeep="true" recordingStatusCallback="${recordingCb}" recordingStatusCallbackMethod="POST"/>
  <Say voice="Polly.Amy">Thank you for calling ${tenantName}. Please leave a message after the beep and we will call you back shortly.</Say>
  <Record maxLength="60" timeout="10" action="${recordingCb}" method="POST" playBeep="true" recordingStatusCallback="${recordingCb}" recordingStatusCallbackMethod="POST"/>
  <Hangup/>
</Response>`;

  res.status(200).type("text/xml").send(twiml);
}

/**
 * Handle Twilio recording status callback — transcribes and summarises the recording.
 */
export async function handleTwilioRecording(req: Request, res: Response): Promise<void> {
  const params = (req.body ?? {}) as Record<string, string>;

  const callSid = String(params["CallSid"] ?? "");
  const recordingSid = String(params["RecordingSid"] ?? "");
  const recordingUrl = params["RecordingUrl"] ? `${params["RecordingUrl"]}.mp3` : null;
  const durationSecs = parseInt(String(params["RecordingDuration"] ?? "0"), 10) || 0;
  const recordingStatus = String(params["RecordingStatus"] ?? "");

  if (recordingStatus !== "completed" || !recordingUrl) {
    res.status(200).send("ok");
    return;
  }

  const [callRecord] = await db
    .select()
    .from(callRecordsTable)
    .where(eq(callRecordsTable.twilioCallSid, callSid));

  if (!callRecord) {
    logger.warn({ callSid }, "recording webhook: no matching call record");
    res.status(200).send("ok");
    return;
  }

  const tenantId = callRecord.tenantId;

  await db
    .update(callRecordsTable)
    .set({ recordingUrl, recordingSid, durationSeconds: durationSecs, status: "completed", endedAt: new Date() })
    .where(eq(callRecordsTable.id, callRecord.id))
    .catch((err: Error) => logger.warn({ err }, "recording: update call failed"));

  // For inbound calls that look like voicemails (short, no answer), store as voicemail
  if (callRecord.direction === "inbound" && durationSecs > 2) {
    await db.insert(voicemailsTable).values({
      tenantId,
      callRecordId: callRecord.id,
      fromNumber: callRecord.fromNumber,
      customerId: callRecord.customerId,
      recordingUrl,
      recordingSid,
      durationSeconds: durationSecs,
    }).catch((err: Error) => logger.warn({ err }, "recording: voicemail insert failed"));

    await emitWorkflowEvent(tenantId, "voicemail.received", {
      callSid,
      fromNumber: callRecord.fromNumber,
      recordingUrl,
      durationSeconds: durationSecs,
    }).catch(() => {});
  }

  await emitWorkflowEvent(tenantId, "call.completed", {
    callSid,
    fromNumber: callRecord.fromNumber,
    toNumber: callRecord.toNumber,
    durationSeconds: durationSecs,
  }).catch(() => {});

  // Transcribe + summarise async
  setImmediate(async () => {
    if (!isAIAvailable() || !recordingUrl) return;
    try {
      const audioResp = await fetch(recordingUrl);
      if (!audioResp.ok) return;
      const buffer = Buffer.from(await audioResp.arrayBuffer());
      const transcription = await transcribeAudio(buffer, "recording.mp3");

      const [tenant] = await db.select({ name: tenantsTable.name }).from(tenantsTable).where(eq(tenantsTable.id, tenantId));
      const aiSummary = await generateReceptionistResponseWithAI({
        callerNumber: callRecord.fromNumber ?? "Unknown",
        transcription,
        tenantName: tenant?.name ?? "the business",
        tenantId,
      });

      await db.update(callRecordsTable)
        .set({ transcription, aiSummary })
        .where(eq(callRecordsTable.id, callRecord.id))
        .catch(() => {});

      if (callRecord.direction === "inbound") {
        await db.update(voicemailsTable)
          .set({ transcription })
          .where(eq(voicemailsTable.callRecordId, callRecord.id))
          .catch(() => {});
      }

      await recordUsage(tenantId, "ai_call", 100, { sub: "transcription", callSid }).catch(() => {});
    } catch (err) {
      logger.warn({ err, callSid }, "voice: transcription/summary failed");
    }
  });

  res.status(200).send("ok");
}
