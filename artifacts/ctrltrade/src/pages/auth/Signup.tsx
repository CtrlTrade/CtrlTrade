import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useSignup, useGetPricing, useListTradeCategories, useCreateSetupIntent } from "@workspace/api-client-react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, ArrowLeft, Plus, Minus, CreditCard } from "lucide-react";

// Publishable key is fetched from the server (sourced from the Stripe Replit integration).
// If Stripe isn't connected, the endpoint returns 503 and we fall back to the no-Stripe flow.
let stripePromiseCache: Promise<Stripe | null> | null = null;
async function loadStripePromise(baseUrl: string): Promise<Stripe | null> {
  if (stripePromiseCache) return stripePromiseCache;
  stripePromiseCache = (async () => {
    const resp = await fetch(`${baseUrl}api/v1/stripe/publishable-key`, { credentials: "include" });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { publishableKey?: string };
    if (!data.publishableKey) return null;
    return loadStripe(data.publishableKey);
  })();
  return stripePromiseCache;
}

export function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [step, setStep] = useState(1);
  const { data: categories, isLoading: categoriesLoading } = useListTradeCategories();
  const { data: pricing, isLoading: pricingLoading } = useGetPricing();
  const createSetupIntent = useCreateSetupIntent();
  const signup = useSignup();

  // State
  const [company, setCompany] = useState({ name: "", country: "UK", phone: "", addressLine1: "", city: "", postcode: "", companyNumber: "" });
  const [tradeCategorySlugs, setTradeCategorySlugs] = useState<string[]>([]);
  const [controlSeats, setControlSeats] = useState(1);
  const [fieldSeats, setFieldSeats] = useState(0);
  const [tills, setTills] = useState(0);
  const [owner, setOwner] = useState({ name: "", email: "", password: "" });
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [stripeChecked, setStripeChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const promise = loadStripePromise(import.meta.env.BASE_URL ?? "/");
    promise.then((s) => {
      if (cancelled) return;
      setStripePromise(s ? promise : null);
      setStripeChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const nextStep = () => setStep(s => Math.min(6, s + 1));
  const prevStep = () => setStep(s => Math.max(1, s - 1));

  const handleStep4Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (owner.password.length < 8) {
      toast({ title: "Password too short", description: "Must be at least 8 characters", variant: "destructive" });
      return;
    }
    
    if (stripePromise) {
      try {
        const intent = await createSetupIntent.mutateAsync({ data: { email: owner.email, companyName: company.name } });
        setClientSecret(intent.clientSecret);
      } catch (err: any) {
        toast({ title: "Error preparing payment", description: err.message, variant: "destructive" });
        return;
      }
    }
    nextStep();
  };

  const handleStripeSuccess = (paymentMethodId: string) => {
    finishSignup(paymentMethodId);
  };

  const handleStripeFallbackSkip = () => {
    finishSignup("pm_fallback_skipped"); // Dummy value when no stripe connected
  };

  const finishSignup = (paymentMethodId: string) => {
    signup.mutate({
      data: {
        company,
        tradeCategorySlugs,
        controlSeats,
        fieldSeats,
        tills,
        ownerName: owner.name,
        ownerEmail: owner.email,
        ownerPassword: owner.password,
        paymentMethodId
      }
    }, {
      onSuccess: () => {
        toast({ title: "Welcome to CTRLTRADE®", description: "Your workspace is ready." });
        setLocation("/app");
      },
      onError: (err: any) => {
        toast({ title: "Signup Failed", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold tracking-tighter uppercase">CTRLTRADE® Setup</h1>
          <div className="text-sm font-mono text-muted-foreground">STEP {step}/6</div>
        </div>

        <Card className=" border-border shadow-xl">
          <CardHeader>
            {step === 1 && <CardTitle className="uppercase tracking-tight">Company Details</CardTitle>}
            {step === 2 && <CardTitle className="uppercase tracking-tight">Industries</CardTitle>}
            {step === 3 && <CardTitle className="uppercase tracking-tight">Subscription Sizing</CardTitle>}
            {step === 4 && <CardTitle className="uppercase tracking-tight">Owner Account</CardTitle>}
            {step === 5 && <CardTitle className="uppercase tracking-tight">Payment Method</CardTitle>}
            {step === 6 && <CardTitle className="uppercase tracking-tight">Review & Deploy</CardTitle>}
          </CardHeader>
          <CardContent>
            {step === 1 && (
              <form onSubmit={(e) => { e.preventDefault(); nextStep(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Company Name *</Label>
                  <Input required value={company.name} onChange={e => setCompany({...company, name: e.target.value})} className="rounded-none" data-testid="input-signup-company-name"/>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input value={company.country} onChange={e => setCompany({...company, country: e.target.value})} className="rounded-none" />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={company.phone} onChange={e => setCompany({...company, phone: e.target.value})} className="rounded-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input value={company.addressLine1} onChange={e => setCompany({...company, addressLine1: e.target.value})} className="rounded-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input value={company.city} onChange={e => setCompany({...company, city: e.target.value})} className="rounded-none" />
                  </div>
                  <div className="space-y-2">
                    <Label>Postcode</Label>
                    <Input value={company.postcode} onChange={e => setCompany({...company, postcode: e.target.value})} className="rounded-none" />
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit" className="rounded-none uppercase tracking-wider font-bold" data-testid="button-signup-next-1">Next <ArrowRight className="ml-2 h-4 w-4"/></Button>
                </div>
              </form>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <CardDescription>Select the trades your business operates in.</CardDescription>
                {categoriesLoading ? <Skeleton className="h-64" /> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {categories?.map(cat => (
                      <div key={cat.slug} className="flex items-center space-x-2 border border-border p-4 bg-background hover:border-primary transition-colors">
                        <Checkbox 
                          id={`cat-${cat.slug}`} 
                          checked={tradeCategorySlugs.includes(cat.slug)}
                          onCheckedChange={(checked) => {
                            if (checked) setTradeCategorySlugs([...tradeCategorySlugs, cat.slug]);
                            else setTradeCategorySlugs(tradeCategorySlugs.filter(s => s !== cat.slug));
                          }}
                          className="rounded-none"
                        />
                        <label htmlFor={`cat-${cat.slug}`} className="text-sm font-bold uppercase cursor-pointer flex-1">
                          {cat.name}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={prevStep} className="rounded-none uppercase tracking-wider font-bold"><ArrowLeft className="mr-2 h-4 w-4"/> Back</Button>
                  <Button onClick={nextStep} disabled={tradeCategorySlugs.length === 0} className="rounded-none uppercase tracking-wider font-bold" data-testid="button-signup-next-2">Next <ArrowRight className="ml-2 h-4 w-4"/></Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                {pricingLoading ? <Skeleton className="h-64" /> : pricing && (
                  <>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border border-border p-4 bg-background">
                        <div>
                          <div className="font-bold uppercase">Control Seats</div>
                          <div className="text-sm text-muted-foreground font-mono">£{pricing.controlSeat.amount}/mo</div>
                        </div>
                        <div className="flex items-center gap-4 bg-card border border-border p-1">
                          <Button variant="ghost" size="icon" className="rounded-none h-8 w-8" onClick={() => setControlSeats(Math.max(1, controlSeats - 1))} disabled={controlSeats <= 1}><Minus className="h-4 w-4" /></Button>
                          <span className="w-8 text-center font-bold font-mono">{controlSeats}</span>
                          <Button variant="ghost" size="icon" className="rounded-none h-8 w-8" onClick={() => setControlSeats(controlSeats + 1)}><Plus className="h-4 w-4" /></Button>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between border border-border p-4 bg-background">
                        <div>
                          <div className="font-bold uppercase">Field Seats</div>
                          <div className="text-sm text-muted-foreground font-mono">£{pricing.fieldSeat.amount}/mo</div>
                        </div>
                        <div className="flex items-center gap-4 bg-card border border-border p-1">
                          <Button variant="ghost" size="icon" className="rounded-none h-8 w-8" onClick={() => setFieldSeats(Math.max(0, fieldSeats - 1))} disabled={fieldSeats <= 0}><Minus className="h-4 w-4" /></Button>
                          <span className="w-8 text-center font-bold font-mono">{fieldSeats}</span>
                          <Button variant="ghost" size="icon" className="rounded-none h-8 w-8" onClick={() => setFieldSeats(fieldSeats + 1)}><Plus className="h-4 w-4" /></Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border border-border p-4 bg-background">
                        <div>
                          <div className="font-bold uppercase">POS Tills</div>
                          <div className="text-sm text-muted-foreground font-mono">£{pricing.till.amount}/mo</div>
                        </div>
                        <div className="flex items-center gap-4 bg-card border border-border p-1">
                          <Button variant="ghost" size="icon" className="rounded-none h-8 w-8" onClick={() => setTills(Math.max(0, tills - 1))} disabled={tills <= 0}><Minus className="h-4 w-4" /></Button>
                          <span className="w-8 text-center font-bold font-mono">{tills}</span>
                          <Button variant="ghost" size="icon" className="rounded-none h-8 w-8" onClick={() => setTills(tills + 1)}><Plus className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="border-t border-border pt-4 flex justify-between font-bold text-xl">
                      <span className="uppercase">Monthly Total</span>
                      <span className="font-mono text-primary">£{(controlSeats * pricing.controlSeat.amount) + (fieldSeats * pricing.fieldSeat.amount) + (tills * pricing.till.amount)}</span>
                    </div>
                  </>
                )}
                
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={prevStep} className="rounded-none uppercase tracking-wider font-bold"><ArrowLeft className="mr-2 h-4 w-4"/> Back</Button>
                  <Button onClick={nextStep} className="rounded-none uppercase tracking-wider font-bold" data-testid="button-signup-next-3">Next <ArrowRight className="ml-2 h-4 w-4"/></Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <form onSubmit={handleStep4Submit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Your Full Name *</Label>
                  <Input required value={owner.name} onChange={e => setOwner({...owner, name: e.target.value})} className="rounded-none" data-testid="input-signup-owner-name"/>
                </div>
                <div className="space-y-2">
                  <Label>Email Address *</Label>
                  <Input required type="email" value={owner.email} onChange={e => setOwner({...owner, email: e.target.value})} className="rounded-none" data-testid="input-signup-owner-email"/>
                </div>
                <div className="space-y-2">
                  <Label>Password * (min 8 chars)</Label>
                  <Input required type="password" minLength={8} value={owner.password} onChange={e => setOwner({...owner, password: e.target.value})} className="rounded-none" data-testid="input-signup-owner-password"/>
                </div>
                <div className="flex justify-between pt-4">
                  <Button type="button" variant="outline" onClick={prevStep} className="rounded-none uppercase tracking-wider font-bold"><ArrowLeft className="mr-2 h-4 w-4"/> Back</Button>
                  <Button type="submit" disabled={createSetupIntent.isPending} className="rounded-none uppercase tracking-wider font-bold" data-testid="button-signup-next-4">
                    {createSetupIntent.isPending ? "Preparing..." : <>Next <ArrowRight className="ml-2 h-4 w-4"/></>}
                  </Button>
                </div>
              </form>
            )}

            {step === 5 && (
              <div className="space-y-6">
                {!stripeChecked ? (
                  <div className="py-12 flex justify-center"><Skeleton className="h-10 w-10 rounded-full" /></div>
                ) : !stripePromise ? (
                  <div className="border border-destructive/50 bg-destructive/10 p-6 text-center">
                    <CreditCard className="h-10 w-10 text-destructive mx-auto mb-4" />
                    <h3 className="font-bold uppercase tracking-tight text-destructive mb-2">Stripe Not Connected</h3>
                    <p className="text-sm text-destructive/80 mb-6">Payment capture is disabled in this environment. You can connect Stripe later via Integrations.</p>
                    <Button onClick={handleStripeFallbackSkip} className="rounded-none font-bold uppercase tracking-wider w-full">Continue Without Payment Method</Button>
                  </div>
                ) : !clientSecret ? (
                  <div className="py-12 flex justify-center"><Skeleton className="h-10 w-10 rounded-full" /></div>
                ) : (
                  <Elements stripe={stripePromise} options={{clientSecret, appearance: { theme: 'flat', variables: { colorPrimary: '#f97316', borderRadius: '0px' } }}}>
                    <StripePaymentForm onSuccess={handleStripeSuccess} onBack={prevStep} isSignupPending={signup.isPending} />
                  </Elements>
                )}
                
                {stripePromise && (
                  <div className="flex justify-start pt-4 border-t border-border mt-6">
                     <Button type="button" variant="outline" onClick={prevStep} className="rounded-none uppercase tracking-wider font-bold"><ArrowLeft className="mr-2 h-4 w-4"/> Back</Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StripePaymentForm({ onSuccess, onBack, isSignupPending }: { onSuccess: (pmId: string) => void, onBack: () => void, isSignupPending: boolean }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    
    // We confirm the setup intent, but prevent redirect since we want to handle signup first
    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      toast({ title: "Payment Method Error", description: error.message, variant: "destructive" });
      setLoading(false);
    } else if (setupIntent && setupIntent.payment_method) {
      onSuccess(setupIntent.payment_method as string);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button type="submit" disabled={!stripe || loading || isSignupPending} className="w-full font-bold uppercase tracking-wider h-12" data-testid="button-signup-submit-stripe">
        {loading || isSignupPending ? "Processing Setup..." : "Save Payment Method & Deploy Workspace"}
      </Button>
    </form>
  );
}
