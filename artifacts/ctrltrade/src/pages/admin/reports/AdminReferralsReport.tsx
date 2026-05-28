import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export function AdminReferralsReport() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/reports">
          <button className="text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tighter text-white">Referrals & Growth</h1>
          <p className="text-sm text-zinc-500 mt-1">Referral conversions, partner-driven signups, and growth trends.</p>
        </div>
      </div>

      <Card className="rounded-none border-zinc-800 bg-black shadow-none">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight text-zinc-100">Referral & Growth Metrics</CardTitle>
          <CardDescription>Track partner conversions and new tenant acquisition over time.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-12 text-center text-zinc-600 font-mono text-sm border border-dashed border-zinc-800">
            Referral and growth data coming soon.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
