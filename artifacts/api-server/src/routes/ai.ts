import { Router, type IRouter } from "express";
import { requireTenant } from "../middlewares/auth";
import {
  buildQuoteWithAI,
  scoreLeadWithAI,
  summariseJobWithAI,
  parseCrmSearchWithAI,
  generateReportInsightWithAI,
  draftReplyWithAI,
  isAIAvailable,
} from "../lib/ai";

const router: IRouter = Router();

function noKey(res: any) {
  res.status(503).json({ error: "AI not configured — add OPENAI_API_KEY to enable CtrlAI features." });
}

// ---- Status ------------------------------------------------------------------

router.get("/v1/ai/status", requireTenant, (_req, res) => {
  res.json({ available: isAIAvailable() });
});

// ---- Quote builder -----------------------------------------------------------

router.post("/v1/ai/quote-builder", requireTenant, async (req, res) => {
  if (!isAIAvailable()) { noKey(res); return; }
  const tenantId = req.auth!.tenant!.id;
  const body = req.body ?? {};
  // Accept either classic (customerName + jobDescription) or detail-page payload
  const customerName = body.customerName ?? "Customer";
  const jobDescription = body.jobDescription
    ?? (body.items ? `Quote items: ${(body.items as any[]).map((i: any) => i.description).join(", ")}` : null)
    ?? body.notes
    ?? "General trade job";
  try {
    const result = await buildQuoteWithAI({
      customerName,
      jobDescription,
      tradeCategory: body.tradeCategory,
      currency: body.currency,
      tenantId,
    });
    res.json({ ...result, suggestions: `${result.title}\n\n${result.notes}\n\nSuggested items:\n${result.items.map((i) => `• ${i.description}: ${i.quantity} × £${(i.unitPricePence / 100).toFixed(2)}`).join("\n")}` });
  } catch (err: any) {
    req.log.warn({ err }, "ai/quote-builder error");
    res.status(502).json({ error: err?.message ?? "AI error" });
  }
});

// ---- Lead scoring ------------------------------------------------------------

router.post("/v1/ai/lead-score", requireTenant, async (req, res) => {
  if (!isAIAvailable()) { noKey(res); return; }
  const tenantId = req.auth!.tenant!.id;
  const { name, company, source, message, valuePence, email, phone, status, score, title } = req.body ?? {};
  if (!name) {
    res.status(400).json({ error: "name required" });
    return;
  }
  try {
    const result = await scoreLeadWithAI({
      name,
      company,
      source: source ?? "unknown",
      message: message ?? title,
      valuePence,
      email,
      phone,
      tenantId,
    });
    const analysis = `Score: ${result.score}/100 (${result.confidence} confidence)\n\n${result.reasoning}\n\nRecommended next action: ${result.nextAction}`;
    res.json({ ...result, analysis });
  } catch (err: any) {
    req.log.warn({ err }, "ai/lead-score error");
    res.status(502).json({ error: err?.message ?? "AI error" });
  }
});

// ---- Job summary -------------------------------------------------------------

router.post("/v1/ai/job-summary", requireTenant, async (req, res) => {
  if (!isAIAvailable()) { noKey(res); return; }
  const tenantId = req.auth!.tenant!.id;
  const { jobTitle, jobNumber, status, description, customerName, engineerName, assignedUserName, scheduledStart, notes } = req.body ?? {};
  try {
    const summary = await summariseJobWithAI({
      jobTitle: jobTitle ?? jobNumber ?? "Job",
      status: status ?? "unknown",
      description,
      customerName,
      engineerName: engineerName ?? assignedUserName,
      scheduledStart,
      notes,
      tenantId,
    });
    res.json({ summary });
  } catch (err: any) {
    req.log.warn({ err }, "ai/job-summary error");
    res.status(502).json({ error: err?.message ?? "AI error" });
  }
});

// ---- CRM search intent -------------------------------------------------------

router.post("/v1/ai/crm-search", requireTenant, async (req, res) => {
  if (!isAIAvailable()) { noKey(res); return; }
  const tenantId = req.auth!.tenant!.id;
  const { query } = req.body ?? {};
  if (!query) { res.status(400).json({ error: "query required" }); return; }
  try {
    const result = await parseCrmSearchWithAI({ query, tenantId });
    res.json(result);
  } catch (err: any) {
    req.log.warn({ err }, "ai/crm-search error");
    res.status(502).json({ error: err?.message ?? "AI error" });
  }
});

// ---- Report insights ---------------------------------------------------------

router.post("/v1/ai/report-insights", requireTenant, async (req, res) => {
  if (!isAIAvailable()) { noKey(res); return; }
  const tenantId = req.auth!.tenant!.id;
  const { reportType, data } = req.body ?? {};
  if (!reportType || !data) {
    res.status(400).json({ error: "reportType and data required" });
    return;
  }
  try {
    const insights = await generateReportInsightWithAI({ reportType, data, tenantId });
    res.json({ insights });
  } catch (err: any) {
    req.log.warn({ err }, "ai/report-insights error");
    res.status(502).json({ error: err?.message ?? "AI error" });
  }
});

// ---- Reply draft -------------------------------------------------------------

router.post("/v1/ai/reply-draft", requireTenant, async (req, res) => {
  if (!isAIAvailable()) { noKey(res); return; }
  const tenantId = req.auth!.tenant!.id;
  const { threadMessages, channel, customerName } = req.body ?? {};
  if (!threadMessages || !channel) {
    res.status(400).json({ error: "threadMessages and channel required" });
    return;
  }
  try {
    const reply = await draftReplyWithAI({ threadMessages, channel, customerName, tenantId });
    res.json({ reply });
  } catch (err: any) {
    req.log.warn({ err }, "ai/reply-draft error");
    res.status(502).json({ error: err?.message ?? "AI error" });
  }
});

export default router;
