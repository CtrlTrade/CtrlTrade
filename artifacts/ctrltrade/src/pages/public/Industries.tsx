import { useListTradeCategories } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrench } from "lucide-react";

export function Industries() {
  const { data: categories, isLoading } = useListTradeCategories();

  return (
    <div className="container mx-auto px-4 py-20">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">Built For Your Trade</h1>
        <p className="text-lg text-muted-foreground">CTRLTRADE® adapts to the specific workflows, compliance needs, and terminology of your industry.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {categories?.map((cat) => (
            <div key={cat.id} className="border border-border bg-card p-8 group hover:border-primary transition-colors">
              <div className="h-12 w-12 bg-muted flex items-center justify-center mb-6 text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Wrench className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-4" data-testid={`category-${cat.slug}`}>{cat.name}</h3>
              <div className="flex flex-wrap gap-2">
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
          ))}
        </div>
      )}
    </div>
  );
}
