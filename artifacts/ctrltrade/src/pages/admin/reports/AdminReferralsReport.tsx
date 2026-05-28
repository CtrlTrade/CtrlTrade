import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export function AdminReferralsReport() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/reports">
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white">Referrals & Growth</h1>
          <p className="text-sm text-muted-foreground mt-1">Referral conversions, partner-driven signups, and growth trends.</p>
        </div>
      </div>

      <Card className="rounded-xl border-border bg-black shadow-none">
        <CardHeader>
          <CardTitle className=" text-foreground">Referral & Growth Metrics</CardTitle>
          <CardDescription>Track partner conversions and new tenant acquisition over time.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-12 text-center text-muted-foreground font-mono text-sm border border-dashed border-border">
            Referral and growth data coming soon.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
