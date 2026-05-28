import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export function AdminRevenueReport() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/reports">
          <button className="text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white">Revenue</h1>
          <p className="text-sm text-zinc-500 mt-1">Cross-tenant MRR, ARR, and payment collection over time.</p>
        </div>
      </div>

      <Card className="rounded-xl border-zinc-800 bg-black shadow-none">
        <CardHeader>
          <CardTitle className=" text-zinc-100">Cross-Tenant Revenue</CardTitle>
          <CardDescription>Platform-wide billing and collection metrics.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-12 text-center text-zinc-600 font-mono text-sm border border-dashed border-zinc-800">
            Revenue data coming soon.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
