import { useState } from "react";
import { useRoute, Link } from "wouter";
import {
  useGetCustomer,
  useUpdateCustomer,
  useGetTenantTradeCategories,
  getGetCustomerQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FileAttachments } from "@/components/FileAttachments";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  StickyNote,
  Pencil,
  Check,
  X,
  Wrench,
} from "lucide-react";
import { getActivePlugins, type PluginField } from "@/lib/tradePlugins";

export function AppCustomerDetail() {
  const [, params] = useRoute("/customers/:id");
  const customerId = params?.id ?? "";
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: customer, isLoading: isLoadingCustomer } = useGetCustomer(customerId);
  const { data: tradeProfile, isLoading: isLoadingTrades } = useGetTenantTradeCategories();
  const update = useUpdateCustomer();

  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});

  const isLoading = isLoadingCustomer || isLoadingTrades;

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <Link href="/app/customers">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Customers
          </Button>
        </Link>
        <p className="text-muted-foreground">Customer not found.</p>
      </div>
    );
  }

  const tradeSlugs = tradeProfile?.tradeSlugs ?? [];
  const activePlugins = getActivePlugins(tradeSlugs);
  const pluginData: Record<string, unknown> = (customer.pluginData as Record<string, unknown>) ?? {};

  function startEdit(section: string, initialValues: Record<string, string>) {
    setEditingSection(section);
    setDraftValues(initialValues);
  }

  function cancelEdit() {
    setEditingSection(null);
    setDraftValues({});
  }

  function saveSection(section: string, payload: Record<string, unknown>) {
    update.mutate(
      { customerId, data: payload as unknown as Parameters<typeof update.mutate>[0]["data"] },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetCustomerQueryKey(customerId) });
          toast({ title: "Saved" });
          setEditingSection(null);
          setDraftValues({});
        },
        onError: (e: Error) => toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
      },
    );
  }

  function saveCoreSection(fields: string[]) {
    const payload: Record<string, string | undefined> = {};
    for (const f of fields) payload[f] = draftValues[f] || undefined;
    saveSection("core-" + fields[0], payload);
  }

  function savePluginSection(slug: string) {
    const existingPlugin = (pluginData[slug] as Record<string, unknown>) ?? {};
    const updated = { ...existingPlugin, ...draftValues };
    saveSection(slug, { pluginData: { ...pluginData, [slug]: updated } });
  }

  const isEditing = (section: string) => editingSection === section;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/app/customers">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Customers
          </Button>
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{customer.name}</h1>
          {customer.city && (
            <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {customer.city}{customer.postcode ? `, ${customer.postcode}` : ""}
            </p>
          )}
        </div>
        <div className="text-xs text-muted-foreground font-mono shrink-0 pt-1">
          Customer since {new Date(customer.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">

          {/* ── Contact ─────────────────────────────────────────────── */}
          <SectionCard
            title="Contact"
            icon={<Mail className="h-4 w-4" />}
            sectionKey="contact"
            editing={isEditing("contact")}
            saving={update.isPending}
            onEdit={() => startEdit("contact", {
              name: customer.name ?? "",
              email: customer.email ?? "",
              phone: customer.phone ?? "",
            })}
            onCancel={cancelEdit}
            onSave={() => saveCoreSection(["name", "email", "phone"])}
          >
            {isEditing("contact") ? (
              <div className="space-y-3">
                <Field label="Name">
                  <Input value={draftValues["name"] ?? ""} onChange={(e) => setDraftValues((p) => ({ ...p, name: e.target.value }))} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Email">
                    <Input type="email" value={draftValues["email"] ?? ""} onChange={(e) => setDraftValues((p) => ({ ...p, email: e.target.value }))} />
                  </Field>
                  <Field label="Phone">
                    <Input value={draftValues["phone"] ?? ""} onChange={(e) => setDraftValues((p) => ({ ...p, phone: e.target.value }))} />
                  </Field>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                <InfoRow icon={<Mail className="h-4 w-4 text-muted-foreground" />} label="Email" value={customer.email} />
                <InfoRow icon={<Phone className="h-4 w-4 text-muted-foreground" />} label="Phone" value={customer.phone} />
              </div>
            )}
          </SectionCard>

          {/* ── Address ─────────────────────────────────────────────── */}
          <SectionCard
            title="Address"
            icon={<MapPin className="h-4 w-4" />}
            sectionKey="address"
            editing={isEditing("address")}
            saving={update.isPending}
            onEdit={() => startEdit("address", {
              addressLine1: customer.addressLine1 ?? "",
              city: customer.city ?? "",
              postcode: customer.postcode ?? "",
            })}
            onCancel={cancelEdit}
            onSave={() => saveCoreSection(["addressLine1", "city", "postcode"])}
          >
            {isEditing("address") ? (
              <div className="space-y-3">
                <Field label="Address Line 1">
                  <Input value={draftValues["addressLine1"] ?? ""} onChange={(e) => setDraftValues((p) => ({ ...p, addressLine1: e.target.value }))} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="City">
                    <Input value={draftValues["city"] ?? ""} onChange={(e) => setDraftValues((p) => ({ ...p, city: e.target.value }))} />
                  </Field>
                  <Field label="Postcode">
                    <Input className="uppercase" value={draftValues["postcode"] ?? ""} onChange={(e) => setDraftValues((p) => ({ ...p, postcode: e.target.value }))} />
                  </Field>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground space-y-0.5">
                {customer.addressLine1 && <p>{customer.addressLine1}</p>}
                {(customer.city || customer.postcode) && (
                  <p>{[customer.city, customer.postcode].filter(Boolean).join(", ")}</p>
                )}
                {!customer.addressLine1 && !customer.city && !customer.postcode && (
                  <p className="italic">No address recorded.</p>
                )}
              </div>
            )}
          </SectionCard>

          {/* ── Notes ───────────────────────────────────────────────── */}
          <SectionCard
            title="Notes"
            icon={<StickyNote className="h-4 w-4" />}
            sectionKey="notes"
            editing={isEditing("notes")}
            saving={update.isPending}
            onEdit={() => startEdit("notes", { notes: customer.notes ?? "" })}
            onCancel={cancelEdit}
            onSave={() => saveCoreSection(["notes"])}
          >
            {isEditing("notes") ? (
              <Textarea
                rows={4}
                value={draftValues["notes"] ?? ""}
                onChange={(e) => setDraftValues((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Internal notes about this customer…"
              />
            ) : (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {customer.notes || <span className="italic">No notes yet.</span>}
              </p>
            )}
          </SectionCard>

          {/* ── Trade Plugins ────────────────────────────────────────── */}
          {activePlugins.map((plugin) => {
            const sectionKey = `plugin-${plugin.slug}`;
            const stored = (pluginData[plugin.slug] as Record<string, string>) ?? {};
            return (
              <SectionCard
                key={plugin.slug}
                title={plugin.label}
                icon={<Wrench className="h-4 w-4" />}
                badge="trade"
                sectionKey={sectionKey}
                editing={isEditing(sectionKey)}
                saving={update.isPending}
                onEdit={() => {
                  const initial: Record<string, string> = {};
                  for (const f of plugin.fields) {
                    const v = stored[f.key];
                    initial[f.key] = v != null ? String(v) : "";
                  }
                  startEdit(sectionKey, initial);
                }}
                onCancel={cancelEdit}
                onSave={() => savePluginSection(plugin.slug)}
              >
                {isEditing(sectionKey) ? (
                  <PluginEditForm
                    fields={plugin.fields}
                    values={draftValues}
                    onChange={(k, v) => setDraftValues((p) => ({ ...p, [k]: v }))}
                  />
                ) : (
                  <PluginViewGrid fields={plugin.fields} stored={stored} />
                )}
              </SectionCard>
            );
          })}

          {activePlugins.length === 0 && (
            <Card className="border-border border-dashed">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No trade plugins active. Trade-specific fields will appear here once trade categories are configured in Business Setup.
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href={`/app/quotes?customerId=${customer.id}`}>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs font-bold">
                  New Quote
                </Button>
              </Link>
              <Link href={`/app/jobs?customerId=${customer.id}`}>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs font-bold">
                  New Job
                </Button>
              </Link>
              <Link href={`/app/invoices?customerId=${customer.id}`}>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs font-bold">
                  New Invoice
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Active Plugins</CardTitle>
            </CardHeader>
            <CardContent>
              {tradeSlugs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No trade categories configured.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {activePlugins.map((p) => (
                    <span key={p.slug} className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 font-mono">
                      {p.label}
                    </span>
                  ))}
                  {tradeSlugs.filter((s) => !activePlugins.find((p) => p.slug === s)).map((s) => (
                    <span key={s} className="text-[10px] font-bold bg-muted text-muted-foreground border border-border px-1.5 py-0.5 font-mono">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <FileAttachments
        parentKind="customer"
        parentId={customer.id}
        kind="customer_file"
        title={`Files — ${customer.name}`}
      />
    </div>
  );
}

function SectionCard({
  title,
  icon,
  badge,
  sectionKey,
  editing,
  saving,
  onEdit,
  onCancel,
  onSave,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  badge?: string;
  sectionKey: string;
  editing: boolean;
  saving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border shadow-sm" data-testid={`section-${sectionKey}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            {icon}
            {title}
            {badge && (
              <span className="text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5">
                {badge}
              </span>
            )}
          </CardTitle>
          {editing ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={onCancel}
                disabled={saving}
              >
                <X className="h-3 w-3 mr-1" /> Cancel
              </Button>
              <Button size="sm" className="h-7 px-3 text-xs font-bold" onClick={onSave} disabled={saving}>
                <Check className="h-3 w-3 mr-1" /> {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={onEdit}
              data-testid={`edit-${sectionKey}`}
            >
              <Pencil className="h-3 w-3 mr-1" /> Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function InfoRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex items-center gap-3 py-2.5 text-sm">
      <span className="shrink-0">{icon}</span>
      <span className="text-muted-foreground w-20 shrink-0">{label}</span>
      <span className={value ? "font-medium" : "text-muted-foreground italic"}>{value || "—"}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}

function PluginEditForm({
  fields,
  values,
  onChange,
}: {
  fields: PluginField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {fields.map((f) => (
        <div
          key={f.key}
          className={f.type === "textarea" ? "sm:col-span-2" : ""}
        >
          <Field label={f.unit ? `${f.label} (${f.unit})` : f.label}>
            {f.type === "textarea" ? (
              <Textarea
                rows={3}
                value={values[f.key] ?? ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                placeholder={f.placeholder}
              />
            ) : f.type === "select" ? (
              <Select
                value={values[f.key] ?? ""}
                onValueChange={(v) => onChange(f.key, v)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {f.options!.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : f.type === "boolean" ? (
              <Select
                value={values[f.key] ?? ""}
                onValueChange={(v) => onChange(f.key, v)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            ) : f.type === "date" ? (
              <Input
                type="date"
                value={values[f.key] ?? ""}
                onChange={(e) => onChange(f.key, e.target.value)}
              />
            ) : f.type === "number" ? (
              <Input
                type="number"
                value={values[f.key] ?? ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                placeholder={f.placeholder}
              />
            ) : (
              <Input
                type="text"
                value={values[f.key] ?? ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                placeholder={f.placeholder}
              />
            )}
          </Field>
        </div>
      ))}
    </div>
  );
}

function PluginViewGrid({
  fields,
  stored,
}: {
  fields: PluginField[];
  stored: Record<string, string>;
}) {
  const populated = fields.filter((f) => {
    const v = stored[f.key];
    return v != null && v !== "";
  });

  if (populated.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No data recorded yet. Click Edit to fill in trade-specific details.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
      {fields.map((f) => {
        const v = stored[f.key];
        if (!v) return null;
        const display = f.type === "boolean"
          ? (v === "yes" ? "Yes" : v === "no" ? "No" : "Unknown")
          : f.type === "date"
          ? new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
          : v;
        return (
          <div key={f.key} className={`flex items-start gap-2 py-1.5 text-sm border-b border-border/50 last:border-0 ${f.type === "textarea" ? "sm:col-span-2 flex-col gap-0.5" : ""}`}>
            <span className="text-muted-foreground shrink-0 min-w-0">{f.label}{f.unit ? ` (${f.unit})` : ""}</span>
            <span className="font-medium ml-auto text-right">{display}</span>
          </div>
        );
      })}
    </div>
  );
}
