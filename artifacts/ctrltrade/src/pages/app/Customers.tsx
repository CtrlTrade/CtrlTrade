import { useState } from "react";
import { useListCustomers, useCreateCustomer, useListBranches, getListCustomersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Users as UsersIcon, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export function AppCustomers() {
  const { data, isLoading } = useListCustomers();
  const { data: branches } = useListBranches();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const branchList = branches ?? [];
  const filteredCustomers = (data ?? []).filter((c) =>
    branchFilter === "all" ? true : (c as any).branchId === branchFilter,
  );
  const create = useCreateCustomer({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        toast({ title: "Customer created" });
        setOpen(false);
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    create.mutate({
      data: {
        name: String(fd.get("name") ?? "").trim(),
        email: (fd.get("email") as string) || undefined,
        phone: (fd.get("phone") as string) || undefined,
        addressLine1: (fd.get("addressLine1") as string) || undefined,
        city: (fd.get("city") as string) || undefined,
        postcode: (fd.get("postcode") as string) || undefined,
        notes: (fd.get("notes") as string) || undefined,
      },
    });
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-y-3">
        <h1 className="text-2xl sm:text-3xl font-bold">Customers</h1>
        <div className="flex items-center gap-3">
          {branchList.length > 0 && (
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-44 rounded-xl text-xs" data-testid="select-branch-filter-customers">
                <SelectValue placeholder="All branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {branchList.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl font-bold" data-testid="button-new-customer">
              <Plus className="h-4 w-4 mr-2" /> New Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-xl">
            <DialogHeader>
              <DialogTitle className="">New Customer</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-3">
              <div><Label>Name</Label><Input name="name" required data-testid="input-customer-name" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input name="email" type="email" /></div>
                <div><Label>Phone</Label><Input name="phone" /></div>
              </div>
              <div><Label>Address</Label><Input name="addressLine1" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>City</Label><Input name="city" /></div>
                <div><Label>Postcode</Label><Input name="postcode" /></div>
              </div>
              <div><Label>Notes</Label><Textarea name="notes" /></div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending} className="rounded-xl font-bold">
                  {create.isPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className=" border-border shadow-sm">
        <CardHeader>
          <CardTitle className=" flex items-center gap-2">
            <UsersIcon className="h-5 w-5" /> All customers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48" />
          ) : filteredCustomers.length === 0 ? (
            <p className="text-muted-foreground text-sm">No customers{branchFilter !== "all" ? " for this branch" : " yet. Add your first one."}.</p>
          ) : (
            <div className="overflow-x-auto"><Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead><TableHead>City</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((c) => (
                  <TableRow
                    key={c.id}
                    data-testid={`row-customer-${c.id}`}
                    className="cursor-pointer hover:bg-muted/30"
                  >
                    <TableCell className="font-medium">
                      <Link href={`/customers/${c.id}`} className="flex items-center gap-1 hover:text-primary">
                        {c.name} <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      </Link>
                    </TableCell>
                    <TableCell>{c.email ?? "—"}</TableCell>
                    <TableCell>{c.phone ?? "—"}</TableCell>
                    <TableCell>{c.city ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table></div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
