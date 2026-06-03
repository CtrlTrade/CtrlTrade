import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useListTradeCategories } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, ChevronDown, ChevronUp, Search } from "lucide-react";

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

interface Industry {
  name: string;
  subCategories: string[];
  seoHref?: string;
}

const industries: Industry[] = [
  {
    name: "Construction & Building",
    seoHref: "/builders-crm",
    subCategories: [
      "General Builder", "Building Contractor", "Main Contractor", "Sub Contractor",
      "Property Developer", "House Builder", "Commercial Builder", "Industrial Builder",
      "Civil Engineering Contractor", "Groundworks Contractor", "Demolition Contractor",
      "Structural Contractor", "Refurbishment Contractor", "Renovation Contractor",
      "Restoration Contractor", "Extension Builder", "Loft Conversion Specialist",
      "Basement Conversion Specialist", "New Build Contractor",
    ],
  },
  {
    name: "Builders Merchants",
    seoHref: "/builders-merchants-crm",
    subCategories: [
      "Independent Builders Merchant", "National Builders Merchant", "Regional Builders Merchant",
      "Online Builders Merchant", "Trade Merchant", "Building Supplies Merchant",
      "Construction Materials Merchant", "Merchant Group", "Trade Distribution Centre",
    ],
  },
  {
    name: "Brick, Block & Masonry",
    seoHref: "/masonry-crm",
    subCategories: [
      "Bricklayer", "Brick Merchant", "Block Supplier", "Masonry Supplier",
      "Stone Merchant", "Stone Mason", "Concrete Product Supplier", "Paving Supplier",
      "Pointing Specialist", "Restoration Mason",
    ],
  },
  {
    name: "Timber & Sheet Materials",
    seoHref: "/timber-merchants-crm",
    subCategories: [
      "Timber Merchant", "Timber Yard", "Timber Importer", "Timber Distributor",
      "Hardwood Supplier", "Softwood Supplier", "MDF Supplier", "Plywood Supplier",
      "OSB Supplier", "Timber Frame Supplier", "Sawmill",
    ],
  },
  {
    name: "Roofing",
    seoHref: "/roofing-crm",
    subCategories: [
      "Roofing Contractor", "Roofing Merchant", "Flat Roofing Specialist",
      "Slate Roofing Specialist", "Tile Roofing Specialist", "Roof Repair Contractor",
      "Roof Surveyor", "Guttering Specialist", "Fascia Specialist",
      "Soffit Specialist", "Leadwork Contractor", "Chimney Specialist",
    ],
  },
  {
    name: "Plumbing",
    seoHref: "/plumbing-crm",
    subCategories: [
      "Plumber", "Plumbing Contractor", "Plumbing Merchant", "Plumbing Distributor",
      "Water Systems Installer", "Water Treatment Specialist", "Pipework Contractor",
      "Leak Detection Specialist", "Drainage Contractor", "Drainage Supplier",
    ],
  },
  {
    name: "Heating & Gas",
    seoHref: "/heating-gas-crm",
    subCategories: [
      "Heating Engineer", "Gas Engineer", "Boiler Installer", "Boiler Repair Specialist",
      "Boiler Merchant", "Heating Merchant", "Heating Distributor", "LPG Specialist",
      "Oil Heating Specialist", "Underfloor Heating Installer", "Radiator Supplier",
    ],
  },
  {
    name: "Electrical",
    seoHref: "/electrical-crm",
    subCategories: [
      "Electrician", "Electrical Contractor", "Electrical Wholesaler", "Electrical Distributor",
      "Domestic Electrician", "Commercial Electrician", "Industrial Electrician",
      "Lighting Contractor", "Lighting Supplier", "Cable Supplier",
      "Switchgear Supplier", "Electrical Manufacturer",
    ],
  },
  {
    name: "Renewable Energy",
    seoHref: "/renewable-energy-crm",
    subCategories: [
      "Solar Installer", "Solar Distributor", "Solar Merchant", "Heat Pump Installer",
      "Battery Storage Installer", "EV Charger Installer", "EV Infrastructure Provider",
      "Renewable Energy Contractor", "Renewable Equipment Supplier",
    ],
  },
  {
    name: "HVAC",
    seoHref: "/hvac-crm",
    subCategories: [
      "HVAC Contractor", "Air Conditioning Installer", "Air Conditioning Supplier",
      "Ventilation Contractor", "Ventilation Supplier", "Refrigeration Contractor",
      "Refrigeration Supplier", "Ductwork Manufacturer",
    ],
  },
  {
    name: "Security & Fire",
    seoHref: "/security-fire-crm",
    subCategories: [
      "CCTV Installer", "CCTV Supplier", "Alarm Installer", "Alarm Supplier",
      "Access Control Installer", "Access Control Supplier", "Locksmith",
      "Security Contractor", "Fire Alarm Installer", "Fire Protection Contractor",
      "Fire Equipment Supplier", "Fire Extinguisher Supplier",
    ],
  },
  {
    name: "Windows, Doors & Conservatories",
    seoHref: "/windows-doors-crm",
    subCategories: [
      "Window Installer", "Window Manufacturer", "Window Supplier",
      "Door Installer", "Door Manufacturer", "Door Supplier",
      "Conservatory Installer", "Conservatory Manufacturer", "Glass Merchant",
      "Double Glazing Installer", "Aluminium Systems Supplier", "UPVC Supplier",
    ],
  },
  {
    name: "Kitchens",
    seoHref: "/kitchens-crm",
    subCategories: [
      "Kitchen Showroom", "Kitchen Supplier", "Kitchen Installer",
      "Kitchen Designer", "Kitchen Manufacturer", "Worktop Supplier", "Appliance Supplier",
    ],
  },
  {
    name: "Bathrooms",
    seoHref: "/bathrooms-crm",
    subCategories: [
      "Bathroom Showroom", "Bathroom Supplier", "Bathroom Installer",
      "Bathroom Designer", "Bathroom Manufacturer",
    ],
  },
  {
    name: "Flooring",
    seoHref: "/flooring-crm",
    subCategories: [
      "Flooring Showroom", "Flooring Supplier", "Flooring Warehouse", "Carpet Supplier",
      "Carpet Fitter", "Vinyl Flooring Specialist", "Laminate Flooring Specialist",
      "Hardwood Flooring Specialist", "Resin Flooring Specialist", "Tile Flooring Specialist",
    ],
  },
  {
    name: "Tiles",
    seoHref: "/tiles-crm",
    subCategories: [
      "Tile Centre", "Tile Supplier", "Tile Warehouse", "Tile Importer",
      "Tile Distributor", "Tiling Contractor",
    ],
  },
  {
    name: "Decorating",
    seoHref: "/decorating-crm",
    subCategories: [
      "Painter", "Decorator", "Decorating Contractor", "Paint Supplier",
      "Decorating Centre", "Wallpaper Specialist", "Spray Finishing Specialist",
    ],
  },
  {
    name: "Landscaping",
    seoHref: "/landscaping-crm",
    subCategories: [
      "Landscaper", "Landscape Contractor", "Garden Designer", "Landscape Architect",
      "Turf Supplier", "Artificial Grass Supplier", "Fencing Supplier",
      "Decking Supplier", "Outdoor Living Supplier", "Garden Centre",
    ],
  },
  {
    name: "Fencing & Gates",
    seoHref: "/fencing-crm",
    subCategories: [
      "Fencing Contractor", "Fencing Supplier", "Gate Installer", "Gate Manufacturer",
      "Gate Automation Specialist", "Timber Fencing Specialist", "Metal Fencing Specialist",
      "Security Fencing Specialist", "Agricultural Fencing Specialist",
    ],
  },
  {
    name: "Steel & Metal",
    seoHref: "/steel-metal-crm",
    subCategories: [
      "Steel Supplier", "Steel Fabricator", "Metal Merchant", "Sheet Metal Supplier",
      "Aluminium Supplier", "Stainless Steel Supplier", "Welding Supplier", "Fabrication Workshop",
    ],
  },
  {
    name: "Industrial Supplies",
    seoHref: "/industrial-supplies-crm",
    subCategories: [
      "Industrial Distributor", "MRO Supplier", "Industrial Fastener Supplier",
      "Industrial Hose Supplier", "Bearing Supplier", "Hydraulics Supplier",
      "Pneumatics Supplier", "Industrial Tools Supplier",
    ],
  },
  {
    name: "Tools & Equipment",
    seoHref: "/tools-equipment-crm",
    subCategories: [
      "Tool Shop", "Tool Merchant", "Tool Wholesaler", "Power Tool Supplier",
      "Hand Tool Supplier", "Tool Repair Centre", "Tool Hire Centre",
    ],
  },
  {
    name: "Plant & Machinery",
    seoHref: "/plant-machinery-crm",
    subCategories: [
      "Plant Hire Company", "Machinery Dealer", "Construction Equipment Supplier",
      "Access Equipment Supplier", "Generator Supplier", "Heavy Equipment Dealer",
      "Machinery Repair Specialist",
    ],
  },
  {
    name: "Workwear & PPE",
    seoHref: "/workwear-ppe-crm",
    subCategories: [
      "Workwear Supplier", "PPE Supplier", "Safety Equipment Supplier",
      "Uniform Supplier", "Branded Clothing Supplier",
    ],
  },
  {
    name: "Cleaning & Janitorial",
    seoHref: "/cleaning-crm",
    subCategories: [
      "Commercial Cleaning Contractor", "Domestic Cleaning Contractor",
      "Industrial Cleaning Specialist", "Window Cleaning Contractor",
      "Janitorial Supplies Distributor", "COSHH Compliance Specialist",
      "Waste Management Contractor", "Facilities Cleaning Service",
    ],
  },
  {
    name: "Automotive",
    seoHref: "/automotive-crm",
    subCategories: [
      "Motor Factor", "Vehicle Parts Supplier", "Commercial Vehicle Parts Supplier",
      "Fleet Services Provider", "Garage Equipment Supplier", "Tyre Centre",
      "Auto Electrical Supplier",
    ],
  },
  {
    name: "Warehousing",
    seoHref: "/warehousing-crm",
    subCategories: [
      "Trade Warehouse", "Distribution Warehouse", "Regional Distribution Centre",
      "National Distribution Centre", "Trade Cash & Carry", "Fulfilment Centre",
      "Importer", "Exporter", "Wholesale Distributor",
    ],
  },
  {
    name: "Distribution",
    seoHref: "/distribution-crm",
    subCategories: [
      "Trade Distribution Centre", "Wholesale Distributor", "National Distribution Centre",
      "Regional Distribution Centre", "Trade Logistics Company", "Importer", "Exporter",
    ],
  },
  {
    name: "Manufacturing",
    seoHref: "/manufacturing-crm",
    subCategories: [
      "Building Products Manufacturer", "Timber Manufacturer", "Kitchen Manufacturer",
      "Bathroom Manufacturer", "Window Manufacturer", "Door Manufacturer",
      "Glass Manufacturer", "Steel Manufacturer", "Modular Building Manufacturer",
    ],
  },
  {
    name: "Cabins & Modular Buildings",
    seoHref: "/cabins-modular-crm",
    subCategories: [
      "Cabin Manufacturer", "Garden Room Builder", "Modular Building Supplier",
      "Portable Building Supplier", "Holiday Lodge Manufacturer",
      "Glamping Pod Manufacturer", "Tiny Home Builder", "Park Home Manufacturer",
    ],
  },
  {
    name: "Agricultural",
    seoHref: "/agricultural-crm",
    subCategories: [
      "Agricultural Merchant", "Farm Supplies Merchant", "Agricultural Machinery Supplier",
      "Livestock Equipment Supplier", "Irrigation Supplier",
    ],
  },
  {
    name: "Trade Counters",
    seoHref: "/trade-counter-epos",
    subCategories: [
      "Builders Trade Counter", "Electrical Trade Counter", "Plumbing Trade Counter",
      "Timber Trade Counter", "Roofing Trade Counter", "Flooring Trade Counter",
      "Tool Trade Counter", "Multi-Trade Counter",
    ],
  },
  {
    name: "Showrooms",
    seoHref: "/showrooms-crm",
    subCategories: [
      "Kitchen Showroom", "Bathroom Showroom", "Flooring Showroom", "Lighting Showroom",
      "Renewable Energy Showroom", "Door Showroom", "Window Showroom",
      "Home Improvement Showroom", "Outdoor Living Showroom",
    ],
  },
  {
    name: "Specialist Trades",
    seoHref: "/specialist-trades-crm",
    subCategories: [
      "Scaffolder", "Surveyor", "Quantity Surveyor", "Structural Engineer",
      "Building Inspector", "Damp Proofing Specialist", "Waterproofing Specialist",
      "Asbestos Contractor", "Lift Installer", "Escalator Contractor",
      "Signage Contractor", "Shopfitter", "Partitioning Contractor",
      "Ceiling Contractor", "Acoustic Specialist",
    ],
  },
  {
    name: "Logistics & Transport",
    seoHref: "/logistics-crm",
    subCategories: [
      "Haulage Company", "Pallet Distribution", "Courier Company",
      "Trade Delivery Network", "Fleet Operator", "Construction Logistics Provider",
    ],
  },
];

function IndustryCard({ industry, isOpen, onToggle }: {
  industry: Industry;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`border bg-card transition-colors ${isOpen ? "border-primary" : "border-border hover:border-primary/50"}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-5 flex items-start justify-between gap-3 focus:outline-none"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-base leading-snug">{industry.name}</span>
            {industry.seoHref && (
              <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 border border-primary text-primary uppercase shrink-0">
                SEO
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground mt-0.5 block">
            {industry.subCategories.length} sub-categories
          </span>
        </div>
        <div className="shrink-0 mt-0.5 text-muted-foreground">
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="px-5 pb-5 border-t border-border/50">
          <div className="flex flex-wrap gap-1.5 pt-4">
            {industry.subCategories.map((sub) => (
              <span
                key={sub}
                className="text-xs bg-muted text-muted-foreground px-2 py-1 leading-tight hover:bg-primary hover:text-primary-foreground transition-colors cursor-default"
              >
                {sub}
              </span>
            ))}
          </div>
          {industry.seoHref && (
            <Link
              href={industry.seoHref}
              className="inline-flex items-center gap-1 mt-4 text-xs font-semibold text-primary hover:underline"
            >
              View {industry.name} edition <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export function Industries() {
  const { data: categories, isLoading } = useListTradeCategories();
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const filteredIndustries = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return industries;
    return industries.filter(
      (ind) =>
        ind.name.toLowerCase().includes(q) ||
        ind.subCategories.some((s) => s.toLowerCase().includes(q))
    );
  }, [search]);

  function toggleCategory(name: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  function expandAll() {
    setOpenCategories(new Set(filteredIndustries.map((i) => i.name)));
  }

  function collapseAll() {
    setOpenCategories(new Set());
  }

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
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm font-semibold" style={{ color: "hsl(220,25%,62%)" }}>
            <span><span className="text-white text-2xl font-black">{industries.length}</span> industry categories</span>
            <span>·</span>
            <span><span className="text-white text-2xl font-black">{industries.reduce((a, b) => a + b.subCategories.length, 0)}+</span> sub-categories</span>
          </div>
        </div>
      </section>

      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-1">Industry-Specific Editions</h2>
              <p className="text-muted-foreground">Click any category to see its sub-categories.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={expandAll}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Expand all
              </button>
              <span className="text-muted-foreground">·</span>
              <button
                type="button"
                onClick={collapseAll}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline"
              >
                Collapse all
              </button>
            </div>
          </div>

          <div className="relative mb-8">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories or sub-categories…"
              className="w-full pl-10 pr-4 py-3 bg-card border border-border text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {filteredIndustries.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              No categories match "<span className="text-foreground font-semibold">{search}</span>"
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredIndustries.map((industry) => (
                <IndustryCard
                  key={industry.name}
                  industry={industry}
                  isOpen={openCategories.has(industry.name)}
                  onToggle={() => toggleCategory(industry.name)}
                />
              ))}
            </div>
          )}

          {!search && (
            <p className="text-center text-xs text-muted-foreground mt-8">
              {industries.length} categories · {industries.reduce((a, b) => a + b.subCategories.length, 0)} sub-categories · All powered by CtrlTrade®
            </p>
          )}
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
