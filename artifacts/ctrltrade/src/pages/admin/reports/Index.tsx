import { Link } from "wouter";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PoundSterling, Building2, Cpu, GitBranch, BarChart3 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

const CARDS: Array<{ href: string; title: string; description: string; Icon: any }> = [
  {
    href: "/reports/revenue",
    title: "Revenue",
    description: "Cross-tenant MRR, ARR, and payment collection over time.",
    Icon: PoundSterling,
  },
  {
    href: "/reports/tenant-activity",
    title: "Tenant Activity",
    description: "Jobs, quotes, and invoices created per tenant.",
    Icon: Building2,
  },
  {
    href: "/reports/usage",
    title: "Usage",
    description: "AI, voice, and SMS consumption across all tenants.",
    Icon: Cpu,
  },
  {
    href: "/reports/referrals",
    title: "Referrals & Growth",
    description: "Referral conversions, partner-driven signups, and growth trends.",
    Icon: GitBranch,
  },
];

export function AdminReportsIndex() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <AdminPageHeader
        title="Platform Reports"
        subtitle="Cross-tenant analytics and platform-level metrics."
        icon={<BarChart3 className="h-6 w-6" />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href}>
            <Card
              className="border-zinc-800 bg-black hover:border-primary cursor-pointer transition-colors h-full shadow-none rounded-none"
              data-testid={`admin-report-card-${c.href.split("/").pop()}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="uppercase tracking-tight text-lg text-zinc-100">{c.title}</CardTitle>
                  <c.Icon className="h-5 w-5 text-zinc-500" />
                </div>
                <CardDescription className="text-sm text-zinc-500">{c.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
