import { Wrench } from "lucide-react";

export function PlaceholderPage() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center p-8 bg-card border border-border shadow-sm">
      <Wrench className="h-16 w-16 text-primary mb-6" />
      <h1 className="text-2xl font-bold  text-foreground mb-2">Coming with Layer 2</h1>
      <p className="text-muted-foreground max-w-md">
        Your data will land here. We're currently forging the next iteration of CTRLTRADE®. 
        Stay tuned for powerful new tools to command your business.
      </p>
    </div>
  );
}
