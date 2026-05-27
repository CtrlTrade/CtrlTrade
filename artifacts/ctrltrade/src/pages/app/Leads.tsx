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
import { Plus, Target, AlertCircle } from "lucide-react";
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

function fmtGbp(pence: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(pence / 100);
}

export function AppLeads() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const params = {
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    ...(sourceFilter !== "all" ? { source: sourceFilter } : {}),
  };
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold uppercase tracking-tighter">Leads</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-none uppercase tracking-wider font-bold" data-testid="button-new-lead">
              <Plus className="h-4 w-4 mr-2" /> New Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-none">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-tighter">New Lead</DialogTitle>
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
                  <select name="source" defaultValue="manual" className="rounded-none border border-input bg-background h-10 w-full px-3 text-sm" data-testid="select-lead-source">
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
                <Button type="submit" disabled={create.isPending} className="rounded-none uppercase tracking-wider font-bold">
                  {create.isPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3">
        <div className="w-48">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="rounded-none" data-testid="filter-status"><SelectValue /></SelectTrigger>
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
        <div className="w-48">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Source</Label>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="rounded-none" data-testid="filter-source"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="website">Website</SelectItem>
              <SelectItem value="referral">Referral</SelectItem>
              <SelectItem value="marketplace">Marketplace</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="rounded-none border-border shadow-sm">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight flex items-center gap-2">
            <Target className="h-5 w-5" /> Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48" />
          ) : !data || data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No leads yet. Capture some via the embed snippet in Settings, or add one manually.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Follow-up</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((l) => (
                  <TableRow key={l.id} data-testid={`row-lead-${l.id}`} className="cursor-pointer hover:bg-muted/30">
                    <TableCell>
                      <Link href={`/leads/${l.id}`} className="font-medium hover:underline">
                        {l.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{l.email ?? l.phone ?? "—"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm uppercase tracking-wider font-mono">{l.source}</div>
                      {l.sourceDetail && <div className="text-xs text-muted-foreground">{l.sourceDetail}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[l.status] ?? "default"} className="rounded-none uppercase tracking-wider font-bold text-[10px]">
                        {STATUS_LABEL[l.status] ?? l.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">{l.score}</TableCell>
                    <TableCell className="text-right font-mono">{l.valuePence > 0 ? fmtGbp(l.valuePence) : "—"}</TableCell>
                    <TableCell>
                      {l.followUpOverdue ? (
                        <span className="inline-flex items-center gap-1 text-destructive text-xs font-bold uppercase tracking-wider">
                          <AlertCircle className="h-3 w-3" /> Overdue
                        </span>
                      ) : l.followUpDueAt ? (
                        <span className="text-xs text-muted-foreground">{new Date(l.followUpDueAt).toLocaleDateString("en-GB")}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
