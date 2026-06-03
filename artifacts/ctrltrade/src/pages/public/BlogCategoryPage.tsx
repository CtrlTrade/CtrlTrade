import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { posts } from "./BlogPage";
import NotFound from "@/pages/not-found";

const categorySlugToLabel: Record<string, string> = {
  crm: "CRM",
  roofing: "Roofing",
  electrical: "Electrical",
  plumbing: "Plumbing",
  "trade-counter": "Trade Counter",
  warehouse: "Warehouse",
  ai: "AI",
  "business-growth": "Business Growth",
};

interface BlogCategoryPageProps {
  slug: string;
}

export function BlogCategoryPage({ slug }: BlogCategoryPageProps) {
  const label = categorySlugToLabel[slug];

  if (!label) {
    return <NotFound />;
  }

  const filtered = posts.filter(
    (p) => p.category.toLowerCase().replace(/ /g, "-") === slug
  );

  return (
    <div className="flex flex-col min-h-screen">
      <section className="py-24 relative overflow-hidden" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(hsl(46,98%,52%) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="container mx-auto px-4 relative z-10">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-medium mb-8 hover:underline" style={{ color: "hsl(220,25%,62%)" }}>
            <ArrowLeft className="h-3.5 w-3.5" /> All Articles
          </Link>
          <div className="inline-block px-4 py-1 mb-8 border border-[hsl(46,98%,52%)] text-[hsl(46,98%,52%)] font-bold text-xs tracking-widest">
            CATEGORY
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-4 leading-tight max-w-3xl">{label}</h1>
          <p className="text-lg max-w-2xl" style={{ color: "hsl(220,25%,62%)" }}>
            {filtered.length} article{filtered.length !== 1 ? "s" : ""} in this category.
          </p>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              No articles found in this category yet. <Link href="/blog" className="text-primary hover:underline">View all articles</Link>.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {filtered.map((post) => (
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
          )}

          <div className="text-center mt-12">
            <Link href="/blog">
              <Button variant="outline" size="lg" className="rounded-xl">
                <ArrowLeft className="mr-2 h-4 w-4" /> All Articles
              </Button>
            </Link>
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
