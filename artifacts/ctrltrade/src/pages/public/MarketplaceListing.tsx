import { useRoute } from "wouter";
import { useGetMarketplaceListing } from "@workspace/api-client-react";
import type { MarketplaceListingDetail } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, ShieldCheck } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { PageHead } from "@/components/PageHead";

const BASE_URL = "https://ctrltrade.co.uk";

function buildJsonLd(data: MarketplaceListingDetail, slug: string) {
  const listingUrl = `${BASE_URL}/marketplace/${slug}`;

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: data.tenantName,
    url: listingUrl,
    description: data.headline ?? data.bio ?? undefined,
  };

  if (data.bio) jsonLd["description"] = data.bio;
  if (data.contactEmail) jsonLd["email"] = data.contactEmail;
  if (data.contactPhone) jsonLd["telephone"] = data.contactPhone;
  if (data.websiteUrl) jsonLd["sameAs"] = data.websiteUrl;

  const areaServed: string[] = [];
  if (data.serviceArea) areaServed.push(data.serviceArea);
  if (data.regions && data.regions.length > 0) areaServed.push(...data.regions);
  if (areaServed.length > 0) jsonLd["areaServed"] = areaServed.length === 1 ? areaServed[0] : areaServed;

  if (data.galleryUrls && data.galleryUrls.length > 0) {
    jsonLd["image"] = data.galleryUrls.length === 1 ? data.galleryUrls[0] : data.galleryUrls;
  }

  if (data.ratingAverage != null && data.reviewCount != null && data.reviewCount > 0) {
    jsonLd["aggregateRating"] = {
      "@type": "AggregateRating",
      ratingValue: data.ratingAverage.toFixed(1),
      reviewCount: data.reviewCount,
      bestRating: "5",
      worstRating: "1",
    };
  }

  if (data.reviews && data.reviews.length > 0) {
    jsonLd["review"] = data.reviews.map((r) => ({
      "@type": "Review",
      author: { "@type": "Organization", name: r.reviewerTenantName },
      reviewRating: {
        "@type": "Rating",
        ratingValue: String(r.rating),
        bestRating: "5",
        worstRating: "1",
      },
      ...(r.comment ? { reviewBody: r.comment } : {}),
    }));
  }

  return jsonLd;
}

export function MarketplaceListing() {
  const [, params] = useRoute("/marketplace/:slug");
  const slug = params?.slug ?? "";
  const { data, isLoading } = useGetMarketplaceListing(slug);
  if (isLoading) return <div className="max-w-4xl mx-auto py-12 px-4"><Skeleton className="h-96 w-full" /></div>;
  if (!data) return <div className="max-w-4xl mx-auto py-12 px-4">Listing not found.</div>;

  const pageTitle = data.headline
    ? `${data.tenantName ?? "Listing"} — ${data.headline}`
    : (data.tenantName ?? "Marketplace Listing");
  const pageDesc = data.bio
    ? data.bio.slice(0, 160)
    : `${data.tenantName} is a verified CtrlTrade® ${data.listingType ?? "business"} on the Trades Marketplace.`;
  const ogImage = data.galleryUrls && data.galleryUrls.length > 0 ? data.galleryUrls[0] : undefined;

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-6">
      <PageHead
        title={pageTitle}
        description={pageDesc}
        canonical={`/marketplace/${slug}`}
        ogImage={ogImage}
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(buildJsonLd(data, slug))}
        </script>
      </Helmet>
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{data.tenantName}</h1>
          {data.verified && <ShieldCheck className="h-6 w-6 text-primary" />}
        </div>
        <div className="text-sm text-muted-foreground">{data.listingType}</div>
        <p className="text-lg">{data.headline}</p>
        <div className="flex flex-wrap gap-2">
          {data.categorySlugs.map((c) => <Badge key={c} variant="secondary" className="rounded-xl">{c}</Badge>)}
        </div>
        {data.ratingAverage != null && (
          <div className="inline-flex items-center gap-1 text-sm"><Star className="h-4 w-4 fill-current" />{data.ratingAverage.toFixed(1)} · {data.reviewCount} reviews</div>
        )}
      </header>

      {data.bio && (
        <Card className=" border-border">
          <CardHeader><CardTitle className="">About</CardTitle></CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">{data.bio}</CardContent>
        </Card>
      )}

      <Card className=" border-border">
        <CardHeader><CardTitle className="">Service details</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3 text-sm">
          {data.serviceArea && <div><div className="text-xs text-muted-foreground">Service area</div>{data.serviceArea}</div>}
          {data.regions && data.regions.length > 0 && <div><div className="text-xs text-muted-foreground">Regions</div>{data.regions.join(", ")}</div>}
          {data.hourlyRatePence != null && <div><div className="text-xs text-muted-foreground">Hourly rate</div>£{(data.hourlyRatePence/100).toFixed(2)}</div>}
          {data.minJobValuePence != null && <div><div className="text-xs text-muted-foreground">Min job value</div>£{(data.minJobValuePence/100).toFixed(2)}</div>}
          {data.contactEmail && <div><div className="text-xs text-muted-foreground">Email</div><a className="underline" href={`mailto:${data.contactEmail}`}>{data.contactEmail}</a></div>}
          {data.contactPhone && <div><div className="text-xs text-muted-foreground">Phone</div>{data.contactPhone}</div>}
          {data.websiteUrl && <div className="sm:col-span-2"><div className="text-xs text-muted-foreground">Website</div><a className="underline" href={data.websiteUrl} target="_blank" rel="noreferrer">{data.websiteUrl}</a></div>}
        </CardContent>
      </Card>

      {data.galleryUrls && data.galleryUrls.length > 0 && (
        <Card className=" border-border">
          <CardHeader><CardTitle className="">Gallery</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {data.galleryUrls.map((url, index) => <img key={url} src={url} alt={`${data.tenantName} gallery image ${index + 1}`} className="w-full h-40 object-cover" />)}
          </CardContent>
        </Card>
      )}

      <Card className=" border-border">
        <CardHeader><CardTitle className="">Reviews</CardTitle></CardHeader>
        <CardContent>
          {!data.reviews || data.reviews.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No reviews yet.</div>
          ) : (
            <ul className="space-y-4">
              {data.reviews.map((r) => (
                <li key={r.id} className="border-t border-border pt-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{r.reviewerTenantName}</div>
                    <div className="inline-flex items-center gap-1 text-sm"><Star className="h-3 w-3 fill-current" />{r.rating}</div>
                  </div>
                  {r.comment && <p className="text-sm text-muted-foreground mt-1">{r.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
