import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, vehiclesTable, vehicleLocationsTable, usersTable, type Vehicle, type VehicleLocation } from "@workspace/db";
import {
  ListVehiclesResponse,
  CreateVehicleBody,
  UpdateVehicleBody,
  UpdateVehicleResponse,
  RecordVehicleLocationBody,
  RecordVehicleLocationResponse,
  ListLatestVehicleLocationsResponse,
} from "@workspace/api-zod";
import { requireTenant } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { isTenantMember } from "../lib/tenantGuards";

const router: IRouter = Router();

function serializeVehicle(v: Vehicle, driverName: string | null) {
  return {
    id: v.id,
    label: v.label,
    registration: v.registration,
    make: v.make,
    model: v.model,
    year: v.year,
    motDueAt: v.motDueAt?.toISOString() ?? null,
    taxDueAt: v.taxDueAt?.toISOString() ?? null,
    serviceDueAt: v.serviceDueAt?.toISOString() ?? null,
    assignedDriverId: v.assignedDriverId,
    assignedDriverName: driverName,
    status: v.status,
    createdAt: v.createdAt.toISOString(),
  };
}

function serializeLocation(l: VehicleLocation) {
  return {
    id: l.id,
    vehicleId: l.vehicleId,
    lat: l.lat,
    lng: l.lng,
    speedKph: l.speedKph,
    headingDeg: l.headingDeg,
    recordedAt: l.recordedAt.toISOString(),
  };
}

router.get("/v1/fleet/vehicles", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const rows = await db
    .select({ v: vehiclesTable, driverName: usersTable.name })
    .from(vehiclesTable)
    .leftJoin(usersTable, eq(usersTable.id, vehiclesTable.assignedDriverId))
    .where(eq(vehiclesTable.tenantId, tenantId))
    .orderBy(desc(vehiclesTable.createdAt));
  res.json(ListVehiclesResponse.parse(rows.map((r) => serializeVehicle(r.v, r.driverName))));
});

router.post("/v1/fleet/vehicles", requireTenant, async (req, res): Promise<void> => {
  const parsed = CreateVehicleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  if (parsed.data.assignedDriverId && !(await isTenantMember(tenantId, parsed.data.assignedDriverId))) {
    res.status(400).json({ error: "Driver is not a member of this tenant" });
    return;
  }
  const [v] = await db
    .insert(vehiclesTable)
    .values({
      tenantId,
      label: parsed.data.label,
      registration: parsed.data.registration,
      make: parsed.data.make ?? null,
      model: parsed.data.model ?? null,
      year: parsed.data.year ?? null,
      motDueAt: parsed.data.motDueAt ?? null,
      taxDueAt: parsed.data.taxDueAt ?? null,
      serviceDueAt: parsed.data.serviceDueAt ?? null,
      assignedDriverId: parsed.data.assignedDriverId ?? null,
      status: parsed.data.status ?? "active",
    })
    .returning();
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "vehicle.created",
    message: `Vehicle ${v.registration} added`,
  });
  res.status(201).json(UpdateVehicleResponse.parse(serializeVehicle(v, null)));
});

router.patch("/v1/fleet/vehicles/:vehicleId", requireTenant, async (req, res): Promise<void> => {
  const parsed = UpdateVehicleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  if (parsed.data.assignedDriverId && !(await isTenantMember(tenantId, parsed.data.assignedDriverId))) {
    res.status(400).json({ error: "Driver is not a member of this tenant" });
    return;
  }
  const updates: Record<string, unknown> = {};
  for (const k of [
    "label",
    "registration",
    "make",
    "model",
    "year",
    "motDueAt",
    "taxDueAt",
    "serviceDueAt",
    "assignedDriverId",
    "status",
  ] as const) {
    if (parsed.data[k] !== undefined) updates[k] = parsed.data[k];
  }
  const [v] = await db
    .update(vehiclesTable)
    .set(updates)
    .where(and(eq(vehiclesTable.tenantId, tenantId), eq(vehiclesTable.id, (req.params.vehicleId as string))))
    .returning();
  if (!v) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }
  let driverName: string | null = null;
  if (v.assignedDriverId) {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, v.assignedDriverId));
    driverName = u?.name ?? null;
  }
  res.json(UpdateVehicleResponse.parse(serializeVehicle(v, driverName)));
});

router.delete("/v1/fleet/vehicles/:vehicleId", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const result = await db
    .delete(vehiclesTable)
    .where(and(eq(vehiclesTable.tenantId, tenantId), eq(vehiclesTable.id, (req.params.vehicleId as string))))
    .returning({ id: vehiclesTable.id });
  if (result.length === 0) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }
  res.status(204).send();
});

router.post("/v1/fleet/vehicles/:vehicleId/location", requireTenant, async (req, res): Promise<void> => {
  const parsed = RecordVehicleLocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const [v] = await db
    .select()
    .from(vehiclesTable)
    .where(and(eq(vehiclesTable.tenantId, tenantId), eq(vehiclesTable.id, (req.params.vehicleId as string))));
  if (!v) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }
  const [loc] = await db
    .insert(vehicleLocationsTable)
    .values({
      tenantId,
      vehicleId: v.id,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      speedKph: parsed.data.speedKph ?? null,
      headingDeg: parsed.data.headingDeg ?? null,
    })
    .returning();
  res.json(RecordVehicleLocationResponse.parse(serializeLocation(loc)));
});

router.get("/v1/fleet/locations", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  // Latest location per vehicle: subquery with row_number
  const rows = await db.execute<{
    id: string;
    vehicle_id: string;
    lat: string;
    lng: string;
    speed_kph: number | null;
    heading_deg: number | null;
    recorded_at: Date;
  }>(sql`
    SELECT DISTINCT ON (vehicle_id)
      id, vehicle_id, lat, lng, speed_kph, heading_deg, recorded_at
    FROM vehicle_locations
    WHERE tenant_id = ${tenantId}
    ORDER BY vehicle_id, recorded_at DESC
  `);
  const out = rows.rows.map((r) => ({
    id: r.id,
    vehicleId: r.vehicle_id,
    lat: r.lat,
    lng: r.lng,
    speedKph: r.speed_kph,
    headingDeg: r.heading_deg,
    recordedAt: new Date(r.recorded_at).toISOString(),
  }));
  res.json(ListLatestVehicleLocationsResponse.parse(out));
});

export default router;
