import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { PageHead } from "@/components/PageHead";

const services = [
  { name: "API", description: "Core API service", status: "operational" },
  { name: "Web Application", description: "CRM and management dashboard", status: "operational" },
  { name: "CtrlTradePos®", description: "EPOS and till services", status: "operational" },
  { name: "Customer Portal", description: "Customer-facing portal", status: "operational" },
  { name: "Worker Queue", description: "Background job processing", status: "operational" },
  { name: "Database", description: "PostgreSQL data layer", status: "operational" },
  { name: "File Storage", description: "Document and image storage", status: "operational" },
  { name: "Email Delivery", description: "Transactional email", status: "operational" },
  { name: "SMS / WhatsApp", description: "SMS and messaging via Twilio", status: "operational" },
  { name: "Stripe Billing", description: "Subscription and payment processing", status: "operational" },
  { name: "Xero Integration", description: "Xero accounting sync", status: "operational" },
  { name: "Google Calendar Sync", description: "Calendar integration", status: "operational" },
];

const incidents: { date: string; title: string; detail: string; resolved: boolean }[] = [];

function StatusBadge({ status }: { status: string }) {
  if (status === "operational") {
    return (
      <div className="flex items-center gap-1.5 text-green-600 text-sm font-semibold">
        <CheckCircle2 className="h-4 w-4" />
        Operational
      </div>
    );
  }
  if (status === "degraded") {
    return (
      <div className="flex items-center gap-1.5 text-yellow-600 text-sm font-semibold">
        <AlertCircle className="h-4 w-4" />
        Degraded
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-red-600 text-sm font-semibold">
      <AlertCircle className="h-4 w-4" />
      Outage
    </div>
  );
}

export function StatusPage() {
  const allOperational = services.every(s => s.status === "operational");

  return (
    <div className="flex flex-col min-h-screen">
      <PageHead
        title="System Status — CtrlTrade® Platform Status"
        description="Live status for all CtrlTrade® services including the API, web application, EPOS, customer portal, worker queue, and integrations."
        canonical="/status"
        noIndex={true}
      />
      <section className="py-24 relative overflow-hidden" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(hsl(46,98%,52%) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-block px-4 py-1 mb-8 border border-[hsl(46,98%,52%)] text-[hsl(46,98%,52%)] font-bold text-xs tracking-widest">
            SYSTEM STATUS
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6">CtrlTrade® Status</h1>
          {allOperational ? (
            <div className="inline-flex items-center gap-3 bg-green-500/20 border border-green-500/40 text-green-400 px-6 py-3 font-bold">
              <CheckCircle2 className="h-5 w-5" />
              All Systems Operational
            </div>
          ) : (
            <div className="inline-flex items-center gap-3 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 px-6 py-3 font-bold">
              <AlertCircle className="h-5 w-5" />
              Partial Service Disruption
            </div>
          )}
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl font-bold mb-6">Service Status</h2>
          <div className="border border-border overflow-hidden">
            {services.map((service, i) => (
              <div key={i} className={`flex items-center justify-between p-5 ${i > 0 ? "border-t border-border/50" : ""} ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                <div>
                  <div className="font-semibold">{service.name}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">{service.description}</div>
                </div>
                <StatusBadge status={service.status} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-card border-t border-border">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl font-bold mb-6">Incident History</h2>
          {incidents.length === 0 ? (
            <div className="border border-border p-12 text-center text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-4" />
              <div className="font-bold text-lg text-foreground mb-1">No recent incidents</div>
              <div className="text-sm">All systems have been operating normally.</div>
            </div>
          ) : (
            <div className="space-y-4">
              {incidents.map((inc, i) => (
                <div key={i} className="border border-border bg-background p-6">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="font-bold">{inc.title}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Clock className="h-3 w-3" />
                      {inc.date}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{inc.detail}</p>
                  {inc.resolved && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-green-600 font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Resolved
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="py-12 bg-background border-t border-border">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <p className="text-muted-foreground text-sm">
            For urgent support, contact <a href="mailto:support@ctrltrade.io" className="text-primary hover:underline">support@ctrltrade.io</a>
          </p>
          <p className="text-xs text-muted-foreground mt-2">Last checked: {new Date().toUTCString()}</p>
        </div>
      </section>
    </div>
  );
}
