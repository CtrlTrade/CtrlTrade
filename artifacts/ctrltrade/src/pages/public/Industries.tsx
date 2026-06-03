import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useListTradeCategories } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrench, ArrowRight, CheckCircle2 } from "lucide-react";

const seoLandingPages: Record<string, string> = {
  roofing: "/roofing-crm",
  electrical: "/electrical-crm",
  plumbing: "/plumbing-crm",
  hvac: "/hvac-crm",
  building: "/builders-crm",
  construction: "/builders-crm",
  cleaning: "/cleaning-crm",
  "facilities management": "/facilities-management-crm",
};

const featuredIndustries = [
  {
    slug: "roofing",
    name: "Roofing",
    href: "/roofing-crm",
    features: ["Roof Surveys", "Flat Roof Quotes", "Height Safety Records", "Before/After Photos"],
    desc: "CRM built for roofing contractors — flat, pitched, commercial, and specialist roofing.",
  },
  {
    slug: "electrical",
    name: "Electrical",
    href: "/electrical-crm",
    features: ["EICR Certificates", "EV Charger Installs", "NICEIC Compliance Forms", "Test Results"],
    desc: "CRM for electrical contractors — domestic, commercial, and industrial installations.",
  },
  {
    slug: "plumbing",
    name: "Plumbing",
    href: "/plumbing-crm",
    features: ["Boiler Servicing", "Gas Safety Records", "Leak Repairs", "Service Contracts"],
    desc: "CRM for plumbing and heating engineers — gas safety, boiler servicing, and repairs.",
  },
  {
    slug: "hvac",
    name: "HVAC",
    href: "/hvac-crm",
    features: ["F-Gas Compliance", "Maintenance Contracts", "Commissioning Records", "Equipment Register"],
    desc: "CRM for HVAC contractors — air conditioning, refrigeration, and ventilation.",
  },
  {
    slug: "building",
    name: "Building & Construction",
    href: "/builders-crm",
    features: ["Project Management", "Subcontractor Management", "Building Regs Compliance", "Cost Tracking"],
    desc: "CRM for builders and construction companies — from loft conversions to commercial builds.",
  },
  {
    slug: "cleaning",
    name: "Cleaning",
    href: "/cleaning-crm",
    features: ["Recurring Contracts", "Staff Rostering", "COSHH Records", "Quality Inspections"],
    desc: "CRM for cleaning contractors — commercial, domestic, and specialist cleaning.",
  },
];

export function Industries() {
  const { data: categories, isLoading } = useListTradeCategories();

  return (
    <div className="flex flex-col min-h-screen">
      <section className="py-24 relative overflow-hidden" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(hsl(46,98%,52%) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="container mx-auto px-4 text-center max-w-4xl relative z-10">
          <div className="inline-block px-4 py-1 mb-8 border border-[hsl(46,98%,52%)] text-[hsl(46,98%,52%)] font-bold text-xs tracking-widest">
            INDUSTRIES
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">Built For Your Trade</h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto" style={{ color: "hsl(220,25%,62%)" }}>
            CtrlTrade® adapts to the specific workflows, compliance requirements, and terminology of your trade. Not a generic CRM bolted on.
          </p>
        </div>
      </section>

      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Industry-Specific Editions</h2>
            <p className="text-muted-foreground text-lg">Purpose-built workflows for the most common trade categories.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredIndustries.map((ind, i) => (
              <Link key={i} href={ind.href} className="block group">
                <div className="border border-border bg-card p-8 h-full hover:border-primary transition-colors">
                  <div className="h-12 w-12 bg-muted flex items-center justify-center mb-5 text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Wrench className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{ind.name}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{ind.desc}</p>
                  <ul className="space-y-1.5 mb-5">
                    {ind.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <span className="text-sm font-semibold text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                    Learn more <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-card border-t border-border">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">All Supported Trade Categories</h2>
            <p className="text-muted-foreground">CtrlTrade® supports every trade category with relevant job types, forms, and compliance workflows.</p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-40" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {categories?.map((cat) => {
                const slug = cat.slug?.toLowerCase() ?? "";
                const name = cat.name?.toLowerCase() ?? "";
                const href = seoLandingPages[slug] ?? seoLandingPages[name] ?? "/industries";
                return (
                  <div key={cat.id} className="border border-border bg-background p-6 hover:border-primary transition-colors group">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 bg-muted flex items-center justify-center text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Wrench className="h-5 w-5" />
                      </div>
                      <h3 className="text-lg font-bold" data-testid={`category-${cat.slug}`}>{cat.name}</h3>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {cat.jobTypes.slice(0, 4).map((jt) => (
                        <span key={jt} className="text-xs bg-secondary/10 text-secondary-foreground px-2 py-1 font-mono">
                          {jt}
                        </span>
                      ))}
                      {cat.jobTypes.length > 4 && (
                        <span className="text-xs bg-secondary/10 text-secondary-foreground px-2 py-1 font-mono">
                          +{cat.jobTypes.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="py-24" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h2 className="text-4xl font-bold mb-6">Built For Your Trade</h2>
          <p className="text-xl mb-10" style={{ color: "hsl(220,25%,62%)" }}>Start your free 1 month trial — configured for your industry from day one.</p>
          <Link href="/signup">
            <Button size="lg" className="rounded-xl h-14 px-10 font-bold">
              Start Free 1 Month Trial <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
