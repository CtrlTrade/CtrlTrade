import { useState, useEffect } from "react";
import { useGetTenantModules, useUpdateTenantModules, useListIndustries } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2 } from "lucide-react";

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

export function BusinessSetupSettings() {
  const { data: modules, isLoading: modulesLoading } = useGetTenantModules();
  const { data: industries, isLoading: industriesLoading } = useListIndustries();
  const updateModules = useUpdateTenantModules();
  const { toast } = useToast();

  const [industrySlug, setIndustrySlug] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [hasTradeShop, setHasTradeShop] = useState(false);
  const [hasMobileWorkforce, setHasMobileWorkforce] = useState(false);
  const [appointmentBookingEnabled, setAppointmentBookingEnabled] = useState(false);
  const [multiBranchEnabled, setMultiBranchEnabled] = useState(false);
  const [posEnabled, setPosEnabled] = useState(false);
  const [vatRegistered, setVatRegistered] = useState(false);
  const [accountingProvider, setAccountingProvider] = useState("none");
  const [aiModulesEnabled, setAiModulesEnabled] = useState<string[]>([]);
  const [communicationChannels, setCommunicationChannels] = useState<string[]>([]);

  useEffect(() => {
    if (modules) {
      setIndustrySlug((modules as any).industrySlug ?? "");
      setBusinessType((modules as any).businessType ?? "");
      setHasTradeShop((modules as any).hasTradeShop ?? false);
      setHasMobileWorkforce((modules as any).hasMobileWorkforce ?? false);
      setAppointmentBookingEnabled((modules as any).appointmentBookingEnabled ?? false);
      setMultiBranchEnabled((modules as any).multiBranchEnabled ?? false);
      setPosEnabled((modules as any).posEnabled ?? false);
      setVatRegistered((modules as any).vatRegistered ?? false);
      setAccountingProvider((modules as any).accountingProvider ?? "none");
      setAiModulesEnabled((modules as any).aiModulesEnabled ?? []);
      setCommunicationChannels((modules as any).communicationChannels ?? []);
    }
  }, [modules]);

  const handleSave = async () => {
    try {
      await updateModules.mutateAsync({
        data: {
          industrySlug: industrySlug || undefined,
          businessType: businessType || undefined,
          hasTradeShop,
          hasMobileWorkforce,
          appointmentBookingEnabled,
          multiBranchEnabled,
          posEnabled,
          vatRegistered,
          accountingProvider: accountingProvider !== "none" ? accountingProvider : undefined,
          aiModulesEnabled,
          communicationChannels,
        } as any,
      });
      toast({ title: "Business setup saved", description: "Your module configuration has been updated." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    }
  };

  if (modulesLoading || industriesLoading) {
    return <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="">Industry</CardTitle>
          <CardDescription>Set the primary industry for your workspace to enable industry-specific content.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setIndustrySlug("")}
              className={`border p-3 text-left text-sm font-semibold transition-colors ${!industrySlug ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
            >
              None
            </button>
            {(industries ?? []).map((ind: any) => (
              <button
                key={ind.slug}
                type="button"
                onClick={() => setIndustrySlug(ind.slug)}
                className={`border p-3 text-left text-sm font-semibold transition-colors flex items-center gap-1.5 ${industrySlug === ind.slug ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                data-testid={`settings-industry-${ind.slug}`}
              >
                {industrySlug === ind.slug && <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />}
                {ind.name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="">Business Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {BUSINESS_TYPES.map((bt) => (
              <button
                key={bt.value}
                type="button"
                onClick={() => setBusinessType(bt.value === businessType ? "" : bt.value)}
                className={`border p-3 text-left text-sm font-semibold transition-colors flex items-center gap-1.5 ${businessType === bt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
              >
                {businessType === bt.value && <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />}
                {bt.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="">Platform Modules</CardTitle>
          <CardDescription>Toggle modules on or off. Changes take effect immediately after saving.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Trade Shop", description: "B2B trade products store", value: hasTradeShop, set: setHasTradeShop, id: "bs-trade-shop" },
            { label: "Mobile Workforce", description: "Field engineer mobile features", value: hasMobileWorkforce, set: setHasMobileWorkforce, id: "bs-mobile-workforce" },
            { label: "Appointment Booking", description: "Customer self-booking widget", value: appointmentBookingEnabled, set: setAppointmentBookingEnabled, id: "bs-booking" },
            { label: "POS Tills", description: "Point-of-sale terminal features", value: posEnabled, set: setPosEnabled, id: "bs-pos" },
            { label: "Multi-Branch", description: "Branch management & area managers", value: multiBranchEnabled, set: setMultiBranchEnabled, id: "bs-multi-branch" },
            { label: "VAT Registered", description: "Apply VAT to invoices and quotes", value: vatRegistered, set: setVatRegistered, id: "bs-vat" },
          ].map((mod) => (
            <div key={mod.id} className="flex items-center gap-4 border border-border p-3">
              <Checkbox id={mod.id} checked={mod.value} onCheckedChange={(c) => mod.set(!!c)} className="rounded-xl" data-testid={`toggle-${mod.id}`} />
              <label htmlFor={mod.id} className="flex-1 cursor-pointer">
                <div className="font-semibold text-sm">{mod.label}</div>
                <div className="text-xs text-muted-foreground">{mod.description}</div>
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="">Accounting Integration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ACCOUNTING_PROVIDERS.map((ap) => (
              <button
                key={ap.value}
                type="button"
                onClick={() => setAccountingProvider(ap.value)}
                className={`border p-3 text-left text-sm font-semibold transition-colors flex items-center gap-1.5 ${accountingProvider === ap.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
              >
                {accountingProvider === ap.value && <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />}
                {ap.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="">Communication Channels</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {COMMUNICATION_CHANNELS.map((ch) => (
              <div key={ch.value} className="flex items-center gap-3 border border-border p-3">
                <Checkbox
                  id={`bs-ch-${ch.value}`}
                  checked={communicationChannels.includes(ch.value)}
                  onCheckedChange={(c) => {
                    if (c) setCommunicationChannels([...communicationChannels, ch.value]);
                    else setCommunicationChannels(communicationChannels.filter((x) => x !== ch.value));
                  }}
                  className="rounded-xl"
                />
                <label htmlFor={`bs-ch-${ch.value}`} className="font-semibold text-sm cursor-pointer">{ch.label}</label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="">AI Modules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {AI_MODULES.map((ai) => (
              <div key={ai.value} className="flex items-center gap-3 border border-border p-3">
                <Checkbox
                  id={`bs-ai-${ai.value}`}
                  checked={aiModulesEnabled.includes(ai.value)}
                  onCheckedChange={(c) => {
                    if (c) setAiModulesEnabled([...aiModulesEnabled, ai.value]);
                    else setAiModulesEnabled(aiModulesEnabled.filter((x) => x !== ai.value));
                  }}
                  className="rounded-xl"
                />
                <label htmlFor={`bs-ai-${ai.value}`} className="font-semibold text-sm cursor-pointer">{ai.label}</label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateModules.isPending} className="rounded-xl font-bold" data-testid="btn-save-business-setup">
          {updateModules.isPending ? "Saving..." : "Save Business Setup"}
        </Button>
      </div>
    </div>
  );
}
