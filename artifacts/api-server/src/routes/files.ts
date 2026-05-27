import { Router, type IRouter } from "express";
import { and, eq, desc } from "drizzle-orm";
import { db, filesTable, type FileRow } from "@workspace/db";
import { ListFilesResponse, ListFilesResponseItem, CreateFileBody } from "@workspace/api-zod";
import { requireTenant } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { ObjectStorageService } from "../lib/objectStorage";

const objectStorageService = new ObjectStorageService();

const router: IRouter = Router();

function serialize(f: FileRow) {
  return {
    id: f.id,
    tenantId: f.tenantId,
    url: f.url,
    kind: f.kind,
    parentKind: f.parentKind,
    parentId: f.parentId,
    name: f.name,
    label: f.label,
    mimeType: f.mimeType,
    sizeBytes: f.sizeBytes,
    uploadedByUserId: f.uploadedByUserId,
    uploadedByLabel: f.uploadedByLabel,
    createdAt: f.createdAt.toISOString(),
  };
}

router.get("/v1/files", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const parentKind = typeof req.query.parentKind === "string" ? req.query.parentKind : "";
  const parentId = typeof req.query.parentId === "string" ? req.query.parentId : "";
  if (!parentKind || !parentId) {
    res.status(400).json({ error: "parentKind and parentId required" });
    return;
  }
  const rows = await db
    .select()
    .from(filesTable)
    .where(
      and(
        eq(filesTable.tenantId, tenantId),
        eq(filesTable.parentKind, parentKind),
        eq(filesTable.parentId, parentId),
      ),
    )
    .orderBy(desc(filesTable.createdAt));
  res.json(ListFilesResponse.parse(rows.map(serialize)));
});

router.post("/v1/files", requireTenant, async (req, res): Promise<void> => {
  const parsed = CreateFileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const u = req.auth!.user;
  let normalizedUrl = parsed.data.url;
  try {
    normalizedUrl = await objectStorageService.trySetObjectEntityAclPolicy(parsed.data.url, {
      owner: tenantId,
      visibility: "private",
    });
  } catch (err) {
    req.log.warn({ err, url: parsed.data.url }, "Failed to set object ACL; storing raw URL");
  }
  const [row] = await db
    .insert(filesTable)
    .values({
      tenantId,
      url: normalizedUrl,
      kind: parsed.data.kind,
      parentKind: parsed.data.parentKind ?? null,
      parentId: parsed.data.parentId ?? null,
      name: parsed.data.name ?? null,
      label: parsed.data.label ?? null,
      mimeType: parsed.data.mimeType ?? null,
      sizeBytes: parsed.data.sizeBytes ?? null,
      uploadedByUserId: u.id,
      uploadedByLabel: u.email,
    })
    .returning();
  await logAudit({
    tenantId,
    actorUserId: u.id,
    actorLabel: u.email,
    kind: "file.uploaded",
    message: `Uploaded ${row.name ?? row.kind}`,
    metadata: { fileId: row.id, parentKind: row.parentKind, parentId: row.parentId },
  });
  res.status(201).json(ListFilesResponseItem.parse(serialize(row)));
});

router.delete("/v1/files/:fileId", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const fileId = req.params.fileId as string;
  const [row] = await db
    .select()
    .from(filesTable)
    .where(and(eq(filesTable.tenantId, tenantId), eq(filesTable.id, fileId)));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await db.delete(filesTable).where(eq(filesTable.id, fileId));
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "file.deleted",
    message: `Removed file ${row.name ?? row.id}`,
    metadata: { fileId: row.id },
  });
  res.status(204).end();
});

export default router;
