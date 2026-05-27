import { useEffect, useState } from "react";
import { useGetMyMarketplaceListing, useUpsertMyMarketplaceListing, getGetMyMarketplaceListingQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type Form = {
  headline: string;
  bio: string;
  listingType: "contractor" | "supplier" | "both";
  categorySlugs: string;
  serviceArea: string;
  regions: string;
  hourlyRatePence: string;
  minJobValuePence: string;
  contactEmail: string;
  contactPhone: string;
  websiteUrl: string;
  galleryUrls: string;
  status: "draft" | "published" | "paused";
};

const empty: Form = {
  headline: "", bio: "", listingType: "contractor", categorySlugs: "", serviceArea: "",
  regions: "", hourlyRatePence: "", minJobValuePence: "", contactEmail: "",
  contactPhone: "", websiteUrl: "", galleryUrls: "", status: "draft",
};

export function SettingsMarketplace() {
  const { data, isLoading } = useGetMyMarketplaceListing({ query: { retry: false, queryKey: ["my-marketplace-listing"] } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<Form>(empty);

  useEffect(() => {
    if (data) {
      setForm({
        headline: data.headline,
        bio: data.bio ?? "",
        listingType: data.listingType as any,
        categorySlugs: (data.categorySlugs ?? []).join(", "),
        serviceArea: data.serviceArea ?? "",
        regions: (data.regions ?? []).join(", "),
        hourlyRatePence: data.hourlyRatePence != null ? String(data.hourlyRatePence) : "",
        minJobValuePence: data.minJobValuePence != null ? String(data.minJobValuePence) : "",
        contactEmail: data.contactEmail ?? "",
        contactPhone: data.contactPhone ?? "",
        websiteUrl: data.websiteUrl ?? "",
        galleryUrls: (data.galleryUrls ?? []).join("\n"),
        status: data.status as any,
      });
    }
  }, [data]);

  const upsert = useUpsertMyMarketplaceListing({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetMyMarketplaceListingQueryKey() });
        toast({ title: "Listing saved" });
      },
      onError: (err: any) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
    },
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      headline: form.headline,
      bio: form.bio || undefined,
      listingType: form.listingType,
      categorySlugs: form.categorySlugs.split(",").map((s) => s.trim()).filter(Boolean),
      serviceArea: form.serviceArea || undefined,
      regions: form.regions.split(",").map((s) => s.trim()).filter(Boolean),
      hourlyRatePence: form.hourlyRatePence ? Number(form.hourlyRatePence) : undefined,
      minJobValuePence: form.minJobValuePence ? Number(form.minJobValuePence) : undefined,
      contactEmail: form.contactEmail || undefined,
      contactPhone: form.contactPhone || undefined,
      websiteUrl: form.websiteUrl || undefined,
      galleryUrls: form.galleryUrls.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
      status: form.status,
    };
    upsert.mutate({ data: payload });
  };

  return (
    <div className="space-y-6">
      <Card className=" border-border">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight">Marketplace Listing</CardTitle>
          <CardDescription>Get discovered by other CtrlTrade® businesses looking for contractors or suppliers.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2"><Label>Headline</Label><Input required value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} className="rounded-none" data-testid="input-listing-headline" /></div>
            <div className="space-y-2 md:col-span-2"><Label>Bio</Label><Textarea rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="rounded-none" /></div>
            <div className="space-y-2">
              <Label>Listing type</Label>
              <Select value={form.listingType} onValueChange={(v: any) => setForm({ ...form, listingType: v })}>
                <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contractor">Contractor</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2"><Label>Categories (comma separated slugs)</Label><Input value={form.categorySlugs} onChange={(e) => setForm({ ...form, categorySlugs: e.target.value })} placeholder="plumbing, gas-fitting" className="rounded-none" /></div>
            <div className="space-y-2"><Label>Service area</Label><Input value={form.serviceArea} onChange={(e) => setForm({ ...form, serviceArea: e.target.value })} className="rounded-none" /></div>
            <div className="space-y-2"><Label>Regions (comma separated)</Label><Input value={form.regions} onChange={(e) => setForm({ ...form, regions: e.target.value })} placeholder="London, South East" className="rounded-none" /></div>
            <div className="space-y-2"><Label>Hourly rate (pence)</Label><Input type="number" value={form.hourlyRatePence} onChange={(e) => setForm({ ...form, hourlyRatePence: e.target.value })} className="rounded-none" /></div>
            <div className="space-y-2"><Label>Min job value (pence)</Label><Input type="number" value={form.minJobValuePence} onChange={(e) => setForm({ ...form, minJobValuePence: e.target.value })} className="rounded-none" /></div>
            <div className="space-y-2"><Label>Contact email</Label><Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} className="rounded-none" /></div>
            <div className="space-y-2"><Label>Contact phone</Label><Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} className="rounded-none" /></div>
            <div className="space-y-2 md:col-span-2"><Label>Website URL</Label><Input value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} className="rounded-none" /></div>
            <div className="space-y-2 md:col-span-2"><Label>Gallery image URLs (one per line)</Label><Textarea rows={3} value={form.galleryUrls} onChange={(e) => setForm({ ...form, galleryUrls: e.target.value })} className="rounded-none" /></div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={upsert.isPending} className="rounded-none uppercase tracking-wider font-bold" data-testid="button-save-listing">Save listing</Button>
            </div>
            {data?.verified && <div className="md:col-span-2"><Badge className="rounded-none uppercase tracking-wider">Verified</Badge></div>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
