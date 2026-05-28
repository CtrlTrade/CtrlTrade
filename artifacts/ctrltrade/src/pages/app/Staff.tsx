import { useState } from "react";
import {
  useListTeam,
  useInviteTeamMember,
  useResendInvitation,
  useRevokeInvitation,
  useUpdateMember,
  useRemoveMember,
  useSendMemberPasswordReset,
  getListTeamQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Trash2, RotateCw, KeyRound, Power, Pencil, Check, X } from "lucide-react";

export function AppStaff() {
  const { data, isLoading } = useListTeam();
  const qc = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListTeamQueryKey() });

  const invite = useInviteTeamMember({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Invitation sent" }); } , onError: (e: any) => toast({ title: "Invite failed", description: e?.message, variant: "destructive" }) } });
  const resend = useResendInvitation({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Invitation resent" }); } } });
  const revoke = useRevokeInvitation({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Invitation revoked" }); } } });
  const update = useUpdateMember({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Member updated" }); }, onError: (e: any) => toast({ title: "Update failed", description: e?.message, variant: "destructive" }) } });
  const remove = useRemoveMember({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Member removed" }); } } });
  const pwReset = useSendMemberPasswordReset({ mutation: { onSuccess: () => toast({ title: "Password reset email sent" }) } });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "staff">("staff");
  const [seatType, setSeatType] = useState<"control" | "field">("field");
  const [editingRateUserId, setEditingRateUserId] = useState<string | null>(null);
  const [rateInput, setRateInput] = useState("");

  if (isLoading || !data) return <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;

  const usage = data.seatUsage;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold uppercase tracking-tighter">Staff</h2>
        <p className="text-sm text-muted-foreground">Invite teammates, manage roles, and toggle access.</p>
      </div>

      <Card className=" border-border">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight text-base">Seat usage</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-sm">
          <div><div className="text-xs uppercase text-muted-foreground">Control seats</div><div className="text-2xl font-bold" data-testid="text-control-seat-usage">{usage.controlSeatsUsed} / {usage.controlSeatsLimit}</div></div>
          <div><div className="text-xs uppercase text-muted-foreground">Field seats</div><div className="text-2xl font-bold" data-testid="text-field-seat-usage">{usage.fieldSeatsUsed} / {usage.fieldSeatsLimit}</div></div>
          <div><div className="text-xs uppercase text-muted-foreground">Tills</div><div className="text-2xl font-bold">{usage.tillsLimit}</div></div>
        </CardContent>
      </Card>

      <Card className=" border-border">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight text-base">Invite teammate</CardTitle>
          <CardDescription>They'll get a magic link to set up their account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-3 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              invite.mutate(
                { data: { email, role, seatType } },
                { onSuccess: () => { setEmail(""); } },
              );
            }}
          >
            <div>
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="rounded-none" data-testid="input-invite-email" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as any)}>
                <SelectTrigger className="rounded-none" data-testid="select-invite-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Seat type</Label>
              <Select value={seatType} onValueChange={(v) => setSeatType(v as any)}>
                <SelectTrigger className="rounded-none" data-testid="select-invite-seat"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="control">Control (£40)</SelectItem>
                  <SelectItem value="field">Field (£20)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={invite.isPending} className="rounded-none uppercase font-bold tracking-wider" data-testid="button-send-invite">
              {invite.isPending ? "Sending..." : "Send invite"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {data.invitations.length > 0 && (
        <Card className=" border-border">
          <CardHeader>
            <CardTitle className="uppercase tracking-tight text-base">Pending invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                <tr><th className="text-left py-2">Email</th><th className="text-left">Role</th><th className="text-left">Seat</th><th className="text-left">Expires</th><th className="text-right">Actions</th></tr>
              </thead>
              <tbody>
                {data.invitations.map((inv) => (
                  <tr key={inv.id} className="border-b border-border" data-testid={`row-invitation-${inv.email}`}>
                    <td className="py-2 font-medium">{inv.email}</td>
                    <td>{inv.role}</td>
                    <td>{inv.seatType}</td>
                    <td>{new Date(inv.expiresAt).toLocaleDateString()}</td>
                    <td className="text-right space-x-2">
                      <Button size="sm" variant="outline" className="rounded-none" onClick={() => resend.mutate({ invitationId: inv.id })}><RotateCw className="h-3 w-3 mr-1" />Resend</Button>
                      <Button size="sm" variant="outline" className="rounded-none" onClick={() => revoke.mutate({ invitationId: inv.id })}><Trash2 className="h-3 w-3 mr-1" />Revoke</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </CardContent>
        </Card>
      )}

      <Card className=" border-border">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight text-base">Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-2">Name</th>
                <th className="text-left">Email</th>
                <th className="text-left">Role</th>
                <th className="text-left">Seat</th>
                <th className="text-left">Hourly rate</th>
                <th className="text-left">Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.userId} className="border-b border-border" data-testid={`row-member-${m.email}`}>
                  <td className="py-2 font-medium">{m.name} {m.isYou && <span className="text-xs text-muted-foreground ml-1">(you)</span>}</td>
                  <td>{m.email}</td>
                  <td>
                    {m.role === "owner" ? (
                      <span className="uppercase text-xs font-bold">Owner</span>
                    ) : (
                      <Select value={m.role} onValueChange={(v) => update.mutate({ userId: m.userId, data: { role: v } })}>
                        <SelectTrigger className="rounded-none h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td>
                    {m.role === "owner" ? (
                      <span className="uppercase text-xs">{m.seatType}</span>
                    ) : (
                      <Select value={m.seatType} onValueChange={(v) => update.mutate({ userId: m.userId, data: { seatType: v } })}>
                        <SelectTrigger className="rounded-none h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="control">Control</SelectItem>
                          <SelectItem value="field">Field</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="min-w-[120px]">
                    {editingRateUserId === m.userId ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">£</span>
                        <Input
                          className="rounded-none h-7 w-20 font-mono text-sm"
                          type="number"
                          min="0"
                          step="0.01"
                          value={rateInput}
                          onChange={(e) => setRateInput(e.target.value)}
                          data-testid={`input-hourly-rate-${m.userId}`}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const pence = rateInput ? Math.round(parseFloat(rateInput) * 100) : null;
                              update.mutate({ userId: m.userId, data: { defaultHourlyRatePence: pence } });
                              setEditingRateUserId(null);
                            } else if (e.key === "Escape") {
                              setEditingRateUserId(null);
                            }
                          }}
                        />
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                          const pence = rateInput ? Math.round(parseFloat(rateInput) * 100) : null;
                          update.mutate({ userId: m.userId, data: { defaultHourlyRatePence: pence } });
                          setEditingRateUserId(null);
                        }}><Check className="h-3 w-3 text-emerald-600" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingRateUserId(null)}><X className="h-3 w-3" /></Button>
                      </div>
                    ) : (
                      <button
                        className="flex items-center gap-1.5 text-sm font-mono hover:underline group"
                        title="Click to edit hourly rate"
                        data-testid={`button-edit-hourly-rate-${m.userId}`}
                        onClick={() => {
                          setEditingRateUserId(m.userId);
                          setRateInput(m.defaultHourlyRatePence ? String((m.defaultHourlyRatePence / 100).toFixed(2)) : "");
                        }}
                      >
                        {m.defaultHourlyRatePence
                          ? <span>{new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(m.defaultHourlyRatePence / 100)}</span>
                          : <span className="text-muted-foreground text-xs">—</span>}
                        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                      </button>
                    )}
                  </td>
                  <td>
                    <span className={`uppercase text-xs font-bold ${m.status === "active" ? "text-emerald-600" : "text-muted-foreground"}`}>{m.status}</span>
                  </td>
                  <td className="text-right space-x-1">
                    {m.role !== "owner" && !m.isYou && (
                      <>
                        <Button size="sm" variant="outline" className="rounded-none" title="Send password reset" onClick={() => pwReset.mutate({ userId: m.userId })}><KeyRound className="h-3 w-3" /></Button>
                        <Button size="sm" variant="outline" className="rounded-none" title={m.status === "active" ? "Disable" : "Reactivate"} onClick={() => update.mutate({ userId: m.userId, data: { status: m.status === "active" ? "disabled" : "active" } })}><Power className="h-3 w-3" /></Button>
                        <Button size="sm" variant="outline" className="rounded-none" title="Remove" onClick={() => { if (confirm(`Remove ${m.email}?`)) remove.mutate({ userId: m.userId }); }}><Trash2 className="h-3 w-3" /></Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </CardContent>
      </Card>
    </div>
  );
}
