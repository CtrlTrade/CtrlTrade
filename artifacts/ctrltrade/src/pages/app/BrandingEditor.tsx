import { useEffect, useState } from "react";
import {
  useGetBranding,
  useUpdateBranding,
  getGetBrandingQueryKey,
  getGetTenantQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ObjectUploader, useUpload } from "@workspace/object-storage-web";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BrandingForm {
  primaryColor: string;
  accentColor: string;
  surfaceColor: string;
  brandColor: string;
  fontFamily: string;
  logoUrl: string;
  logoPortalUrl: string;
  logoPosUrl: string;
  faviconUrl: string;
  invoiceHeader: string;
  invoiceFooter: string;
  invoiceNotes: string;
  quoteHeader: string;
  quoteFooter: string;
  quoteNotes: string;
  emailHeader: string;
  emailSignature: string;
  posReceiptHeader: string;
  posReceiptFooter: string;
}

const empty: BrandingForm = {
  primaryColor: "",
  accentColor: "",
  surfaceColor: "",
  brandColor: "",
  fontFamily: "",
  logoUrl: "",
  logoPortalUrl: "",
  logoPosUrl: "",
  faviconUrl: "",
  invoiceHeader: "",
  invoiceFooter: "",
  invoiceNotes: "",
  quoteHeader: "",
  quoteFooter: "",
  quoteNotes: "",
  emailHeader: "",
  emailSignature: "",
  posReceiptHeader: "",
  posReceiptFooter: "",
};

function LogoUpload({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const { getUploadParameters } = useUpload();
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        {value ? (
          <img
            src={value}
            alt={label}
            className="h-16 w-16 object-contain border border-border bg-muted"
          />
        ) : (
          <div className="h-16 w-16 border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
            None
          </div>
        )}
        <ObjectUploader
          maxNumberOfFiles={1}
          maxFileSize={5 * 1024 * 1024}
          onGetUploadParameters={getUploadParameters}
          onComplete={(result) => {
            const url = (result.successful?.[0] as { uploadURL?: string } | undefined)?.uploadURL;
            if (url) onChange(url);
          }}
          buttonClassName="inline-flex items-center gap-2 uppercase tracking-wider font-bold bg-secondary text-secondary-foreground px-3 py-2 text-xs hover:opacity-90"
        >
          <Upload className="h-3 w-3" /> Upload
        </ObjectUploader>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-none text-xs"
            onClick={() => onChange("")}
          >
            Remove
          </Button>
        )}
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://…"
        className="text-xs font-mono"
      />
    </div>
  );
}

export function AppBrandingEditor() {
  const { data, isLoading } = useGetBranding();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<BrandingForm>(empty);

  useEffect(() => {
    if (!data) return;
    const t = data.brandTemplates ?? {};
    setForm({
      primaryColor: data.primaryColor ?? "",
      accentColor: data.accentColor ?? "",
      surfaceColor: data.surfaceColor ?? "",
      brandColor: data.brandColor ?? "",
      fontFamily: data.fontFamily ?? "",
      logoUrl: data.logoUrl ?? "",
      logoPortalUrl: data.logoPortalUrl ?? "",
      logoPosUrl: data.logoPosUrl ?? "",
      faviconUrl: data.faviconUrl ?? "",
      invoiceHeader: t.invoice?.header ?? "",
      invoiceFooter: t.invoice?.footer ?? "",
      invoiceNotes: t.invoice?.notes ?? "",
      quoteHeader: t.quote?.header ?? "",
      quoteFooter: t.quote?.footer ?? "",
      quoteNotes: t.quote?.notes ?? "",
      emailHeader: t.email?.header ?? "",
      emailSignature: t.email?.signature ?? "",
      posReceiptHeader: t.posReceipt?.header ?? "",
      posReceiptFooter: t.posReceipt?.footer ?? "",
    });
  }, [data]);

  const update = useUpdateBranding({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetBrandingQueryKey() });
        qc.invalidateQueries({ queryKey: getGetTenantQueryKey() });
        toast({ title: "Branding saved" });
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    update.mutate({
      data: {
        primaryColor: form.primaryColor || null,
        accentColor: form.accentColor || null,
        surfaceColor: form.surfaceColor || null,
        brandColor: form.brandColor || null,
        fontFamily: form.fontFamily || null,
        logoUrl: form.logoUrl || null,
        logoPortalUrl: form.logoPortalUrl || null,
        logoPosUrl: form.logoPosUrl || null,
        faviconUrl: form.faviconUrl || null,
        brandTemplates: {
          invoice: {
            header: form.invoiceHeader,
            footer: form.invoiceFooter,
            notes: form.invoiceNotes,
          },
          quote: {
            header: form.quoteHeader,
            footer: form.quoteFooter,
            notes: form.quoteNotes,
          },
          email: {
            header: form.emailHeader,
            signature: form.emailSignature,
          },
          posReceipt: {
            header: form.posReceiptHeader,
            footer: form.posReceiptFooter,
          },
        },
      },
    });
  }

  if (isLoading) return <Skeleton className="h-96 max-w-5xl mx-auto" />;

  const set = <K extends keyof BrandingForm>(k: K, v: BrandingForm[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  return (
    <form onSubmit={submit} className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tighter">Branding</h1>
          <p className="text-muted-foreground text-sm">
            Logos, colours, fonts and document templates applied across CRM, portal, PDFs, emails and POS.
          </p>
        </div>
        <Button
          type="submit"
          disabled={update.isPending}
          className="rounded-none uppercase tracking-wider font-bold"
          data-testid="button-save-branding"
        >
          {update.isPending ? "Saving…" : "Save branding"}
        </Button>
      </div>

      <Tabs defaultValue="visual" className="space-y-4">
        <TabsList className="rounded-none">
          <TabsTrigger value="visual" className="rounded-none uppercase">Visual</TabsTrigger>
          <TabsTrigger value="logos" className="rounded-none uppercase">Logos</TabsTrigger>
          <TabsTrigger value="templates" className="rounded-none uppercase">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="visual">
          <Card className=" border-border shadow-sm">
            <CardHeader>
              <CardTitle className="uppercase tracking-tight">Colours & Typography</CardTitle>
              <CardDescription>All values are GBP-priced, ® branding preserved.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(["primaryColor", "accentColor", "surfaceColor", "brandColor"] as const).map((k) => (
                <div key={k} className="grid grid-cols-[160px_1fr_64px] items-center gap-3">
                  <Label>{k.replace("Color", "")}</Label>
                  <Input
                    value={form[k]}
                    onChange={(e) => set(k, e.target.value)}
                    placeholder="#1A1F2C"
                    className="font-mono"
                    data-testid={`input-${k}`}
                  />
                  <Input
                    type="color"
                    value={form[k] || "#000000"}
                    onChange={(e) => set(k, e.target.value)}
                    className="h-9 p-1"
                  />
                </div>
              ))}
              <div className="grid grid-cols-[160px_1fr] items-center gap-3">
                <Label>Font family</Label>
                <Input
                  value={form.fontFamily}
                  onChange={(e) => set("fontFamily", e.target.value)}
                  placeholder="Inter, system-ui"
                  data-testid="input-fontFamily"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logos">
          <Card className=" border-border shadow-sm">
            <CardHeader>
              <CardTitle className="uppercase tracking-tight">Logos & Favicon</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-6">
              <LogoUpload label="CRM logo" value={form.logoUrl} onChange={(v) => set("logoUrl", v)} />
              <LogoUpload label="Customer portal logo" value={form.logoPortalUrl} onChange={(v) => set("logoPortalUrl", v)} />
              <LogoUpload label="POS logo" value={form.logoPosUrl} onChange={(v) => set("logoPosUrl", v)} />
              <LogoUpload label="Favicon" value={form.faviconUrl} onChange={(v) => set("faviconUrl", v)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          {([
            { k: "invoice", title: "Invoice PDF", fields: ["Header", "Footer", "Notes"] as const },
            { k: "quote", title: "Quote PDF", fields: ["Header", "Footer", "Notes"] as const },
            { k: "email", title: "Email template", fields: ["Header", "Signature"] as const },
            { k: "posReceipt", title: "POS receipt", fields: ["Header", "Footer"] as const },
          ] as const).map((block) => (
            <Card key={block.k} className=" border-border shadow-sm">
              <CardHeader>
                <CardTitle className="uppercase tracking-tight">{block.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {block.fields.map((field) => {
                  const key = `${block.k}${field}` as keyof BrandingForm;
                  return (
                    <div key={key}>
                      <Label>{field}</Label>
                      <Textarea
                        value={form[key]}
                        onChange={(e) => set(key, e.target.value)}
                        rows={field === "Notes" || field === "Footer" || field === "Signature" ? 3 : 2}
                        data-testid={`textarea-${key}`}
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </form>
  );
}
