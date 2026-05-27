import { useState } from "react";
import {
  useListVehicles,
  useCreateVehicle,
  useListTeam,
  useListLatestVehicleLocations,
  getListVehiclesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Truck, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function fmtDate(s: string | null | undefined) {
  return s ? new Date(s).toLocaleDateString() : "—";
}

export function AppFleet() {
  const { data, isLoading } = useListVehicles();
  const { data: locations } = useListLatestVehicleLocations();
  const { data: team } = useListTeam();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [assignedDriverId, setAssignedDriverId] = useState<string>("");
  const create = useCreateVehicle({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
        toast({ title: "Vehicle added" });
        setOpen(false);
        setAssignedDriverId("");
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const toIso = (k: string) => {
      const v = fd.get(k) as string;
      return v ? new Date(v).toISOString() : undefined;
    };
    create.mutate({
      data: {
        label: String(fd.get("label") ?? ""),
        registration: String(fd.get("registration") ?? ""),
        make: (fd.get("make") as string) || undefined,
        model: (fd.get("model") as string) || undefined,
        year: fd.get("year") ? Number(fd.get("year")) : undefined,
        motDueAt: toIso("motDueAt"),
        taxDueAt: toIso("taxDueAt"),
        serviceDueAt: toIso("serviceDueAt"),
        assignedDriverId: assignedDriverId || undefined,
      },
    });
  }

  const locationByVehicle = new Map((locations ?? []).map((l) => [l.vehicleId, l]));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold uppercase tracking-tighter">Fleet</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-none uppercase tracking-wider font-bold" data-testid="button-new-vehicle">
              <Plus className="h-4 w-4 mr-2" /> New Vehicle
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-none max-w-xl">
            <DialogHeader><DialogTitle className="uppercase tracking-tighter">New Vehicle</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Label</Label><Input name="label" required placeholder="Van 1" /></div>
                <div><Label>Registration</Label><Input name="registration" required placeholder="AB12 CDE" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Make</Label><Input name="make" /></div>
                <div><Label>Model</Label><Input name="model" /></div>
                <div><Label>Year</Label><Input name="year" type="number" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>MOT due</Label><Input name="motDueAt" type="date" /></div>
                <div><Label>Tax due</Label><Input name="taxDueAt" type="date" /></div>
                <div><Label>Service due</Label><Input name="serviceDueAt" type="date" /></div>
              </div>
              <div>
                <Label>Assigned driver</Label>
                <Select value={assignedDriverId} onValueChange={setAssignedDriverId}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>{team?.members?.map((m: any) => <SelectItem key={m.userId} value={m.userId}>{m.name ?? m.email}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending} className="rounded-none uppercase tracking-wider font-bold">
                  {create.isPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className=" border-border shadow-sm">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight flex items-center gap-2"><Truck className="h-5 w-5" /> Vehicles</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-48" /> : !data || data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No vehicles yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Label</TableHead><TableHead>Reg</TableHead>
                <TableHead>Driver</TableHead><TableHead>MOT</TableHead>
                <TableHead>Tax</TableHead><TableHead>Service</TableHead>
                <TableHead>Last seen</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.map((v) => {
                  const loc = locationByVehicle.get(v.id);
                  return (
                    <TableRow key={v.id} data-testid={`row-vehicle-${v.id}`}>
                      <TableCell className="font-medium">{v.label}</TableCell>
                      <TableCell className="font-mono">{v.registration}</TableCell>
                      <TableCell>{v.assignedDriverName ?? "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{fmtDate(v.motDueAt)}</TableCell>
                      <TableCell className="font-mono text-sm">{fmtDate(v.taxDueAt)}</TableCell>
                      <TableCell className="font-mono text-sm">{fmtDate(v.serviceDueAt)}</TableCell>
                      <TableCell className="text-xs">
                        {loc ? <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{Number(loc.lat).toFixed(3)}, {Number(loc.lng).toFixed(3)}</span> : "—"}
                      </TableCell>
                      <TableCell><Badge variant="outline" className="rounded-none uppercase">{v.status}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
