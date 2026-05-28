import { useState } from "react";
import { Link } from "wouter";
import {
  useListLeads,
  useCreateLead,
  getListLeadsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Target, AlertCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABEL: Record<string, string> = {
  new: "NEW",
  contacted: "CONTACTED",
  qualified: "QUALIFIED",
  won: "WON",
  lost: "LOST",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  new: "default",
  contacted: "secondary",
  qualified: "secondary",
  won: "outline",
  lost: "destructive",
};

const PLATFORM_SOURCES = ["myjobquote", "checkatrade"] as const;

const MANUAL_SOURCES = ["manual", "website", "referral", "marketplace", "booking_widget"];

function isPlatformSource(source: string): boolean {
  return PLATFORM_SOURCES.includes(source as (typeof PLATFORM_SOURCES)[number]);
}

function isManualSource(source: string): boolean {
  return MANUAL_SOURCES.includes(source) || !isPlatformSource(source);
}

function PlatformBadge({ source }: { source: string }) {
  if (source === "myjobquote") {
    return (
      <Badge
        className="rounded-xl font-bold text-[10px] bg-orange-600 hover:bg-orange-600 text-white"
        data-testid="badge-myjobquote"
      >
        MyJobQuote
      </Badge>
    );
  }
  if (source === "checkatrade") {
    return (
      <Badge
        className="rounded-xl font-bold text-[10px] bg-teal-600 hover:bg-teal-600 text-white"
        data-testid="badge-checkatrade"
      >
        Checkatrade
      </Badge>
    );
  }
  return null;
}

function fmtGbp(pence: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(pence / 100);
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

function TabBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-primary/20 text-primary text-[10px] font-bold min-w-[18px] h-[18px] px-1">
      {count > 99 ? "99+" : count}
    </span>
  );
}

type Lead = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source: string;
  sourceDetail?: string | null;
  status: string;
  score: number;
  valuePence: number;
  ownerUserName?: string | null;
  followUpDueAt?: string | null;
  followUpOverdue: boolean;
  createdAt: string;
};

function LeadTableRows({ leads, showImportTime }: { leads: Lead[]; showImportTime?: boolean }) {
  return (
    <>
      {leads.map((l) => {
        const isUncontacted = l.status === "new" && isPlatformSource(l.source);
        return (
          <TableRow
            key={l.id}
            data-testid={`row-lead-${l.id}`}
            className={`cursor-pointer hover:bg-muted/30 ${isUncontacted ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}`}
          >
            <TableCell>
              <div className="flex items-center gap-2">
                {isUncontacted && (
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Uncontacted" />
                )}
                <div>
                  <Link href={`/leads/${l.id}`} className="font-medium hover:underline">
                    {l.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">{l.email ?? l.phone ?? "—"}</div>
                </div>
              </div>
            </TableCell>
            <TableCell>
              {isPlatformSource(l.source) ? (
                <div className="space-y-1">
                  <PlatformBadge source={l.source} />
                  {l.sourceDetail && <div className="text-xs text-muted-foreground">{l.sourceDetail}</div>}
                </div>
              ) : (
                <div>
                  <div className="text-sm font-mono">{l.source}</div>
                  {l.sourceDetail && <div className="text-xs text-muted-foreground">{l.sourceDetail}</div>}
                </div>
              )}
            </TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[l.status] ?? "default"} className="rounded-xl font-bold text-[10px]">
                {STATUS_LABEL[l.status] ?? l.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right font-mono font-bold">{l.score}</TableCell>
            <TableCell className="text-sm">{l.ownerUserName ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
            <TableCell className="text-right font-mono">{l.valuePence > 0 ? fmtGbp(l.valuePence) : "—"}</TableCell>
            {showImportTime ? (
              <TableCell>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-mono ${isUncontacted ? "text-amber-700 font-bold" : "text-muted-foreground"}`}
                  data-testid={`import-time-${l.id}`}
                >
                  <Clock className="h-3 w-3" />
                  {timeAgo(l.createdAt)}
                </span>
              </TableCell>
            ) : (
              <TableCell>
                {l.followUpOverdue ? (
                  <span className="inline-flex items-center gap-1 text-destructive text-xs font-bold">
                    <AlertCircle className="h-3 w-3" /> Overdue
                  </span>
                ) : l.followUpDueAt ? (
                  <span className="text-xs text-muted-foreground">{new Date(l.followUpDueAt).toLocaleDateString("en-GB")}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
            )}
          </TableRow>
        );
      })}
    </>
  );
}

function LeadTable({ leads, showImportTime, emptyMessage }: { leads: Lead[]; showImportTime?: boolean; emptyMessage: string }) {
  if (leads.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyMessage}</p>;
  }
  return (
    <div className="overflow-x-auto"><Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Score</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead className="text-right">Value</TableHead>
          <TableHead>{showImportTime ? "Imported" : "Follow-up"}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <LeadTableRows leads={leads} showImportTime={showImportTime} />
      </TableBody>
    </Table></div>
  );
}

export function AppLeads() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("all");

  const params = statusFilter !== "all" ? { status: statusFilter } : {};
  const { data, isLoading } = useListLeads(params);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const create = useCreateLead({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        toast({ title: "Lead added" });
        setOpen(false);
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pounds = parseFloat(String(fd.get("value") ?? "0"));
    create.mutate({
      data: {
        name: String(fd.get("name") ?? "").trim(),
        email: (fd.get("email") as string) || undefined,
        phone: (fd.get("phone") as string) || undefined,
        company: (fd.get("company") as string) || undefined,
        title: (fd.get("title") as string) || undefined,
        message: (fd.get("message") as string) || undefined,
        source: (fd.get("source") as string) || "manual",
        sourceDetail: (fd.get("sourceDetail") as string) || undefined,
        valuePence: Number.isFinite(pounds) && pounds > 0 ? Math.round(pounds * 100) : undefined,
      },
    });
  }

  const allLeads = (data ?? []) as Lead[];

  const platformLeads = allLeads
    .filter((l) => isPlatformSource(l.source))
    .sort((a, b) => {
      const aUncontacted = a.status === "new" ? 0 : 1;
      const bUncontacted = b.status === "new" ? 0 : 1;
      if (aUncontacted !== bUncontacted) return aUncontacted - bUncontacted;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const manualLeads = allLeads.filter((l) => isManualSource(l.source));

  const uncontactedPlatformCount = platformLeads.filter((l) => l.status === "new").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-y-3">
        <h1 className="text-2xl sm:text-3xl font-bold">Leads</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl font-bold" data-testid="button-new-lead">
              <Plus className="h-4 w-4 mr-2" /> New Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-xl">
            <DialogHeader>
              <DialogTitle className="">New Lead</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-3">
              <div><Label>Name</Label><Input name="name" required data-testid="input-lead-name" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input name="email" type="email" /></div>
                <div><Label>Phone</Label><Input name="phone" /></div>
              </div>
              <div><Label>Company</Label><Input name="company" /></div>
              <div><Label>Job title / need</Label><Input name="title" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Source</Label>
                  <select name="source" defaultValue="manual" className="rounded-xl border border-input bg-background h-10 w-full px-3 text-sm" data-testid="select-lead-source">
                    <option value="manual">manual</option>
                    <option value="website">website</option>
                    <option value="referral">referral</option>
                    <option value="marketplace">marketplace</option>
                  </select>
                </div>
                <div><Label>Source detail</Label><Input name="sourceDetail" placeholder="e.g. Google Ads" /></div>
              </div>
              <div><Label>Estimated value (£)</Label><Input name="value" type="number" step="0.01" min="0" /></div>
              <div><Label>Message</Label><Textarea name="message" rows={3} /></div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending} className="rounded-xl font-bold">
                  {create.isPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-48">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="rounded-xl" data-testid="filter-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {uncontactedPlatformCount > 0 && activeTab !== "platform" && (
          <button
            onClick={() => setActiveTab("platform")}
            className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 border border-amber-300 bg-amber-50 px-2.5 py-1.5 hover:bg-amber-100 transition-colors"
            data-testid="alert-uncontacted-platform"
          >
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            {uncontactedPlatformCount} uncontacted platform {uncontactedPlatformCount === 1 ? "lead" : "leads"}
          </button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="leads-tabs">
        <TabsList className="rounded-xl h-auto p-0 bg-transparent border-b border-border w-full justify-start gap-0">
          <TabsTrigger
            value="all"
            className="rounded-xl border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-5 py-2.5 text-xs font-bold"
            data-testid="tab-all"
          >
            All
            <TabBadge count={allLeads.length} />
          </TabsTrigger>
          <TabsTrigger
            value="platform"
            className="rounded-xl border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-5 py-2.5 text-xs font-bold"
            data-testid="tab-platform"
          >
            Platform
            <TabBadge count={platformLeads.length} />
          </TabsTrigger>
          <TabsTrigger
            value="manual"
            className="rounded-xl border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-5 py-2.5 text-xs font-bold"
            data-testid="tab-manual"
          >
            Manual
            <TabBadge count={manualLeads.length} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-0 pt-4">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className=" flex items-center gap-2">
                <Target className="h-5 w-5" /> All Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <LeadTable
                  leads={allLeads}
                  emptyMessage="No leads yet. Capture some via the embed snippet in Settings, or add one manually."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="platform" className="mt-0 pt-4">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className=" flex items-center gap-2">
                <Target className="h-5 w-5" /> Platform Inbox
                {uncontactedPlatformCount > 0 && (
                  <span className="ml-auto text-xs font-bold normal-case tracking-normal text-amber-700 flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
                    {uncontactedPlatformCount} need contact
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48" />
              ) : platformLeads.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-sm">No platform leads yet.</p>
                  <p className="text-muted-foreground text-xs">Leads imported from MyJobQuote or Checkatrade will appear here, sorted by urgency.</p>
                </div>
              ) : (
                <>
                  {uncontactedPlatformCount > 0 && (
                    <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>
                        <span className="font-bold">{uncontactedPlatformCount} uncontacted</span>{" "}
                        {uncontactedPlatformCount === 1 ? "lead requires" : "leads require"} a response — platform SLAs may apply.
                        Highlighted rows have not been contacted yet.
                      </span>
                    </div>
                  )}
                  <LeadTable
                    leads={platformLeads}
                    showImportTime
                    emptyMessage="No platform leads match the current filter."
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual" className="mt-0 pt-4">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className=" flex items-center gap-2">
                <Target className="h-5 w-5" /> Manual Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <LeadTable
                  leads={manualLeads}
                  emptyMessage="No manually-created leads yet. Add one or capture via the embed snippet in Settings."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
