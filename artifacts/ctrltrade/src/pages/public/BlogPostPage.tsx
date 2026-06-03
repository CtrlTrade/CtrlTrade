import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Clock, Tag } from "lucide-react";
import { posts } from "./BlogPage";
import NotFound from "@/pages/not-found";

interface BlogPostPageProps {
  slug: string;
}

export function BlogPostPage({ slug }: BlogPostPageProps) {
  const post = posts.find((p) => p.slug === slug);

  if (!post) {
    return <NotFound />;
  }

  const postIndex = posts.indexOf(post);
  const prevPost = postIndex < posts.length - 1 ? posts[postIndex + 1] : null;
  const nextPost = postIndex > 0 ? posts[postIndex - 1] : null;

  return (
    <div className="flex flex-col min-h-screen">
      <section className="py-24 relative overflow-hidden" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(hsl(46,98%,52%) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="container mx-auto px-4 max-w-3xl relative z-10">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-medium mb-8 hover:underline" style={{ color: "hsl(220,25%,62%)" }}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Blog
          </Link>
          <div className="flex items-center gap-3 mb-6">
            <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-1">{post.category}</span>
            <span className="flex items-center gap-1 text-xs" style={{ color: "hsl(220,25%,62%)" }}>
              <Clock className="h-3 w-3" /> {post.readTime}
            </span>
            <span className="text-xs" style={{ color: "hsl(220,25%,62%)" }}>{post.date}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black leading-tight mb-6">{post.title}</h1>
          <p className="text-lg leading-relaxed" style={{ color: "hsl(220,25%,62%)" }}>{post.excerpt}</p>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="prose prose-neutral max-w-none">
            <p className="text-muted-foreground text-lg leading-relaxed mb-6">{post.excerpt}</p>

            <p className="text-muted-foreground leading-relaxed mb-6">
              For trade businesses across the UK, staying competitive means more than having the right tools on-site. It means having the right software to manage your operations, your customers, and your compliance obligations — all in one place.
            </p>

            <h2 className="text-2xl font-bold mt-10 mb-4">The Challenge Facing Trade Businesses Today</h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Many trade businesses are still running on disconnected systems — a spreadsheet for leads, a separate invoicing tool, paper-based job cards, and a WhatsApp group for scheduling. That fragmentation costs time, creates errors, and makes it nearly impossible to get a clear view of your business performance.
            </p>

            <h2 className="text-2xl font-bold mt-10 mb-4">What A Modern Trade Platform Delivers</h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              A purpose-built trade CRM like CtrlTrade® connects every part of your business: from the initial lead enquiry through to quote, job, completion, and invoice — with compliance records, scheduling, and customer communication all built in. That end-to-end connection is what separates a genuine trade operating system from a generic CRM bolted onto a trade workflow.
            </p>

            <h2 className="text-2xl font-bold mt-10 mb-4">Getting Started</h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              The best way to evaluate whether a platform is right for your business is to use it on a real job. CtrlTrade® offers a full 1 month free trial — no credit card required, no demo call, no sales pressure. Sign up, configure your industry-specific settings, and run your next job through the platform.
            </p>

            <div className="flex items-center gap-2 mt-8 pt-8 border-t border-border">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Category:</span>
              <Link href={`/blog/category/${post.category.toLowerCase().replace(/ /g, "-")}`} className="text-sm font-semibold text-primary hover:underline">
                {post.category}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {(prevPost || nextPost) && (
        <section className="py-12 bg-card border-t border-border">
          <div className="container mx-auto px-4 max-w-3xl">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">More Articles</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {prevPost && (
                <Link href={`/blog/${prevPost.slug}`} className="border border-border bg-background p-5 hover:border-primary transition-colors group">
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <ArrowLeft className="h-3 w-3" /> Previous
                  </div>
                  <p className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors">{prevPost.title}</p>
                </Link>
              )}
              {nextPost && (
                <Link href={`/blog/${nextPost.slug}`} className="border border-border bg-background p-5 hover:border-primary transition-colors group sm:text-right">
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1 sm:justify-end">
                    Next <ArrowRight className="h-3 w-3" />
                  </div>
                  <p className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors">{nextPost.title}</p>
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="py-20 bg-background border-t border-border">
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
