import { and, eq } from "drizzle-orm";
import {
  db,
  customersTable,
  vehiclesTable,
  membershipsTable,
} from "@workspace/db";

export async function isTenantCustomer(tenantId: string, customerId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(and(eq(customersTable.tenantId, tenantId), eq(customersTable.id, customerId)));
  return Boolean(row);
}

export async function isTenantVehicle(tenantId: string, vehicleId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: vehiclesTable.id })
    .from(vehiclesTable)
    .where(and(eq(vehiclesTable.tenantId, tenantId), eq(vehiclesTable.id, vehicleId)));
  return Boolean(row);
}

export async function isTenantMember(tenantId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: membershipsTable.userId })
    .from(membershipsTable)
    .where(and(eq(membershipsTable.tenantId, tenantId), eq(membershipsTable.userId, userId)));
  return Boolean(row);
}
