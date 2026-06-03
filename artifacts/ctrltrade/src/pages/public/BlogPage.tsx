import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Clock } from "lucide-react";
import { PageHead } from "@/components/PageHead";

const categories = [
  "CRM", "Roofing", "Electrical", "Plumbing", "Trade Counter", "Warehouse", "AI", "Business Growth",
];

export const posts = [
  {
    slug: "win-more-trade-jobs-without-advertising",
    category: "Business Growth",
    title: "How To Win More Trade Jobs Without Spending More On Advertising",
    excerpt: "The fastest-growing trade businesses aren't spending more on leads — they're converting more of the ones they already have. Here's how to close the gap.",
    readTime: "5 min read",
    date: "3 Jun 2026",
  },
  {
    slug: "why-trade-businesses-lose-jobs-between-quote-and-completion",
    category: "CRM",
    title: "Why Trade Businesses Lose Jobs Between Quote And Completion",
    excerpt: "Most trade businesses track leads and invoices, but nothing in between. Here's the workflow gap that's costing you money — and how to close it.",
    readTime: "4 min read",
    date: "28 May 2026",
  },
  {
    slug: "complete-guide-trade-counter-epos-system",
    category: "Trade Counter",
    title: "The Complete Guide To Setting Up A Trade Counter EPOS System",
    excerpt: "A modern trade counter needs more than a cash register. Here's everything you need — hardware, software, stock control, and trade account billing.",
    readTime: "8 min read",
    date: "20 May 2026",
  },
  {
    slug: "how-ai-is-changing-trade-business-quotes",
    category: "AI",
    title: "How AI Is Changing The Way Trade Businesses Write Quotes",
    excerpt: "AI quote tools can cut quoting time from 30 minutes to under 5. Here's what they're good at, what they still get wrong, and how to use them effectively.",
    readTime: "6 min read",
    date: "14 May 2026",
  },
  {
    slug: "roofing-crm-checklist-2026",
    category: "Roofing",
    title: "The Roofing CRM Checklist: What Your Software Needs To Manage In 2026",
    excerpt: "Roofing businesses have unique job management needs — roof surveys, height safety records, before/after photos, and specialist materials. Your CRM should handle all of them.",
    readTime: "5 min read",
    date: "8 May 2026",
  },
  {
    slug: "eicr-ev-charger-niceic-compliance-one-platform",
    category: "Electrical",
    title: "EICR Certificates, EV Charger Installs, and NICEIC Compliance — Managing It All In One Platform",
    excerpt: "Electrical contractors need CRM software that understands the job types, certification requirements, and compliance obligations specific to the industry.",
    readTime: "6 min read",
    date: "1 May 2026",
  },
  {
    slug: "warehouse-management-trade-suppliers-practical-guide",
    category: "Warehouse",
    title: "Warehouse Management For Trade Suppliers: A Practical Guide",
    excerpt: "From goods in to order fulfilment, here's how modern trade suppliers are managing their warehouse operations — and what software they're using to do it.",
    readTime: "7 min read",
    date: "22 Apr 2026",
  },
  {
    slug: "gas-safe-boiler-servicing-crm-for-plumbers",
    category: "Plumbing",
    title: "Gas Safe Compliance, Boiler Servicing, And CRM: What Plumbers Need From Their Software",
    excerpt: "Plumbing businesses juggle gas safety records, service schedules, and emergency callouts. Here's what your CRM needs to handle all of it.",
    readTime: "5 min read",
    date: "15 Apr 2026",
  },
];

const categorySlugMap: Record<string, string> = {
  CRM: "crm",
  Roofing: "roofing",
  Electrical: "electrical",
  Plumbing: "plumbing",
  "Trade Counter": "trade-counter",
  Warehouse: "warehouse",
  AI: "ai",
  "Business Growth": "business-growth",
};

export function BlogPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <PageHead
        title="Blog — Trade Business Insights & Guides"
        description="Practical guides, industry news, and software advice for trade operators, suppliers, and field service companies. Written by the CtrlTrade® team."
        canonical="/blog"
      />
      <section className="py-24 relative overflow-hidden" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(hsl(46,98%,52%) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="container mx-auto px-4 relative z-10">
          <div className="inline-block px-4 py-1 mb-8 border border-[hsl(46,98%,52%)] text-[hsl(46,98%,52%)] font-bold text-xs tracking-widest">
            CTRLTRADE® BLOG
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-4 leading-tight max-w-3xl">Insights For Trade Businesses</h1>
          <p className="text-lg max-w-2xl" style={{ color: "hsl(220,25%,62%)" }}>
            Practical guides, industry news, and software advice for trade operators, suppliers, and field service companies.
          </p>
        </div>
      </section>

      <section className="py-12 bg-background border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap gap-2">
            <Link href="/blog" className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold">All</Link>
            {categories.map(cat => (
              <Link
                key={cat}
                href={`/blog/category/${categorySlugMap[cat] ?? cat.toLowerCase()}`}
                className="px-4 py-2 border border-border bg-card text-sm font-medium text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
              >
                {cat}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {posts.map((post) => (
              <article key={post.slug} className="border border-border bg-card hover:border-primary transition-colors group flex flex-col">
                <Link href={`/blog/${post.slug}`} className="flex flex-col flex-1">
                  <div className="h-48 bg-muted/30 relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-6xl font-black text-muted/20">{post.category.charAt(0)}</div>
                    </div>
                    <div className="absolute top-4 left-4 bg-primary text-primary-foreground text-xs font-bold px-2 py-1">
                      {post.category}
                    </div>
                  </div>
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                      <span>{post.date}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{post.readTime}</span>
                    </div>
                    <h2 className="font-bold text-lg leading-snug mb-3 group-hover:text-primary transition-colors">{post.title}</h2>
                    <p className="text-muted-foreground text-sm leading-relaxed flex-1">{post.excerpt}</p>
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <span className="text-sm font-semibold text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                        Read More <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              </article>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button variant="outline" size="lg" className="rounded-xl">
              Load More Articles
            </Button>
          </div>
        </div>
      </section>

      <section className="py-20 bg-card border-t border-border">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <h2 className="text-3xl font-bold mb-4">Ready To Take Control Of Your Trade Business?</h2>
          <p className="text-muted-foreground text-lg mb-8">Start your free 1 month trial — no credit card required during trial.</p>
          <Link href="/signup">
            <Button size="lg" className="rounded-xl h-14 px-8 font-bold">
              Start Free 1 Month Trial <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
