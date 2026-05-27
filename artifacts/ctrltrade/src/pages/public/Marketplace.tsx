import { useState } from "react";
import { Link } from "wouter";
import { useSearchMarketplace } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, ShieldCheck } from "lucide-react";

export function Marketplace() {
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("any");
  const { data, isLoading } = useSearchMarketplace({ q: q || undefined, type: type === "any" ? undefined : type });

  return (
    <div className="max-w-6xl mx-auto py-12 px-4 space-y-8">
      <header>
        <h1 className="text-4xl font-bold uppercase tracking-tighter">Trades Marketplace</h1>
        <p className="text-muted-foreground mt-2">Verified CtrlTrade® contractors and suppliers.</p>
      </header>
      <div className="flex flex-col md:flex-row gap-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by keyword" className="rounded-none" data-testid="input-marketplace-search" />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="rounded-none md:w-56"><SelectValue placeholder="Any type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any type</SelectItem>
            <SelectItem value="contractor">Contractor</SelectItem>
            <SelectItem value="supplier">Supplier</SelectItem>
            <SelectItem value="both">Both</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data ?? []).map((l) => (
            <Link key={l.id} href={`/marketplace/${l.slug}`}>
              <Card className=" border-border hover:border-foreground transition-colors cursor-pointer h-full" data-testid={`card-listing-${l.slug}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="uppercase tracking-tight text-lg">{l.tenantName}</CardTitle>
                    {l.verified && <ShieldCheck className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{l.listingType}</div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm">{l.headline}</p>
                  <div className="flex flex-wrap gap-1">
                    {l.categorySlugs.slice(0, 3).map((c) => <Badge key={c} variant="secondary" className="rounded-none uppercase tracking-wider text-xs">{c}</Badge>)}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {l.ratingAverage != null && (
                      <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-current" />{l.ratingAverage.toFixed(1)} ({l.reviewCount})</span>
                    )}
                    {l.serviceArea && <span>· {l.serviceArea}</span>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {(!data || data.length === 0) && <div className="text-muted-foreground col-span-full text-center py-12">No listings match your search.</div>}
        </div>
      )}
    </div>
  );
}
