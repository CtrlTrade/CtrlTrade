import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  tenantPhoneNumbersTable,
  callRecordsTable,
  voicemailsTable,
  tenantsTable,
  customersTable,
} from "@workspace/db";
import { requireTenant } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { recordUsage } from "../lib/usage";

const router: IRouter = Router();

function twilioCreds() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return { sid, token };
}

async function twilioGet(sid: string, token: string, path: string): Promise<any> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/${path}`;
  const resp = await fetch(url, {
    headers: { Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64") },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Twilio GET ${path} ${resp.status}: ${text}`);
  }
  return resp.json();
}

async function twilioPost(sid: string, token: string, path: string, body: Record<string, string>): Promise<any> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/${path}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Twilio POST ${path} ${resp.status}: ${text}`);
  }
  return resp.json();
}

// ---- Phone numbers -----------------------------------------------------------

router.get("/v1/voice/numbers", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenant!.id;
  const numbers = await db
    .select()
    .from(tenantPhoneNumbersTable)
    .where(eq(tenantPhoneNumbersTable.tenantId, tenantId))
    .orderBy(desc(tenantPhoneNumbersTable.createdAt));
  res.json({ numbers: numbers.map(serializeNumber) });
});

router.get("/v1/voice/numbers/available", requireTenant, async (req, res) => {
  const creds = twilioCreds();
  if (!creds) {
    res.status(503).json({ error: "Twilio not configured — add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN" });
    return;
  }
  const areaCode = req.query.areaCode ? String(req.query.areaCode) : undefined;
  const country = req.query.country ? String(req.query.country) : "GB";
  const qs = new URLSearchParams({ VoiceEnabled: "true", Limit: "20" });
  if (areaCode) qs.set("AreaCode", areaCode);
  try {
    const data = await twilioGet(creds.sid, creds.token, `AvailablePhoneNumbers/${country}/Local.json?${qs}`);
    res.json({ numbers: (data.available_phone_numbers ?? []).map((n: any) => ({
      phoneNumber: n.phone_number,
      friendlyName: n.friendly_name,
      region: n.region,
      capabilities: n.capabilities,
    })) });
  } catch (err: any) {
    req.log.warn({ err }, "voice/numbers/available error");
    res.status(502).json({ error: err?.message ?? "Twilio error" });
  }
});

router.post("/v1/voice/numbers", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenant!.id;
  const { phoneNumber, friendlyName } = req.body ?? {};
  if (!phoneNumber) { res.status(400).json({ error: "phoneNumber required" }); return; }

  const creds = twilioCreds();
  const baseDomain = process.env.REPLIT_DOMAINS?.split(",")[0];
  const voiceUrl = baseDomain ? `https://${baseDomain}/api/webhooks/twilio/voice` : "";
  const recordingUrl = baseDomain ? `https://${baseDomain}/api/webhooks/twilio/recording` : "";

  let twilioSid: string | undefined;
  let capabilities: Record<string, boolean> = {};

  if (creds && voiceUrl) {
    try {
      const resp = await twilioPost(creds.sid, creds.token, "IncomingPhoneNumbers.json", {
        PhoneNumber: phoneNumber,
        FriendlyName: friendlyName ?? phoneNumber,
        VoiceUrl: voiceUrl,
        VoiceMethod: "POST",
        StatusCallback: recordingUrl,
        StatusCallbackMethod: "POST",
        Record: "true",
      });
      twilioSid = resp.sid;
      capabilities = resp.capabilities ?? {};
    } catch (err: any) {
      req.log.warn({ err }, "voice: Twilio provision failed, saving locally only");
    }
  }

  const [number] = await db
    .insert(tenantPhoneNumbersTable)
    .values({
      tenantId,
      phoneNumber: String(phoneNumber),
      friendlyName: friendlyName ? String(friendlyName) : null,
      twilioSid,
      capabilities,
    })
    .returning();

  await logAudit({
    tenantId,
    actorUserId: req.auth!.user!.id,
    actorLabel: req.auth!.user!.email,
    kind: "voice.number.provisioned",
    message: `Phone number ${phoneNumber} provisioned`,
    metadata: { phoneNumber, twilioSid },
  });
  res.status(201).json({ number: serializeNumber(number!) });
});

router.delete("/v1/voice/numbers/:id", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenant!.id;
  const [number] = await db
    .select()
    .from(tenantPhoneNumbersTable)
    .where(and(eq(tenantPhoneNumbersTable.id, req.params.id as string), eq(tenantPhoneNumbersTable.tenantId, tenantId)));
  if (!number) { res.status(404).json({ error: "Not found" }); return; }

  const creds = twilioCreds();
  if (creds && number.twilioSid) {
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.sid}/IncomingPhoneNumbers/${number.twilioSid}.json`, {
      method: "DELETE",
      headers: { Authorization: "Basic " + Buffer.from(`${creds.sid}:${creds.token}`).toString("base64") },
    }).catch(() => {});
  }

  await db.delete(tenantPhoneNumbersTable).where(eq(tenantPhoneNumbersTable.id, req.params.id as string));
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user!.id,
    actorLabel: req.auth!.user!.email,
    kind: "voice.number.released",
    message: `Phone number ${number.phoneNumber} released`,
    metadata: { phoneNumber: number.phoneNumber },
  });
  res.json({ ok: true });
});

// ---- Browser softphone token -------------------------------------------------

router.post("/v1/voice/token", requireTenant, async (req, res) => {
  const creds = twilioCreds();
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;
  if (!creds || !twimlAppSid) {
    res.status(503).json({ error: "Twilio Voice SDK not configured — add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_TWIML_APP_SID" });
    return;
  }

  try {
    // Build Twilio Access Token with VoiceGrant using JWT
    const { createHmac } = await import("node:crypto");
    const header = Buffer.from(JSON.stringify({ typ: "JWT", alg: "HS256" })).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const identity = `user_${req.auth!.user!.id.replace(/-/g, "").slice(0, 16)}`;
    const jti = `${creds.sid}-${now}`;
    const grants: Record<string, unknown> = {
      identity,
      voice: { incoming: { allow: true }, outgoing: { application_sid: twimlAppSid } },
    };
    const payload = {
      jti,
      iss: creds.sid,
      sub: creds.sid,
      exp: now + 3600,
      nbf: now,
      grants,
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = createHmac("sha256", creds.token)
      .update(`${header}.${payloadB64}`)
      .digest("base64url");
    const token = `${header}.${payloadB64}.${sig}`;
    res.json({ token, identity, expiresIn: 3600 });
  } catch (err: any) {
    req.log.warn({ err }, "voice/token error");
    res.status(500).json({ error: "Failed to generate voice token" });
  }
});

// ---- Outbound calls ----------------------------------------------------------

router.post("/v1/voice/calls", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenant!.id;
  const { to, from } = req.body ?? {};
  if (!to) { res.status(400).json({ error: "to required" }); return; }

  const creds = twilioCreds();
  const baseDomain = process.env.REPLIT_DOMAINS?.split(",")[0];

  let twilioCallSid: string | undefined;
  let status = "initiated";

  if (creds && baseDomain) {
    const voiceUrl = `https://${baseDomain}/api/webhooks/twilio/voice`;
    const fromNumber = from ?? (await db.select().from(tenantPhoneNumbersTable).where(
      and(eq(tenantPhoneNumbersTable.tenantId, tenantId), eq(tenantPhoneNumbersTable.active, true)),
    ).limit(1))?.[0]?.phoneNumber;
    if (!fromNumber) { res.status(400).json({ error: "No outbound number configured" }); return; }
    try {
      const resp = await twilioPost(creds.sid, creds.token, "Calls.json", {
        To: String(to),
        From: fromNumber,
        Url: voiceUrl,
        Record: "true",
        RecordingStatusCallback: `https://${baseDomain}/api/webhooks/twilio/recording`,
      });
      twilioCallSid = resp.sid;
      status = resp.status ?? "initiated";
    } catch (err: any) {
      req.log.warn({ err }, "voice: outbound call error");
      res.status(502).json({ error: err?.message ?? "Twilio error" });
      return;
    }
  }

  const [call] = await db
    .insert(callRecordsTable)
    .values({ tenantId, twilioCallSid, direction: "outbound", toNumber: String(to), fromNumber: from, status })
    .returning();

  await recordUsage(tenantId, "ai_call", 1, { sub: "voice_outbound", to }).catch(() => {});
  res.status(201).json({ call: serializeCall(call!) });
});

// ---- Call history ------------------------------------------------------------

router.get("/v1/voice/calls", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenant!.id;
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? 50), 10)));
  const calls = await db
    .select()
    .from(callRecordsTable)
    .where(eq(callRecordsTable.tenantId, tenantId))
    .orderBy(desc(callRecordsTable.createdAt))
    .limit(limit);
  res.json({ calls: calls.map(serializeCall) });
});

router.get("/v1/voice/calls/:id", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenant!.id;
  const [call] = await db
    .select()
    .from(callRecordsTable)
    .where(and(eq(callRecordsTable.id, req.params.id as string), eq(callRecordsTable.tenantId, tenantId)));
  if (!call) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ call: serializeCall(call) });
});

// ---- Voicemails --------------------------------------------------------------

router.get("/v1/voice/voicemails", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenant!.id;
  const voicemails = await db
    .select()
    .from(voicemailsTable)
    .where(eq(voicemailsTable.tenantId, tenantId))
    .orderBy(desc(voicemailsTable.createdAt))
    .limit(50);
  res.json({ voicemails: voicemails.map(serializeVoicemail) });
});

router.post("/v1/voice/voicemails/:id/listen", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenant!.id;
  const [vm] = await db
    .update(voicemailsTable)
    .set({ listenedAt: new Date() })
    .where(and(eq(voicemailsTable.id, req.params.id as string), eq(voicemailsTable.tenantId, tenantId)))
    .returning();
  if (!vm) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ voicemail: serializeVoicemail(vm) });
});

// ---- Serializers -------------------------------------------------------------

function serializeNumber(n: typeof tenantPhoneNumbersTable.$inferSelect) {
  return {
    id: n.id,
    phoneNumber: n.phoneNumber,
    friendlyName: n.friendlyName,
    twilioSid: n.twilioSid,
    capabilities: n.capabilities,
    active: n.active,
    createdAt: n.createdAt.toISOString(),
  };
}

function serializeCall(c: typeof callRecordsTable.$inferSelect) {
  return {
    id: c.id,
    twilioCallSid: c.twilioCallSid,
    direction: c.direction,
    fromNumber: c.fromNumber,
    toNumber: c.toNumber,
    customerId: c.customerId,
    status: c.status,
    durationSeconds: c.durationSeconds,
    recordingUrl: c.recordingUrl,
    transcription: c.transcription,
    aiSummary: c.aiSummary,
    startedAt: c.startedAt?.toISOString() ?? null,
    endedAt: c.endedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

function serializeVoicemail(v: typeof voicemailsTable.$inferSelect) {
  return {
    id: v.id,
    callRecordId: v.callRecordId,
    fromNumber: v.fromNumber,
    customerId: v.customerId,
    recordingUrl: v.recordingUrl,
    durationSeconds: v.durationSeconds,
    transcription: v.transcription,
    listenedAt: v.listenedAt?.toISOString() ?? null,
    createdAt: v.createdAt.toISOString(),
  };
}

export default router;
