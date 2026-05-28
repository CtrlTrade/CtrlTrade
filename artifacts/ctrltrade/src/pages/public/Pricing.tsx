import { useGetPricing } from "@workspace/api-client-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Minus } from "lucide-react";

export function Pricing() {
  const { data: pricing, isLoading } = useGetPricing();
  
  const [controlSeats, setControlSeats] = useState(1);
  const [fieldSeats, setFieldSeats] = useState(0);
  const [tills, setTills] = useState(0);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl font-bold mb-10">Pricing</h1>
        <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  if (!pricing) return null;

  const total = (controlSeats * pricing.controlSeat.amount) + 
                (fieldSeats * pricing.fieldSeat.amount) + 
                (tills * pricing.till.amount);

  return (
    <div className="container mx-auto px-4 py-20">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">Build Your Command Center</h1>
        <p className="text-lg text-muted-foreground">Transparent pricing. No hidden fees. Tailor your setup to your exact crew size.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-6xl mx-auto">
        <div className="lg:col-span-7 space-y-6">
          <div className="border border-border bg-card p-6 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg">Control Seats</h3>
              <p className="text-muted-foreground text-sm">Back-office, dispatch, management. Minimum 1 required.</p>
              <div className="mt-2 font-mono font-bold text-primary">£{pricing.controlSeat.amount} / mo</div>
            </div>
            <div className="flex items-center gap-4 bg-background border border-border p-1">
              <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8" onClick={() => setControlSeats(Math.max(1, controlSeats - 1))} disabled={controlSeats <= 1} data-testid="button-minus-control">
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center font-bold" data-testid="text-qty-control">{controlSeats}</span>
              <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8" onClick={() => setControlSeats(controlSeats + 1)} data-testid="button-plus-control">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="border border-border bg-card p-6 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg">Field Seats</h3>
              <p className="text-muted-foreground text-sm">Mobile crew, technicians, engineers.</p>
              <div className="mt-2 font-mono font-bold text-primary">£{pricing.fieldSeat.amount} / mo</div>
            </div>
            <div className="flex items-center gap-4 bg-background border border-border p-1">
              <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8" onClick={() => setFieldSeats(Math.max(0, fieldSeats - 1))} disabled={fieldSeats <= 0} data-testid="button-minus-field">
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center font-bold" data-testid="text-qty-field">{fieldSeats}</span>
              <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8" onClick={() => setFieldSeats(fieldSeats + 1)} data-testid="button-plus-field">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="border border-border bg-card p-6 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg">CTRLTRADEPos® Tills</h3>
              <p className="text-muted-foreground text-sm">Physical trade counter POS units.</p>
              <div className="mt-2 font-mono font-bold text-primary">£{pricing.till.amount} / mo</div>
            </div>
            <div className="flex items-center gap-4 bg-background border border-border p-1">
              <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8" onClick={() => setTills(Math.max(0, tills - 1))} disabled={tills <= 0} data-testid="button-minus-till">
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center font-bold" data-testid="text-qty-till">{tills}</span>
              <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8" onClick={() => setTills(tills + 1)} data-testid="button-plus-till">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="border-t-4 border-t-primary border-l border-r border-b border-border bg-card p-8 sticky top-24">
            <h2 className="text-2xl font-bold mb-6">Estimated Total</h2>
            
            <div className="space-y-4 mb-8">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{controlSeats}× Control Seat</span>
                <span className="font-mono">£{controlSeats * pricing.controlSeat.amount}</span>
              </div>
              {fieldSeats > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{fieldSeats}× Field Seat</span>
                  <span className="font-mono">£{fieldSeats * pricing.fieldSeat.amount}</span>
                </div>
              )}
              {tills > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{tills}× POS Till</span>
                  <span className="font-mono">£{tills * pricing.till.amount}</span>
                </div>
              )}
              <div className="border-t border-border pt-4 flex justify-between font-bold text-xl">
                <span>Monthly</span>
                <span className="font-mono text-primary" data-testid="text-total-price">£{total}</span>
              </div>
            </div>

            <Button className="w-full rounded-xl h-14 font-bold text-sm" data-testid="button-start-trial">
              Start {pricing.trialDays}-Day Free Trial
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
