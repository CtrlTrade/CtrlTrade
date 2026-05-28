import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  tenantsTable,
  leadsTable,
  leadActivitiesTable,
  notificationDeliveriesTable,
  membershipsTable,
  usersTable,
} from "@workspace/db";
import { requireTenant } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { dispatchNotification } from "../lib/notifications";
import { emitWorkflowEvent } from "../lib/automationEngine";
import { z } from "zod";

const router: IRouter = Router();

const BookingWidgetConfigSchema = z.object({
  active: z.boolean().optional(),
  jobTypes: z.array(z.string().max(120)).max(50).optional(),
  showDateField: z.boolean().optional(),
  thankYouMessage: z.string().max(500).optional(),
});

const PublicBookingInputSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  jobType: z.string().max(120).optional().nullable(),
  preferredDate: z.string().max(50).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
});

function scoreLead(input: {
  email: string | null;
  phone: string | null;
  message: string | null;
}): number {
  const sourceWeight = 25; // "website" source weight
  let contact = 0;
  if (input.email && input.phone) contact = 20;
  else if (input.email || input.phone) contact = 10;
  const msg = (input.message ?? "").length;
  const msgBonus = msg >= 80 ? 10 : msg >= 20 ? 5 : 0;
  return Math.max(0, Math.min(100, sourceWeight + contact + msgBonus));
}

function nextFollowUp(now: Date): Date {
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

function isOriginAllowed(origin: string | undefined, allowlist: string[]): boolean {
  if (!origin) return true;
  const configured = allowlist.map((s) => s.trim()).filter((s) => s.length > 0);
  if (configured.length === 0) return true;
  let host: string;
  try { host = new URL(origin).host.toLowerCase(); } catch { return false; }
  const platformHosts = [
    ...((process.env.REPLIT_DOMAINS ?? "").split(",").map((d) => d.trim()).filter(Boolean)),
    process.env.REPLIT_DEV_DOMAIN ?? "",
  ].filter(Boolean).map((h) => h.toLowerCase());
  if (platformHosts.includes(host)) return true;
  for (const entry of configured) {
    let allowedHost = entry.toLowerCase();
    try { allowedHost = new URL(entry.includes("://") ? entry : `https://${entry}`).host.toLowerCase(); } catch {}
    if (host === allowedHost || host.endsWith(`.${allowedHost}`)) return true;
  }
  return false;
}

router.get("/v1/booking-widget/config", requireTenant, async (req, res): Promise<void> => {
  const tenant = req.auth!.tenant!;
  const config = tenant.bookingWidgetConfig ?? {};
  res.json({
    active: config.active ?? false,
    jobTypes: config.jobTypes ?? [],
    showDateField: config.showDateField ?? true,
    thankYouMessage: config.thankYouMessage ?? "Thanks for your enquiry — we'll be in touch shortly.",
    bookingPageUrl: buildBookingPageUrl(tenant.slug),
    embedCode: buildEmbedCode(tenant.slug),
    iframeCode: buildIframeCode(tenant.slug),
    widgetScriptTag: buildWidgetScriptTag(tenant.slug),
  });
});

router.patch("/v1/booking-widget/config", requireTenant, async (req, res): Promise<void> => {
  const parsed = BookingWidgetConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid configuration" });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const existing = req.auth!.tenant!.bookingWidgetConfig ?? {};
  const updated = { ...existing, ...parsed.data };
  await db.update(tenantsTable).set({ bookingWidgetConfig: updated }).where(eq(tenantsTable.id, tenantId));
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    kind: "booking_widget.config_updated",
    message: "Booking widget configuration updated",
    metadata: parsed.data as Record<string, unknown>,
  });
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  const config = tenant.bookingWidgetConfig ?? {};
  res.json({
    active: config.active ?? false,
    jobTypes: config.jobTypes ?? [],
    showDateField: config.showDateField ?? true,
    thankYouMessage: config.thankYouMessage ?? "Thanks for your enquiry — we'll be in touch shortly.",
    bookingPageUrl: buildBookingPageUrl(tenant.slug),
    embedCode: buildEmbedCode(tenant.slug),
    iframeCode: buildIframeCode(tenant.slug),
    widgetScriptTag: buildWidgetScriptTag(tenant.slug),
  });
});

router.get("/v1/public/book/:tenantSlug/widget.js", async (req, res): Promise<void> => {
  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.slug, req.params.tenantSlug as string));
  if (!tenant) {
    res.status(404).type("application/javascript").send("/* tenant not found */");
    return;
  }
  const config = tenant.bookingWidgetConfig ?? {};
  if (config.active === false) {
    res.status(404).type("application/javascript").send("/* booking widget is disabled */");
    return;
  }
  const baseDomain =
    process.env.REPLIT_DOMAINS?.split(",")[0] ||
    process.env.REPLIT_DEV_DOMAIN ||
    "your-app.replit.app";
  const apiBase = `https://${baseDomain}/api/v1/public/book/${tenant.slug}`;
  const script = buildWidgetScript(apiBase);
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(script);
});

router.get("/v1/public/book/:tenantSlug/info", async (req, res): Promise<void> => {
  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.slug, req.params.tenantSlug as string));
  if (!tenant) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const config = tenant.bookingWidgetConfig ?? {};
  if (config.active === false) {
    res.status(404).json({ error: "Booking is not available" });
    return;
  }
  res.json({
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    brandColor: tenant.brandColor ?? tenant.primaryColor ?? null,
    primaryColor: tenant.primaryColor ?? null,
    accentColor: tenant.accentColor ?? null,
    logoUrl: tenant.logoUrl ?? null,
    jobTypes: config.jobTypes ?? [],
    showDateField: config.showDateField ?? true,
    thankYouMessage: config.thankYouMessage ?? "Thanks for your enquiry — we'll be in touch shortly.",
  });
});

router.post("/v1/public/book/:tenantSlug", async (req, res): Promise<void> => {
  const parsed = PublicBookingInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid submission" });
    return;
  }

  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.slug, req.params.tenantSlug as string));
  if (!tenant) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const config = tenant.bookingWidgetConfig ?? {};
  if (config.active === false) {
    res.status(404).json({ error: "Booking is not available" });
    return;
  }

  const origin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
  if (!isOriginAllowed(origin, tenant.leadCaptureAllowedOrigins ?? [])) {
    res.status(403).json({ error: "Origin not allowed" });
    return;
  }

  const body = parsed.data;
  const now = new Date();

  const messageParts: string[] = [];
  if (body.jobType) messageParts.push(`Job type: ${body.jobType}`);
  if (body.preferredDate) messageParts.push(`Preferred date: ${body.preferredDate}`);
  if (body.address) messageParts.push(`Address: ${body.address}`);
  if (body.description) messageParts.push(body.description);
  const message = messageParts.join("\n") || null;

  const score = scoreLead({
    email: body.email ?? null,
    phone: body.phone ?? null,
    message,
  });

  const [lead] = await db
    .insert(leadsTable)
    .values({
      tenantId: tenant.id,
      name: body.name,
      email: body.email ?? null,
      phone: body.phone ?? null,
      company: null,
      source: "booking_widget",
      sourceDetail: req.headers.referer ?? null,
      title: body.jobType ? `Booking: ${body.jobType}` : "Online booking enquiry",
      message,
      valuePence: 0,
      score,
      followUpDueAt: nextFollowUp(now),
    })
    .returning();

  await db.insert(leadActivitiesTable).values({
    leadId: lead.id,
    tenantId: tenant.id,
    kind: "note",
    subject: "Submitted via booking widget",
    actorLabel: "Booking widget",
    occurredAt: now,
  });

  await logAudit({
    tenantId: tenant.id,
    actorLabel: "booking-widget",
    kind: "booking_widget.submitted",
    message: `Booking widget enquiry from ${lead.name}`,
    metadata: { leadId: lead.id, referer: req.headers.referer ?? null },
  });

  await db
    .update(notificationDeliveriesTable)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(notificationDeliveriesTable.tenantId, tenant.id),
        eq(notificationDeliveriesTable.subjectKind, "lead"),
        eq(notificationDeliveriesTable.subjectId, lead.id),
        eq(notificationDeliveriesTable.status, "queued"),
      ),
    );

  await db.insert(notificationDeliveriesTable).values({
    tenantId: tenant.id,
    userId: null,
    channel: "reminder",
    template: "lead.follow_up",
    subjectKind: "lead",
    subjectId: lead.id,
    scheduledAt: lead.followUpDueAt,
    status: "queued",
  });

  const owners = await db
    .select({ userId: membershipsTable.userId })
    .from(membershipsTable)
    .where(
      and(
        eq(membershipsTable.tenantId, tenant.id),
        eq(membershipsTable.role, "owner"),
        eq(membershipsTable.status, "active"),
      ),
    );

  if (owners.length > 0) {
    await dispatchNotification({
      tenantId: tenant.id,
      eventKind: "booking_widget.new_lead",
      channels: ["email"],
      recipientUserIds: owners.map((o) => o.userId),
      subject: `New booking enquiry from ${lead.name}`,
      text: `You have a new booking widget enquiry from ${lead.name}${body.email ? ` (${body.email})` : ""}${body.phone ? `, ${body.phone}` : ""}.\n\n${message ?? ""}\n\nLog in to CtrlTrade to respond.`,
      vars: { leadName: lead.name, email: body.email ?? "", phone: body.phone ?? "", message: message ?? "" },
      subjectKind: "lead",
      subjectId: lead.id,
    }).catch(() => {});
  }

  if (body.email) {
    const thankYou = config.thankYouMessage ?? "Thanks for your enquiry — we'll be in touch shortly.";
    await dispatchNotification({
      tenantId: tenant.id,
      eventKind: "booking_widget.confirmation",
      channels: ["email"],
      to: { email: body.email, name: body.name },
      subject: `We've received your enquiry — ${tenant.name}`,
      text: `Hi ${body.name},\n\n${thankYou}\n\n${tenant.name}`,
      vars: { name: body.name, tenantName: tenant.name, thankYouMessage: thankYou },
    }).catch(() => {});
  }

  await emitWorkflowEvent(tenant.id, "lead.created", { leadId: lead.id, source: "booking_widget" });

  res.status(201).json({ ok: true, leadId: lead.id });
});

function buildBookingPageUrl(slug: string): string {
  const baseDomain = process.env.REPLIT_DOMAINS?.split(",")[0] || process.env.REPLIT_DEV_DOMAIN || "your-app.replit.app";
  return `https://${baseDomain}/book/${slug}`;
}

function buildEmbedCode(slug: string): string {
  const baseDomain = process.env.REPLIT_DOMAINS?.split(",")[0] || process.env.REPLIT_DEV_DOMAIN || "your-app.replit.app";
  const endpoint = `https://${baseDomain}/api/v1/public/book/${slug}`;
  return `<form action="${endpoint}" method="post" data-ctrltrade-bookform>
  <input name="name" placeholder="Full name" required />
  <input name="email" type="email" placeholder="Email" />
  <input name="phone" placeholder="Phone" />
  <input name="address" placeholder="Address" />
  <input name="jobType" placeholder="Job type" />
  <input name="preferredDate" type="date" placeholder="Preferred date" />
  <textarea name="description" placeholder="Tell us more about the work needed"></textarea>
  <button type="submit">Book now</button>
</form>
<script>(function(){var f=document.querySelector('[data-ctrltrade-bookform]');if(!f)return;f.addEventListener('submit',function(e){e.preventDefault();var d={};new FormData(f).forEach(function(v,k){d[k]=v});fetch(f.action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(function(r){if(r.ok){f.innerHTML='<p style="padding:1rem;color:green">Thanks — we will be in touch shortly.</p>'}else{alert('Sorry, please try again.')}})})})();</script>`;
}

function buildIframeCode(slug: string): string {
  const baseDomain = process.env.REPLIT_DOMAINS?.split(",")[0] || process.env.REPLIT_DEV_DOMAIN || "your-app.replit.app";
  return `<iframe src="https://${baseDomain}/book/${slug}" width="100%" height="700" frameborder="0" title="Book online"></iframe>`;
}

function buildWidgetScriptTag(slug: string): string {
  const baseDomain = process.env.REPLIT_DOMAINS?.split(",")[0] || process.env.REPLIT_DEV_DOMAIN || "your-app.replit.app";
  return `<div id="ctrltrade-widget"></div>\n<script src="https://${baseDomain}/api/v1/public/book/${slug}/widget.js" async></script>`;
}

function buildWidgetScript(apiBase: string): string {
  return `(function () {
  'use strict';
  var API_BASE = '${apiBase}';
  var containerId = 'ctrltrade-widget';

  function init() {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<p style="font-family:sans-serif;font-size:0.9rem;color:#888">Loading booking form…</p>';
    fetch(API_BASE + '/info')
      .then(function (r) {
        if (!r.ok) throw new Error('unavailable');
        return r.json();
      })
      .then(function (info) { renderForm(container, info); })
      .catch(function () {
        container.innerHTML = '<p style="font-family:sans-serif;color:#c00">Booking is currently unavailable.</p>';
      });
  }

  function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function renderForm(container, info) {
    var brand = info.brandColor || '#2563eb';
    var jobTypes = Array.isArray(info.jobTypes) ? info.jobTypes : [];
    var showDate = info.showDateField !== false;

    var css = [
      '#ct-bw-form{font-family:sans-serif;max-width:480px;padding:1.5rem;border:1px solid #e2e8f0;border-radius:6px;box-sizing:border-box;}',
      '#ct-bw-form *{box-sizing:border-box;}',
      '#ct-bw-form h2{margin:0 0 1rem;font-size:1.1rem;color:#1a202c;}',
      '#ct-bw-form label{display:block;font-size:0.8rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#4a5568;margin-bottom:0.25rem;}',
      '#ct-bw-form .ct-field{margin-bottom:0.9rem;}',
      '#ct-bw-form input,#ct-bw-form select,#ct-bw-form textarea{width:100%;padding:0.55rem 0.75rem;border:1px solid #cbd5e0;border-radius:4px;font-size:0.9rem;outline:none;transition:border-color .15s;}',
      '#ct-bw-form input:focus,#ct-bw-form select:focus,#ct-bw-form textarea:focus{border-color:' + brand + ';}',
      '#ct-bw-form textarea{resize:vertical;min-height:90px;}',
      '#ct-bw-form button[type=submit]{background:' + brand + ';color:#fff;border:none;padding:0.65rem 1.5rem;font-size:0.9rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;border-radius:4px;cursor:pointer;width:100%;margin-top:0.5rem;}',
      '#ct-bw-form button[type=submit]:hover{opacity:0.88;}',
      '#ct-bw-form .ct-success{padding:1rem;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px;color:#15803d;font-size:0.9rem;}',
      '#ct-bw-form .ct-error{padding:0.75rem;background:#fff1f2;border:1px solid #fecdd3;border-radius:4px;color:#be123c;font-size:0.85rem;margin-bottom:0.75rem;}',
    ].join('');

    var jobTypeOptions = jobTypes.length
      ? '<div class="ct-field"><label for="ct-jobType">Type of work</label><select id="ct-jobType" name="jobType"><option value="">— Select —</option>' +
        jobTypes.map(function (jt) { return '<option value="' + esc(jt) + '">' + esc(jt) + '</option>'; }).join('') +
        '</select></div>'
      : '';

    var dateField = showDate
      ? '<div class="ct-field"><label for="ct-date">Preferred date</label><input type="date" id="ct-date" name="preferredDate" /></div>'
      : '';

    container.innerHTML =
      '<style>' + css + '</style>' +
      '<form id="ct-bw-form" novalidate>' +
        '<h2>' + esc(info.tenantName) + '</h2>' +
        '<div id="ct-bw-err"></div>' +
        '<div class="ct-field"><label for="ct-name">Full name *</label><input type="text" id="ct-name" name="name" required placeholder="Jane Smith" /></div>' +
        '<div class="ct-field"><label for="ct-email">Email</label><input type="email" id="ct-email" name="email" placeholder="jane@example.com" /></div>' +
        '<div class="ct-field"><label for="ct-phone">Phone</label><input type="tel" id="ct-phone" name="phone" placeholder="+44 7700 000000" /></div>' +
        '<div class="ct-field"><label for="ct-address">Address</label><input type="text" id="ct-address" name="address" placeholder="1 High Street, London" /></div>' +
        jobTypeOptions +
        dateField +
        '<div class="ct-field"><label for="ct-desc">Tell us more</label><textarea id="ct-desc" name="description" placeholder="Describe the work needed…"></textarea></div>' +
        '<button type="submit">Send enquiry</button>' +
      '</form>';

    var form = document.getElementById('ct-bw-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var errDiv = document.getElementById('ct-bw-err');
      var btn = form.querySelector('button[type=submit]');
      var data = {};
      var fd = new FormData(form);
      fd.forEach(function (v, k) { data[k] = v; });
      if (!data.name || !String(data.name).trim()) {
        if (errDiv) errDiv.innerHTML = '<div class="ct-error">Please enter your name.</div>';
        return;
      }
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
      if (errDiv) errDiv.innerHTML = '';
      fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
        .then(function (r) {
          if (r.ok) {
            var thankYou = ${JSON.stringify("Thanks for your enquiry — we'll be in touch shortly.")};
            try { r.json().then(function() {}); } catch(e) {}
            container.innerHTML = '<style>#ct-bw-success{font-family:sans-serif;max-width:480px;padding:1.5rem;border:1px solid #bbf7d0;border-radius:6px;background:#f0fdf4;color:#15803d;}</style><div id="ct-bw-success"><p style="margin:0;font-size:1rem;">' + esc(thankYou) + '</p></div>';
          } else {
            if (btn) { btn.disabled = false; btn.textContent = 'Send enquiry'; }
            if (errDiv) errDiv.innerHTML = '<div class="ct-error">Something went wrong — please try again.</div>';
          }
        })
        .catch(function () {
          if (btn) { btn.disabled = false; btn.textContent = 'Send enquiry'; }
          if (errDiv) errDiv.innerHTML = '<div class="ct-error">Network error — please check your connection and try again.</div>';
        });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();`;
}

export default router;
