import { Router, type IRouter } from "express";
import { db, platformSalesLeadsTable } from "@workspace/db";

const router: IRouter = Router();

router.post("/v1/platform/leads", async (req, res): Promise<void> => {
  const { name, email, phone, company, trade, source, message } = req.body ?? {};
  if (!name || !email) {
    res.status(400).json({ error: "name and email are required" });
    return;
  }
  const [lead] = await db
    .insert(platformSalesLeadsTable)
    .values({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      phone: phone ? String(phone).trim() : null,
      company: company ? String(company).trim() : null,
      trade: trade ? String(trade).trim() : null,
      source: source ? String(source).trim() : "contact_form",
      status: "new",
      notes: message ? String(message).trim() : null,
    })
    .returning();
  res.status(201).json({ id: lead.id, status: lead.status });
});

export default router;
