import { Router, type IRouter } from "express";
import { and, eq, sql, sum, count, inArray } from "drizzle-orm";
import { db, projectsTable, jobsTable, customersTable, invoicesTable, type Project } from "@workspace/db";
import { requireTenant } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

interface CreateProjectBody {
  name?: unknown;
  status?: unknown;
  description?: unknown;
  startDate?: unknown;
  endDate?: unknown;
}

interface UpdateProjectBody {
  name?: unknown;
  status?: unknown;
  description?: unknown;
  startDate?: unknown;
  endDate?: unknown;
}

interface LinkJobBody {
  jobId?: unknown;
}

function parseCreateProject(body: unknown): { ok: true; data: Required<Pick<CreateProjectBody, "name">> & Omit<CreateProjectBody, "name"> } | { ok: false; error: string } {
  const b = body as CreateProjectBody;
  if (!b || typeof b.name !== "string" || b.name.trim().length === 0) {
    return { ok: false, error: "name is required" };
  }
  return { ok: true, data: b as any };
}

function parseLinkJob(body: unknown): { ok: true; jobId: string } | { ok: false; error: string } {
  const b = body as LinkJobBody;
  if (!b || typeof b.jobId !== "string" || !b.jobId) {
    return { ok: false, error: "jobId is required" };
  }
  return { ok: true, jobId: b.jobId };
}

function serializeProject(p: Project, jobCount: number, totalValuePence: number) {
  return {
    id: p.id,
    name: p.name,
    status: p.status,
    description: p.description ?? null,
    startDate: p.startDate?.toISOString() ?? null,
    endDate: p.endDate?.toISOString() ?? null,
    jobCount,
    totalValuePence,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

async function getProjectAggregates(tenantId: string, projectId: string) {
  const [agg] = await db
    .select({
      jobCount: count(jobsTable.id),
      totalValuePence: sum(jobsTable.valuePence),
    })
    .from(jobsTable)
    .where(and(eq(jobsTable.tenantId, tenantId), eq(jobsTable.projectId, projectId)));
  return {
    jobCount: agg?.jobCount ?? 0,
    totalValuePence: Number(agg?.totalValuePence ?? 0),
  };
}

// List projects
router.get("/v1/projects", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const statusQ = req.query.status;
  const status: string | undefined = typeof statusQ === "string" ? statusQ : undefined;

  const whereClause = status
    ? and(eq(projectsTable.tenantId, tenantId), eq(projectsTable.status, status))
    : eq(projectsTable.tenantId, tenantId);

  const projects = await db
    .select()
    .from(projectsTable)
    .where(whereClause)
    .orderBy(projectsTable.createdAt);

  const results = await Promise.all(
    projects.map(async (p) => {
      const agg = await getProjectAggregates(tenantId, p.id);
      return serializeProject(p, agg.jobCount, agg.totalValuePence);
    }),
  );

  res.json(results);
});

// Create project
router.post("/v1/projects", requireTenant, async (req, res): Promise<void> => {
  const parsed = parseCreateProject(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const b = parsed.data;
  const [project] = await db
    .insert(projectsTable)
    .values({
      tenantId,
      name: b.name as string,
      status: typeof b.status === "string" ? b.status : "planning",
      description: typeof b.description === "string" ? b.description : null,
      startDate: typeof b.startDate === "string" && b.startDate ? new Date(b.startDate) : null,
      endDate: typeof b.endDate === "string" && b.endDate ? new Date(b.endDate) : null,
    })
    .returning();
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "project.created",
    message: `Project "${project.name}" created`,
  });
  res.status(201).json(serializeProject(project, 0, 0));
});

// Get project detail with linked jobs and financials
router.get("/v1/projects/:projectId", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const projectId = req.params.projectId as string;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.tenantId, tenantId), eq(projectsTable.id, projectId)));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const jobs = await db
    .select({
      id: jobsTable.id,
      number: jobsTable.number,
      title: jobsTable.title,
      status: jobsTable.status,
      customerId: jobsTable.customerId,
      customerName: customersTable.name,
      scheduledStart: jobsTable.scheduledStart,
      scheduledEnd: jobsTable.scheduledEnd,
      valuePence: jobsTable.valuePence,
      createdAt: jobsTable.createdAt,
    })
    .from(jobsTable)
    .innerJoin(customersTable, eq(customersTable.id, jobsTable.customerId))
    .where(and(eq(jobsTable.tenantId, tenantId), eq(jobsTable.projectId, projectId)))
    .orderBy(jobsTable.createdAt);

  // Compute invoice financials via jobs linked to this project
  const jobIds = jobs.map((j) => j.id);
  let totalInvoicedPence = 0;
  let totalPaidPence = 0;
  if (jobIds.length > 0) {
    const invoicedRows = await db
      .select({
        totalInvoicedPence: sum(invoicesTable.totalPence),
        totalPaidPence: sum(
          sql<number>`CASE WHEN ${invoicesTable.status} = 'paid' THEN ${invoicesTable.totalPence} ELSE 0 END`,
        ),
      })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.tenantId, tenantId), inArray(invoicesTable.jobId, jobIds)));
    totalInvoicedPence = Number(invoicedRows[0]?.totalInvoicedPence ?? 0);
    totalPaidPence = Number(invoicedRows[0]?.totalPaidPence ?? 0);
  }

  const totalValuePence = jobs.reduce((s, j) => s + j.valuePence, 0);
  const outstandingPence = totalInvoicedPence - totalPaidPence;

  const completedJobs = jobs.filter((j) => j.status === "completed").length;
  const progressPct = jobs.length > 0 ? Math.round((completedJobs / jobs.length) * 100) : 0;

  res.json({
    ...serializeProject(project, jobs.length, totalValuePence),
    jobs: jobs.map((j) => ({
      id: j.id,
      number: j.number,
      title: j.title,
      status: j.status,
      customerId: j.customerId,
      customerName: j.customerName,
      scheduledStart: j.scheduledStart?.toISOString() ?? null,
      scheduledEnd: j.scheduledEnd?.toISOString() ?? null,
      valuePence: j.valuePence,
      createdAt: j.createdAt.toISOString(),
    })),
    financials: {
      totalValuePence,
      totalInvoicedPence,
      totalPaidPence,
      outstandingPence,
    },
    progressPct,
  });
});

// Update project
router.patch("/v1/projects/:projectId", requireTenant, async (req, res): Promise<void> => {
  const b = (req.body ?? {}) as UpdateProjectBody;
  const tenantId = req.auth!.tenant!.id;
  const projectId = req.params.projectId as string;

  const updates: Record<string, unknown> = {};
  if (b.name !== undefined) updates.name = b.name;
  if (b.status !== undefined) updates.status = b.status;
  if (b.description !== undefined) updates.description = b.description;
  if (b.startDate !== undefined)
    updates.startDate = typeof b.startDate === "string" && b.startDate ? new Date(b.startDate) : null;
  if (b.endDate !== undefined)
    updates.endDate = typeof b.endDate === "string" && b.endDate ? new Date(b.endDate) : null;

  const [updated] = await db
    .update(projectsTable)
    .set(updates)
    .where(and(eq(projectsTable.tenantId, tenantId), eq(projectsTable.id, projectId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const agg = await getProjectAggregates(tenantId, projectId);
  res.json(serializeProject(updated, agg.jobCount, agg.totalValuePence));
});

// Delete project (unlinks jobs, does not delete them)
router.delete("/v1/projects/:projectId", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const projectId = req.params.projectId as string;

  // Unlink all jobs first
  await db
    .update(jobsTable)
    .set({ projectId: null })
    .where(and(eq(jobsTable.tenantId, tenantId), eq(jobsTable.projectId, projectId)));

  const [deleted] = await db
    .delete(projectsTable)
    .where(and(eq(projectsTable.tenantId, tenantId), eq(projectsTable.id, projectId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "project.deleted",
    message: `Project "${deleted.name}" deleted`,
  });

  res.status(204).send();
});

// Link an existing job to a project
router.post("/v1/projects/:projectId/jobs", requireTenant, async (req, res): Promise<void> => {
  const parsed = parseLinkJob(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const projectId = req.params.projectId as string;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.tenantId, tenantId), eq(projectsTable.id, projectId)));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [updated] = await db
    .update(jobsTable)
    .set({ projectId })
    .where(and(eq(jobsTable.tenantId, tenantId), eq(jobsTable.id, parsed.jobId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.json({ jobId: updated.id, projectId });
});

// Unlink a job from a project
router.delete("/v1/projects/:projectId/jobs/:jobId", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const projectId = req.params.projectId as string;
  const jobId = req.params.jobId as string;

  const [updated] = await db
    .update(jobsTable)
    .set({ projectId: null })
    .where(
      and(
        eq(jobsTable.tenantId, tenantId),
        eq(jobsTable.id, jobId),
        eq(jobsTable.projectId, projectId),
      ),
    )
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Job not found in this project" });
    return;
  }

  res.status(204).send();
});

export default router;
