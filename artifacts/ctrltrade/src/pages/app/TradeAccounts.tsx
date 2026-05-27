import { useState } from "react";
import {
  useListTradeAccounts,
  useCreateTradeAccount,
  getListTradeAccountsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function AppTradeAccounts() {
  const { data, isLoading } = useListTradeAccounts();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const create = useCreateTradeAccount({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTradeAccountsQueryKey() });
        toast({ title: "Trade account created" });
        setOpen(false);
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold uppercase tracking-tighter">Trade Accounts</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-none uppercase tracking-wider font-bold" data-testid="button-new-trade-account">
              <Plus className="h-4 w-4 mr-2" /> New Trade Account
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-none">
            <DialogHeader><DialogTitle className="uppercase tracking-tighter">New Trade Account</DialogTitle></DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const creditStr = String(fd.get("credit") ?? "0").trim();
                create.mutate({
                  data: {
                    accountCode: String(fd.get("accountCode") ?? "").trim(),
                    name: String(fd.get("name") ?? "").trim(),
                    email: (fd.get("email") as string) || undefined,
                    phone: (fd.get("phone") as string) || undefined,
                    pricingTier: String(fd.get("pricingTier") ?? "trade"),
                    discountPct: parseInt(String(fd.get("discountPct") ?? "0"), 10),
                    creditLimitPence: Math.round(parseFloat(creditStr || "0") * 100),
                    paymentTermsDays: parseInt(String(fd.get("paymentTermsDays") ?? "30"), 10),
                  },
                });
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Account code</Label><Input name="accountCode" required data-testid="input-trade-code" /></div>
                <div>
                  <Label>Tier</Label>
                  <select name="pricingTier" className="w-full border border-input bg-background px-3 py-2 text-sm">
                    <option value="trade">Trade</option>
                    <option value="contractor">Contractor</option>
                    <option value="wholesale">Wholesale</option>
                  </select>
                </div>
              </div>
              <div><Label>Name</Label><Input name="name" required data-testid="input-trade-name" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input name="email" type="email" /></div>
                <div><Label>Phone</Label><Input name="phone" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Discount %</Label><Input name="discountPct" type="number" defaultValue="0" /></div>
                <div><Label>Credit limit £</Label><Input name="credit" type="number" step="0.01" defaultValue="0" /></div>
                <div><Label>Terms (days)</Label><Input name="paymentTermsDays" type="number" defaultValue="30" /></div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending} className="rounded-none uppercase tracking-wider font-bold">Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className=" border-border shadow-sm">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5" /> Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-48" /> : !data || data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No trade accounts yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Tier</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Balance / Limit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((t) => (
                  <TableRow key={t.id} data-testid={`row-trade-${t.id}`}>
                    <TableCell className="font-mono text-xs">{t.accountCode}</TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="uppercase text-xs">{t.pricingTier}</TableCell>
                    <TableCell className="text-right">{t.discountPct}%</TableCell>
                    <TableCell className="text-right">
                      £{(t.balancePence / 100).toFixed(2)} / £{(t.creditLimitPence / 100).toFixed(2)}
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
