import { logger } from "./logger";
import { recordUsage } from "./usage";

const OPENAI_BASE = "https://api.openai.com/v1";
const MODEL = "gpt-5.4";

function apiKey(): string | null {
  return process.env.OPENAI_API_KEY ?? null;
}

async function chat(
  messages: { role: string; content: string }[],
  opts?: { tenantId?: string; maxTokens?: number },
): Promise<string> {
  const key = apiKey();
  if (!key) throw new Error("OPENAI_API_KEY not configured");

  const resp = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_completion_tokens: opts?.maxTokens ?? 8192,
      messages,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`OpenAI error ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as any;
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  const tokensUsed: number = data?.usage?.total_tokens ?? 1;

  if (opts?.tenantId) {
    await recordUsage(opts.tenantId, "ai_call", tokensUsed, { model: MODEL }).catch(() => {});
  }

  return content;
}

async function transcribeAudio(audioBuffer: Buffer, filename = "audio.webm"): Promise<string> {
  const key = apiKey();
  if (!key) throw new Error("OPENAI_API_KEY not configured");

  const form = new FormData();
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/webm" });
  form.append("file", blob, filename);
  form.append("model", "gpt-4o-mini-transcribe");
  form.append("response_format", "json");

  const resp = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`OpenAI transcribe error ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as any;
  return data?.text ?? "";
}

// ---- Feature-specific helpers ------------------------------------------------

export interface QuoteBuildInput {
  customerName: string;
  jobDescription: string;
  tradeCategory?: string;
  currency?: string;
  tenantId?: string;
}

export interface QuoteBuildResult {
  title: string;
  notes: string;
  items: { description: string; quantity: number; unitPricePence: number }[];
}

export async function buildQuoteWithAI(input: QuoteBuildInput): Promise<QuoteBuildResult> {
  const currency = input.currency ?? "GBP";
  const penceLabel = currency === "GBP" ? "pence (100 = £1)" : "cents (100 = $1)";
  const prompt = `You are a trade business quoting assistant. Generate a professional quote for the following job.

Customer: ${input.customerName}
Trade category: ${input.tradeCategory ?? "General trade"}
Job description: ${input.jobDescription}
Currency: ${currency} — prices in ${penceLabel}

Respond with ONLY valid JSON in this exact shape:
{
  "title": "short quote title",
  "notes": "professional notes for the customer",
  "items": [
    { "description": "line item description", "quantity": 1, "unitPricePence": 25000 }
  ]
}
Do not wrap in markdown. Be realistic with pricing for UK trade work.`;

  const raw = await chat([{ role: "user", content: prompt }], { tenantId: input.tenantId });
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(cleaned) as QuoteBuildResult;
  } catch {
    throw new Error("AI returned invalid JSON for quote");
  }
}

export interface LeadScoreInput {
  name: string;
  company?: string | null;
  source: string;
  message?: string | null;
  valuePence?: number;
  email?: string | null;
  phone?: string | null;
  tenantId?: string;
}

export interface LeadScoreResult {
  score: number;
  confidence: string;
  reasoning: string;
  nextAction: string;
}

export async function scoreLeadWithAI(input: LeadScoreInput): Promise<LeadScoreResult> {
  const prompt = `You are a lead qualification expert for a trade business. Score this lead from 0-100.

Lead details:
- Name: ${input.name}
- Company: ${input.company ?? "N/A"}
- Source: ${input.source}
- Estimated value: ${input.valuePence ? `£${(input.valuePence / 100).toFixed(2)}` : "Unknown"}
- Has email: ${input.email ? "Yes" : "No"}
- Has phone: ${input.phone ? "Yes" : "No"}
- Message: ${input.message ?? "None"}

Respond with ONLY valid JSON:
{
  "score": 75,
  "confidence": "high",
  "reasoning": "brief explanation",
  "nextAction": "recommended next step"
}`;

  const raw = await chat([{ role: "user", content: prompt }], { tenantId: input.tenantId });
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(cleaned) as LeadScoreResult;
  } catch {
    return { score: 50, confidence: "low", reasoning: raw.slice(0, 200), nextAction: "Follow up" };
  }
}

export interface JobSummaryInput {
  jobTitle: string;
  status: string;
  description?: string | null;
  customerName?: string;
  engineerName?: string | null;
  scheduledStart?: string | null;
  notes?: string;
  tenantId?: string;
}

export async function summariseJobWithAI(input: JobSummaryInput): Promise<string> {
  const prompt = `Write a concise professional summary of this trade job for internal records. Keep it to 2-3 sentences.

Job: ${input.jobTitle}
Status: ${input.status}
Customer: ${input.customerName ?? "Unknown"}
Engineer: ${input.engineerName ?? "Unassigned"}
Scheduled: ${input.scheduledStart ?? "Not scheduled"}
Description: ${input.description ?? "None"}
Notes: ${input.notes ?? "None"}

Respond with ONLY the summary text, no JSON.`;

  return chat([{ role: "user", content: prompt }], { tenantId: input.tenantId });
}

export interface CrmSearchInput {
  query: string;
  tenantId?: string;
}

export interface CrmSearchResult {
  intent: string;
  entities: { kind: string; value: string }[];
  suggestion: string;
}

export async function parseCrmSearchWithAI(input: CrmSearchInput): Promise<CrmSearchResult> {
  const prompt = `You are a CRM search assistant for a trade business. Parse this search query.

Query: "${input.query}"

Identify the intent (find_customer, find_job, find_quote, find_lead, find_invoice, general) and extract entities.

Respond with ONLY valid JSON:
{
  "intent": "find_customer",
  "entities": [{"kind": "name", "value": "John Smith"}],
  "suggestion": "natural language summary of what was searched"
}`;

  const raw = await chat([{ role: "user", content: prompt }], { tenantId: input.tenantId });
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(cleaned) as CrmSearchResult;
  } catch {
    return { intent: "general", entities: [], suggestion: input.query };
  }
}

export interface ReportInsightInput {
  reportType: string;
  data: Record<string, unknown>;
  tenantId?: string;
}

export async function generateReportInsightWithAI(input: ReportInsightInput): Promise<string> {
  const prompt = `You are a business analyst for a trade/field-service company. Analyse this ${input.reportType} data and provide 3-4 concise bullet-point insights with recommendations.

Data: ${JSON.stringify(input.data, null, 2).slice(0, 3000)}

Respond with bullet points only — no headings, no markdown headers. Keep it practical and actionable.`;

  return chat([{ role: "user", content: prompt }], { tenantId: input.tenantId });
}

export interface ReplyDraftInput {
  threadMessages: { direction: string; body: string; createdAt: string }[];
  channel: string;
  customerName?: string | null;
  tenantId?: string;
}

export async function draftReplyWithAI(input: ReplyDraftInput): Promise<string> {
  const history = input.threadMessages
    .slice(-6)
    .map((m) => `[${m.direction === "in" ? "Customer" : "Us"}]: ${m.body}`)
    .join("\n");

  const prompt = `You are a professional trade business assistant. Draft a short, friendly reply to this customer message thread.

Channel: ${input.channel}
Customer: ${input.customerName ?? "Customer"}

Conversation:
${history}

Respond with ONLY the reply text — no greetings like "Dear X", no sign-off. Keep it concise and professional.`;

  return chat([{ role: "user", content: prompt }], { tenantId: input.tenantId });
}

export interface AiReceptionistInput {
  callerNumber: string;
  transcription: string;
  tenantName: string;
  tenantId?: string;
}

export async function generateReceptionistResponseWithAI(input: AiReceptionistInput): Promise<string> {
  const prompt = `You are a professional AI receptionist for ${input.tenantName}, a trade business. A customer called and said:

"${input.transcription}"

Generate a short, warm, professional response to acknowledge their call and let them know someone will call back shortly. Keep it under 50 words. Plain text only.`;

  return chat([{ role: "user", content: prompt }], { tenantId: input.tenantId });
}

export interface ReceiptLineItem {
  description: string;
  quantity: number;
  unitCostPence: number;
  confidence: number;
}

export interface ReceiptScanResult {
  supplierName: string | null;
  supplierNameConfidence: number;
  date: string | null;
  dateConfidence: number;
  lineItems: ReceiptLineItem[];
  totalPence: number | null;
  totalConfidence: number;
  rawText: string;
}

export async function scanReceiptWithAI(
  base64Image: string,
  mimeType: string,
  opts?: { tenantId?: string },
): Promise<ReceiptScanResult> {
  const key = apiKey();
  if (!key) throw new Error("OPENAI_API_KEY not configured");

  const prompt = `You are a receipt OCR assistant. Extract structured data from this receipt image.

Respond ONLY with valid JSON matching this exact shape (no markdown fences):
{
  "supplierName": "string or null",
  "supplierNameConfidence": 0.0-1.0,
  "date": "YYYY-MM-DD or null",
  "dateConfidence": 0.0-1.0,
  "lineItems": [
    {
      "description": "item description",
      "quantity": 1,
      "unitCostPence": 1000,
      "confidence": 0.0-1.0
    }
  ],
  "totalPence": 10000 or null,
  "totalConfidence": 0.0-1.0,
  "rawText": "brief summary of key text on receipt"
}

Rules:
- All monetary values must be in pence (integer). £1.00 = 100.
- Confidence 1.0 = clearly visible and unambiguous. 0.0 = guessed.
- If a field is not visible, set it to null and confidence to 0.
- lineItems should represent individual products/services on the receipt.
- If quantity is not shown, default to 1.`;

  const messages = [
    {
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: "high" },
        },
        { type: "text", text: prompt },
      ],
    },
  ];

  const resp = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_completion_tokens: 4096,
      messages,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`OpenAI vision error ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as any;
  const content: string = data?.choices?.[0]?.message?.content ?? "{}";
  const tokensUsed: number = data?.usage?.total_tokens ?? 1;

  if (opts?.tenantId) {
    await recordUsage(opts.tenantId, "ai_call", tokensUsed, { model: MODEL, feature: "receipt_scan" }).catch(() => {});
  }

  let parsed: ReceiptScanResult;
  try {
    parsed = JSON.parse(content.trim());
  } catch {
    throw new Error("AI returned invalid JSON for receipt scan");
  }

  return parsed;
}

export { transcribeAudio };
export const isAIAvailable = () => !!apiKey();

logger.info({ aiAvailable: isAIAvailable() }, "AI service initialised");
