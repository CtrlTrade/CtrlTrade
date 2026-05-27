import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, customersTable } from "@workspace/db";
import {
  ListCustomersResponse,
  CreateCustomerBody,
  GetCustomerResponse,
  UpdateCustomerBody,
  UpdateCustomerResponse,
} from "@workspace/api-zod";
import { requireTenant } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

function serializeCustomer(c: typeof customersTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    addressLine1: c.addressLine1,
    city: c.city,
    postcode: c.postcode,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/v1/customers", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const rows = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.tenantId, tenantId))
    .orderBy(desc(customersTable.createdAt));
  res.json(ListCustomersResponse.parse(rows.map(serializeCustomer)));
});

router.post("/v1/customers", requireTenant, async (req, res): Promise<void> => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const [row] = await db
    .insert(customersTable)
    .values({ tenantId, ...parsed.data })
    .returning();
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "customer.created",
    message: `Customer created: ${row.name}`,
  });
  res.status(201).json(GetCustomerResponse.parse(serializeCustomer(row)));
});

router.get("/v1/customers/:customerId", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const [row] = await db
    .select()
    .from(customersTable)
    .where(and(eq(customersTable.tenantId, tenantId), eq(customersTable.id, (req.params.customerId as string))));
  if (!row) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json(GetCustomerResponse.parse(serializeCustomer(row)));
});

router.patch("/v1/customers/:customerId", requireTenant, async (req, res): Promise<void> => {
  const parsed = UpdateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const [row] = await db
    .update(customersTable)
    .set(parsed.data)
    .where(and(eq(customersTable.tenantId, tenantId), eq(customersTable.id, (req.params.customerId as string))))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json(UpdateCustomerResponse.parse(serializeCustomer(row)));
});

router.delete("/v1/customers/:customerId", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const result = await db
    .delete(customersTable)
    .where(and(eq(customersTable.tenantId, tenantId), eq(customersTable.id, (req.params.customerId as string))))
    .returning({ id: customersTable.id });
  if (result.length === 0) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.status(204).send();
});

export default router;
