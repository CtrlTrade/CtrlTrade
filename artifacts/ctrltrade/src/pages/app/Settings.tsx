import { useState } from "react";
import { useGetTenant, useUpdateTenant, useListTradeCategories, useGetLeadEmbedSnippet } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, Palette } from "lucide-react";
import { Link } from "wouter";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { IntegrationsPanel } from "./IntegrationsPanel";
import { AppStaff } from "./Staff";
import { AppNotificationsSettings } from "./NotificationsSettings";
import { SettingsReferrals } from "./SettingsReferrals";
import { SettingsMarketplace } from "./SettingsMarketplace";

export function AppSettings() {
  const { data: tenant, isLoading: tenantLoading } = useGetTenant();
  const { data: categories, isLoading: categoriesLoading } = useListTradeCategories();
  const updateTenant = useUpdateTenant();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    country: "",
    phone: "",
    addressLine1: "",
    city: "",
    postcode: "",
    brandColor: "",
    logoUrl: "",
    leadCaptureAllowedOrigins: "",
    tradeCategorySlugs: [] as string[]
  });

  // Init form
  useState(() => {
    if (tenant) {
      setFormData({
        name: tenant.name || "",
        country: tenant.country || "",
        phone: tenant.phone || "",
        addressLine1: tenant.addressLine1 || "",
        city: tenant.city || "",
        postcode: tenant.postcode || "",
        brandColor: tenant.brandColor || "",
        logoUrl: tenant.logoUrl || "",
        leadCaptureAllowedOrigins: (tenant.leadCaptureAllowedOrigins ?? []).join("\n"),
        tradeCategorySlugs: tenant.tradeCategorySlugs || []
      });
    }
  });

  if (tenantLoading || categoriesLoading) {
    return <div className="space-y-6 max-w-4xl mx-auto"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { leadCaptureAllowedOrigins, ...rest } = formData;
    const payload = {
      ...rest,
      leadCaptureAllowedOrigins: leadCaptureAllowedOrigins
        .split(/\r?\n|,/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    };
    updateTenant.mutate({ data: payload }, {
      onSuccess: () => {
        toast({ title: "Settings updated", description: "Tenant profile has been saved." });
      },
      onError: (err: any) => {
        toast({ title: "Update failed", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold uppercase tracking-tighter">Workspace Settings</h1>
      <Tabs defaultValue={typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "integrations" ? "integrations" : "company"} className="space-y-6">
        <TabsList className="rounded-none">
          <TabsTrigger value="company" data-testid="tab-company">Company</TabsTrigger>
          <TabsTrigger value="staff" data-testid="tab-staff">Staff</TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">Notifications</TabsTrigger>
          <TabsTrigger value="referrals" data-testid="tab-referrals">Referrals</TabsTrigger>
          <TabsTrigger value="marketplace" data-testid="tab-marketplace">Marketplace</TabsTrigger>
          <TabsTrigger value="integrations" data-testid="tab-integrations">Integrations</TabsTrigger>
        </TabsList>
        <TabsContent value="staff"><AppStaff /></TabsContent>
        <TabsContent value="notifications"><AppNotificationsSettings /></TabsContent>
        <TabsContent value="referrals"><SettingsReferrals /></TabsContent>
        <TabsContent value="marketplace"><SettingsMarketplace /></TabsContent>
        <TabsContent value="integrations"><IntegrationsPanel /></TabsContent>
        <TabsContent value="company">
      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="rounded-none border-border shadow-sm">
          <CardHeader>
            <CardTitle className="uppercase tracking-tight">Company Profile</CardTitle>
            <CardDescription>Core business details and contact information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required className="rounded-none" data-testid="input-settings-name"/>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="rounded-none" />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} className="rounded-none" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={formData.addressLine1} onChange={e => setFormData({...formData, addressLine1: e.target.value})} className="rounded-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="rounded-none" />
              </div>
              <div className="space-y-2">
                <Label>Postcode</Label>
                <Input value={formData.postcode} onChange={e => setFormData({...formData, postcode: e.target.value})} className="rounded-none" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-border shadow-sm">
          <CardHeader>
            <CardTitle className="uppercase tracking-tight">Brand Identity</CardTitle>
            <CardDescription>
              Logos, colours, fonts and document templates are managed in the dedicated branding editor — applied across CRM, customer portal, PDFs, emails and POS.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/app/settings/branding"
              className="inline-flex items-center gap-2 rounded-none uppercase tracking-wider font-bold bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90"
              data-testid="link-branding-editor"
            >
              <Palette className="h-4 w-4" /> Open branding editor
            </Link>
          </CardContent>
        </Card>

        <Card className="rounded-none border-border shadow-sm">
          <CardHeader>
            <CardTitle className="uppercase tracking-tight">Trade Categories</CardTitle>
            <CardDescription>Select the specific industries your company operates in.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categories?.map(cat => (
                <div key={cat.slug} className="flex items-center space-x-2 border border-border p-3 bg-background">
                  <Checkbox 
                    id={`cat-edit-${cat.slug}`} 
                    checked={formData.tradeCategorySlugs.includes(cat.slug)}
                    onCheckedChange={(checked) => {
                      if (checked) setFormData({...formData, tradeCategorySlugs: [...formData.tradeCategorySlugs, cat.slug]});
                      else setFormData({...formData, tradeCategorySlugs: formData.tradeCategorySlugs.filter(s => s !== cat.slug)});
                    }}
                    className="rounded-none"
                  />
                  <label htmlFor={`cat-edit-${cat.slug}`} className="text-sm font-bold uppercase cursor-pointer flex-1">
                    {cat.name}
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={updateTenant.isPending} className="rounded-none uppercase font-bold tracking-wider" data-testid="button-settings-save">
            {updateTenant.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </form>

      <Card className="rounded-none border-border shadow-sm">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight">Lead Capture — Allowed Domains</CardTitle>
          <CardDescription>
            One domain per line (e.g. <code>example.com</code>, <code>www.example.com</code>). Subdomains are included automatically. Leave empty to accept submissions from any origin (server-to-server and form posts without an Origin header are always accepted).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={4}
            value={formData.leadCaptureAllowedOrigins}
            onChange={(e) => setFormData({ ...formData, leadCaptureAllowedOrigins: e.target.value })}
            placeholder={"example.com\nstaging.example.com"}
            className="rounded-none font-mono text-xs"
            data-testid="textarea-allowed-origins"
          />
          <p className="text-xs text-muted-foreground mt-2">Use the Save Settings button above to apply changes.</p>
        </CardContent>
      </Card>

      <LeadCaptureSnippetCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LeadCaptureSnippetCard() {
  const { data, isLoading } = useGetLeadEmbedSnippet();
  const { toast } = useToast();
  if (isLoading || !data) return null;
  const combined = `${data.html}\n${data.script}`;
  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast({ title: `${label} copied` }),
      () => toast({ title: "Copy failed", variant: "destructive" }),
    );
  };
  return (
    <Card className="rounded-none border-border shadow-sm" data-testid="card-lead-snippet">
      <CardHeader>
        <CardTitle className="uppercase tracking-tight">Website Lead Capture</CardTitle>
        <CardDescription>
          Paste this snippet on any web page to send enquiries straight into CTRLTRADE® leads.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Endpoint</Label>
          <div className="flex gap-2">
            <Input value={data.endpoint} readOnly className="rounded-none font-mono text-xs" data-testid="input-snippet-endpoint" />
            <Button type="button" variant="outline" className="rounded-none" onClick={() => copy(data.endpoint, "Endpoint")}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>HTML snippet</Label>
          <Textarea value={combined} readOnly rows={10} className="rounded-none font-mono text-xs" data-testid="textarea-snippet" />
          <Button type="button" variant="outline" className="rounded-none uppercase tracking-wider text-xs font-bold" onClick={() => copy(combined, "Snippet")}>
            <Copy className="h-4 w-4 mr-2" /> Copy snippet
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
