import { useState } from "react";
import { Link } from "wouter";
import { useListAdminTenants } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ShieldCheck } from "lucide-react";

export function AdminTenants() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  const { data: tenants, isLoading } = useListAdminTenants({ 
    query: { queryKey: ["adminTenants", search, statusFilter] }
  });

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold uppercase tracking-tighter text-white">Tenants Directory</h1>
      </div>

      <Card className="rounded-none border-zinc-800 bg-black shadow-none p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
            <Input 
              placeholder="Search by name, email, or ID..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-none border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 focus:border-red-500"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] rounded-none border-zinc-700 bg-zinc-900 text-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="rounded-none border-zinc-700 bg-zinc-900 text-white">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="past_due">Past Due</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="border border-zinc-800 bg-black">
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-zinc-800 font-bold uppercase text-xs tracking-wider text-zinc-500">
          <div className="col-span-4">Tenant</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-3">Resources</div>
          <div className="col-span-2">MRR</div>
          <div className="col-span-1 text-right">Action</div>
        </div>
        
        {isLoading ? (
          <div className="p-4 space-y-4">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 bg-zinc-900" />)}
          </div>
        ) : tenants?.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 font-mono">No tenants found matching criteria.</div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {tenants?.map(tenant => (
              <div key={tenant.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-zinc-900/50 transition-colors">
                <div className="col-span-4">
                  <div className="font-bold text-zinc-200 uppercase text-sm truncate">{tenant.name}</div>
                  <div className="text-xs text-zinc-500 font-mono truncate">{tenant.ownerEmail}</div>
                </div>
                <div className="col-span-2">
                  <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                    tenant.status === 'active' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                    tenant.status === 'trial' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                    tenant.status === 'cancelled' ? 'bg-zinc-800 text-zinc-400 border border-zinc-700' :
                    'bg-red-500/10 text-red-500 border border-red-500/20'
                  }`}>
                    {tenant.status}
                  </span>
                </div>
                <div className="col-span-3 text-xs text-zinc-400 font-mono">
                  {tenant.controlSeats}C / {tenant.fieldSeats}F / {tenant.tills}T
                </div>
                <div className="col-span-2 font-mono text-zinc-300 font-bold flex items-center gap-2">
                  £{tenant.monthlyTotal}
                  {(tenant as any).require2fa && (
                    <ShieldCheck className="h-3 w-3 text-green-500" aria-label="2FA enforced" />
                  )}
                </div>
                <div className="col-span-1 text-right">
                  <Link href={`/admin/tenants/${tenant.id}`} className="text-xs uppercase font-bold text-red-500 hover:text-red-400">
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
