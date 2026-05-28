import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useSignup, useGetPricing, useListTradeCategories, useCreateSetupIntent, useListIndustries } from "@workspace/api-client-react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, ArrowLeft, Plus, Minus, CreditCard, CheckCircle2 } from "lucide-react";

const TOTAL_STEPS = 10;

const BUSINESS_TYPES = [
  { value: "sole_trader", label: "Sole Trader" },
  { value: "limited_company", label: "Limited Company" },
  { value: "partnership", label: "Partnership" },
  { value: "plc", label: "PLC / Enterprise" },
];

const ACCOUNTING_PROVIDERS = [
  { value: "xero", label: "Xero" },
  { value: "quickbooks", label: "QuickBooks" },
  { value: "sage", label: "Sage" },
  { value: "freeagent", label: "FreeAgent" },
  { value: "none", label: "None" },
];

const COMMUNICATION_CHANNELS = [
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "voice", label: "Voice" },
];

const AI_MODULES = [
  { value: "quote_assist", label: "AI Quote Assist" },
  { value: "job_summary", label: "AI Job Summaries" },
  { value: "customer_insights", label: "Customer Insights" },
  { value: "scheduling", label: "AI Smart Scheduling" },
];

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
  const { data: industries, isLoading: industriesLoading } = useListIndustries();
  const createSetupIntent = useCreateSetupIntent();
  const signup = useSignup();

  const [company, setCompany] = useState({ name: "", country: "UK", phone: "", addressLine1: "", city: "", postcode: "", companyNumber: "" });
  const [contactDetails, setContactDetails] = useState({ contactName: "", website: "", vatNumber: "" });
  const [industrySlug, setIndustrySlug] = useState<string>("");
  const [businessType, setBusinessType] = useState<string>("");
  const [vatRegistered, setVatRegistered] = useState(false);
  const [accountingProvider, setAccountingProvider] = useState<string>("none");
  const [hasTradeShop, setHasTradeShop] = useState(false);
  const [hasMobileWorkforce, setHasMobileWorkforce] = useState(false);
  const [appointmentBookingEnabled, setAppointmentBookingEnabled] = useState(false);
  const [multiBranchEnabled, setMultiBranchEnabled] = useState(false);
  const [posEnabled, setPosEnabled] = useState(false);
  const [aiModulesEnabled, setAiModulesEnabled] = useState<string[]>([]);
  const [communicationChannels, setCommunicationChannels] = useState<string[]>(["email"]);
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
    return () => { cancelled = true; };
  }, []);

  const nextStep = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  const prevStep = () => setStep((s) => Math.max(1, s - 1));

  const handleOwnerSubmit = async (e: React.FormEvent) => {
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
        paymentMethodId,
        industrySlug: industrySlug || undefined,
        businessType: businessType || undefined,
        website: contactDetails.website || undefined,
        contactName: contactDetails.contactName || undefined,
        vatNumber: contactDetails.vatNumber || undefined,
        vatRegistered,
        accountingProvider: accountingProvider !== "none" ? accountingProvider : undefined,
        hasTradeShop,
        hasMobileWorkforce,
        appointmentBookingEnabled,
        multiBranchEnabled,
        posEnabled,
        aiModulesEnabled,
        communicationChannels,
      } as any,
    }, {
      onSuccess: () => {
        toast({ title: "Welcome to CTRLTRADE®", description: "Your workspace is ready." });
        setLocation("/app");
      },
      onError: (err: any) => {
        toast({ title: "Signup Failed", description: err.message, variant: "destructive" });
      },
    });
  };

  const stepTitles = [
    "Company Details",
    "Your Industry",
    "Business Type",
    "Platform Modules",
    "Communication & AI",
    "Trade Categories",
    "Subscription Sizing",
    "Owner Account",
    "Legal & Accounting",
    "Payment Method",
  ];

  const stepDescriptions = [
    "Tell us about your company.",
    "Select the primary industry your business operates in.",
    "What type of business are you?",
    "Choose which platform modules to activate.",
    "Set up communication channels and AI features.",
    "Select the trades your business operates in.",
    "Choose how many seats and POS tills you need.",
    "Create the owner account for your workspace.",
    "Legal details and accounting integration.",
    "Add your payment method to complete setup.",
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold ">CTRLTRADE® Setup</h1>
          <div className="text-sm font-mono text-muted-foreground">STEP {step}/{TOTAL_STEPS}</div>
        </div>

        <div className="w-full bg-muted h-1.5 mb-8">
          <div className="bg-primary h-full transition-all duration-300" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>

        <Card className="border-border shadow-xl">
          <CardHeader>
            <CardTitle className="">{stepTitles[step - 1]}</CardTitle>
            <CardDescription>{stepDescriptions[step - 1]}</CardDescription>
          </CardHeader>
          <CardContent>

            {/* Step 1 — Company Details */}
            {step === 1 && (
              <form onSubmit={(e) => { e.preventDefault(); nextStep(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Company Name *</Label>
                  <Input required value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} className="rounded-xl" data-testid="input-signup-company-name" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input value={company.country} onChange={(e) => setCompany({ ...company, country: e.target.value })} className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} className="rounded-xl" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input value={company.addressLine1} onChange={(e) => setCompany({ ...company, addressLine1: e.target.value })} className="rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input value={company.city} onChange={(e) => setCompany({ ...company, city: e.target.value })} className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>Postcode</Label>
                    <Input value={company.postcode} onChange={(e) => setCompany({ ...company, postcode: e.target.value })} className="rounded-xl" />
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit" className="rounded-xl font-bold" data-testid="button-signup-next-1">
                    Next <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </form>
            )}

            {/* Step 2 — Industry Selection */}
            {step === 2 && (
              <div className="space-y-6">
                {industriesLoading ? <Skeleton className="h-64" /> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                    {(industries ?? []).map((ind: any) => (
                      <button
                        key={ind.slug}
                        type="button"
                        onClick={() => setIndustrySlug(ind.slug === industrySlug ? "" : ind.slug)}
                        className={`flex items-center gap-3 border p-4 text-left transition-colors ${industrySlug === ind.slug ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                        data-testid={`btn-industry-${ind.slug}`}
                      >
                        {industrySlug === ind.slug && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                        <div>
                          <div className="font-bold uppercase text-sm">{ind.name}</div>
                          {ind.description && <div className="text-xs text-muted-foreground mt-0.5">{ind.description}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={prevStep} className="rounded-xl font-bold"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                  <Button onClick={nextStep} className="rounded-xl font-bold" data-testid="button-signup-next-2">
                    {industrySlug ? "Next" : "Skip for now"} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3 — Business Type */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {BUSINESS_TYPES.map((bt) => (
                    <button
                      key={bt.value}
                      type="button"
                      onClick={() => setBusinessType(bt.value === businessType ? "" : bt.value)}
                      className={`border p-4 text-left transition-colors ${businessType === bt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                      data-testid={`btn-business-type-${bt.value}`}
                    >
                      <div className="flex items-center gap-2">
                        {businessType === bt.value && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                        <span className="font-bold uppercase text-sm">{bt.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={prevStep} className="rounded-xl font-bold"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                  <Button onClick={nextStep} className="rounded-xl font-bold" data-testid="button-signup-next-3">
                    {businessType ? "Next" : "Skip for now"} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4 — Platform Modules */}
            {step === 4 && (
              <div className="space-y-4">
                {[
                  { label: "Trade Shop", description: "Enable a B2B trade products store", value: hasTradeShop, set: setHasTradeShop, id: "mod-trade-shop" },
                  { label: "Mobile Workforce", description: "Enable field engineer mobile app features", value: hasMobileWorkforce, set: setHasMobileWorkforce, id: "mod-mobile-workforce" },
                  { label: "Appointment Booking", description: "Enable customer self-booking widget", value: appointmentBookingEnabled, set: setAppointmentBookingEnabled, id: "mod-booking" },
                  { label: "POS Tills", description: "Enable point-of-sale terminal features", value: posEnabled, set: setPosEnabled, id: "mod-pos" },
                  { label: "Multi-Branch", description: "Enable branch management and area managers", value: multiBranchEnabled, set: setMultiBranchEnabled, id: "mod-multi-branch" },
                ].map((mod) => (
                  <div key={mod.id} className="flex items-center gap-4 border border-border p-4">
                    <Checkbox id={mod.id} checked={mod.value} onCheckedChange={(c) => mod.set(!!c)} className="rounded-xl" />
                    <label htmlFor={mod.id} className="flex-1 cursor-pointer">
                      <div className="font-bold uppercase text-sm">{mod.label}</div>
                      <div className="text-xs text-muted-foreground">{mod.description}</div>
                    </label>
                  </div>
                ))}
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={prevStep} className="rounded-xl font-bold"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                  <Button onClick={nextStep} className="rounded-xl font-bold" data-testid="button-signup-next-4">Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
                </div>
              </div>
            )}

            {/* Step 5 — Communication & AI */}
            {step === 5 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-xs mb-3 block">Communication Channels</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {COMMUNICATION_CHANNELS.map((ch) => (
                      <div key={ch.value} className="flex items-center gap-3 border border-border p-3">
                        <Checkbox
                          id={`ch-${ch.value}`}
                          checked={communicationChannels.includes(ch.value)}
                          onCheckedChange={(c) => {
                            if (c) setCommunicationChannels([...communicationChannels, ch.value]);
                            else setCommunicationChannels(communicationChannels.filter((x) => x !== ch.value));
                          }}
                          className="rounded-xl"
                        />
                        <label htmlFor={`ch-${ch.value}`} className="font-bold uppercase text-sm cursor-pointer">{ch.label}</label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-3 block">AI Modules</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {AI_MODULES.map((ai) => (
                      <div key={ai.value} className="flex items-center gap-3 border border-border p-3">
                        <Checkbox
                          id={`ai-${ai.value}`}
                          checked={aiModulesEnabled.includes(ai.value)}
                          onCheckedChange={(c) => {
                            if (c) setAiModulesEnabled([...aiModulesEnabled, ai.value]);
                            else setAiModulesEnabled(aiModulesEnabled.filter((x) => x !== ai.value));
                          }}
                          className="rounded-xl"
                        />
                        <label htmlFor={`ai-${ai.value}`} className="font-bold uppercase text-sm cursor-pointer">{ai.label}</label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={prevStep} className="rounded-xl font-bold"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                  <Button onClick={nextStep} className="rounded-xl font-bold" data-testid="button-signup-next-5">Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
                </div>
              </div>
            )}

            {/* Step 6 — Trade Categories */}
            {step === 6 && (
              <div className="space-y-6">
                {categoriesLoading ? <Skeleton className="h-64" /> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                    {categories?.map((cat) => (
                      <div key={cat.slug} className="flex items-center space-x-2 border border-border p-4 bg-background hover:border-primary transition-colors">
                        <Checkbox
                          id={`cat-${cat.slug}`}
                          checked={tradeCategorySlugs.includes(cat.slug)}
                          onCheckedChange={(checked) => {
                            if (checked) setTradeCategorySlugs([...tradeCategorySlugs, cat.slug]);
                            else setTradeCategorySlugs(tradeCategorySlugs.filter((s) => s !== cat.slug));
                          }}
                          className="rounded-xl"
                        />
                        <label htmlFor={`cat-${cat.slug}`} className="text-sm font-bold uppercase cursor-pointer flex-1">{cat.name}</label>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={prevStep} className="rounded-xl font-bold"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                  <Button onClick={nextStep} className="rounded-xl font-bold" data-testid="button-signup-next-6">Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
                </div>
              </div>
            )}

            {/* Step 7 — Subscription Sizing */}
            {step === 7 && (
              <div className="space-y-6">
                {pricingLoading ? <Skeleton className="h-64" /> : pricing && (
                  <>
                    <div className="space-y-4">
                      {[
                        { label: "Control Seats", price: pricing.controlSeat.amount, value: controlSeats, set: setControlSeats, min: 1 },
                        { label: "Field Seats", price: pricing.fieldSeat.amount, value: fieldSeats, set: setFieldSeats, min: 0 },
                        { label: "POS Tills", price: pricing.till.amount, value: tills, set: setTills, min: 0 },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between border border-border p-4 bg-background">
                          <div>
                            <div className="font-semibold">{item.label}</div>
                            <div className="text-sm text-muted-foreground font-mono">£{item.price}/mo</div>
                          </div>
                          <div className="flex items-center gap-4 bg-card border border-border p-1">
                            <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8" onClick={() => item.set(Math.max(item.min, item.value - 1))} disabled={item.value <= item.min}><Minus className="h-4 w-4" /></Button>
                            <span className="w-8 text-center font-bold font-mono">{item.value}</span>
                            <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8" onClick={() => item.set(item.value + 1)}><Plus className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-border pt-4 flex justify-between font-bold text-xl">
                      <span className="uppercase">Monthly Total</span>
                      <span className="font-mono text-primary">£{(controlSeats * pricing.controlSeat.amount) + (fieldSeats * pricing.fieldSeat.amount) + (tills * pricing.till.amount)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={prevStep} className="rounded-xl font-bold"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                  <Button onClick={nextStep} className="rounded-xl font-bold" data-testid="button-signup-next-7">Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
                </div>
              </div>
            )}

            {/* Step 8 — Owner Account */}
            {step === 8 && (
              <form onSubmit={handleOwnerSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Your Full Name *</Label>
                  <Input required value={owner.name} onChange={(e) => setOwner({ ...owner, name: e.target.value })} className="rounded-xl" data-testid="input-signup-owner-name" />
                </div>
                <div className="space-y-2">
                  <Label>Email Address *</Label>
                  <Input required type="email" value={owner.email} onChange={(e) => setOwner({ ...owner, email: e.target.value })} className="rounded-xl" data-testid="input-signup-owner-email" />
                </div>
                <div className="space-y-2">
                  <Label>Password * (min 8 chars)</Label>
                  <Input required type="password" minLength={8} value={owner.password} onChange={(e) => setOwner({ ...owner, password: e.target.value })} className="rounded-xl" data-testid="input-signup-owner-password" />
                </div>
                <div className="flex justify-between pt-4">
                  <Button type="button" variant="outline" onClick={prevStep} className="rounded-xl font-bold"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                  <Button type="submit" disabled={createSetupIntent.isPending} className="rounded-xl font-bold" data-testid="button-signup-next-8">
                    {createSetupIntent.isPending ? "Preparing..." : <>Next <ArrowRight className="ml-2 h-4 w-4" /></>}
                  </Button>
                </div>
              </form>
            )}

            {/* Step 9 — Legal & Accounting */}
            {step === 9 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Contact Name</Label>
                  <Input value={contactDetails.contactName} onChange={(e) => setContactDetails({ ...contactDetails, contactName: e.target.value })} className="rounded-xl" placeholder="Primary contact person" />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input value={contactDetails.website} onChange={(e) => setContactDetails({ ...contactDetails, website: e.target.value })} className="rounded-xl" placeholder="https://yourcompany.com" />
                </div>
                <div className="flex items-center gap-3 border border-border p-3">
                  <Checkbox id="vat-reg" checked={vatRegistered} onCheckedChange={(c) => setVatRegistered(!!c)} className="rounded-xl" />
                  <label htmlFor="vat-reg" className="font-bold uppercase text-sm cursor-pointer">VAT Registered</label>
                </div>
                {vatRegistered && (
                  <div className="space-y-2">
                    <Label>VAT Number</Label>
                    <Input value={contactDetails.vatNumber} onChange={(e) => setContactDetails({ ...contactDetails, vatNumber: e.target.value })} className="rounded-xl" placeholder="GB123456789" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-xs">Accounting Software</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {ACCOUNTING_PROVIDERS.map((ap) => (
                      <button
                        key={ap.value}
                        type="button"
                        onClick={() => setAccountingProvider(ap.value)}
                        className={`border p-3 text-left text-sm font-bold uppercase transition-colors flex items-center gap-1.5 ${accountingProvider === ap.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                      >
                        {accountingProvider === ap.value && <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />}
                        {ap.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={prevStep} className="rounded-xl font-bold"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                  <Button onClick={nextStep} className="rounded-xl font-bold" data-testid="button-signup-next-9">Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
                </div>
              </div>
            )}

            {/* Step 10 — Payment Method */}
            {step === 10 && (
              <div className="space-y-6">
                {!stripeChecked ? (
                  <div className="py-12 flex justify-center"><Skeleton className="h-10 w-10 rounded-full" /></div>
                ) : !stripePromise ? (
                  <div className="border border-destructive/50 bg-destructive/10 p-6 text-center">
                    <CreditCard className="h-10 w-10 text-destructive mx-auto mb-4" />
                    <h3 className="font-bold text-destructive mb-2">Stripe Not Connected</h3>
                    <p className="text-sm text-destructive/80 mb-6">Payment capture is disabled in this environment. You can connect Stripe later via Integrations.</p>
                    <Button onClick={() => finishSignup("pm_fallback_skipped")} disabled={signup.isPending} className="rounded-xl font-bold w-full" data-testid="button-signup-skip-payment">
                      {signup.isPending ? "Deploying workspace..." : "Continue Without Payment Method"}
                    </Button>
                  </div>
                ) : !clientSecret ? (
                  <div className="py-12 flex justify-center"><Skeleton className="h-10 w-10 rounded-full" /></div>
                ) : (
                  <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "flat", variables: { colorPrimary: "#f97316", borderRadius: "0px" } } }}>
                    <StripePaymentForm onSuccess={finishSignup} onBack={prevStep} isSignupPending={signup.isPending} />
                  </Elements>
                )}
                {stripePromise && (
                  <div className="flex justify-start pt-4 border-t border-border mt-6">
                    <Button type="button" variant="outline" onClick={prevStep} className="rounded-xl font-bold"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-center gap-1.5 mt-6">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div key={i} className={`h-1.5 w-6 transition-colors ${i + 1 === step ? "bg-primary" : i + 1 < step ? "bg-primary/40" : "bg-muted"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StripePaymentForm({ onSuccess, onBack, isSignupPending }: { onSuccess: (pmId: string) => void; onBack: () => void; isSignupPending: boolean }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    const { error, setupIntent } = await stripe.confirmSetup({ elements, redirect: "if_required" });
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
      <Button type="submit" disabled={!stripe || loading || isSignupPending} className="w-full font-bold h-12" data-testid="button-signup-submit-stripe">
        {loading || isSignupPending ? "Deploying workspace..." : "Save Payment Method & Deploy Workspace"}
      </Button>
    </form>
  );
}
