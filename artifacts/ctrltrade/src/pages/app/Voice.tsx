import { useState } from "react";
import {
  useListVoiceNumbers,
  useListAvailableVoiceNumbers,
  useProvisionVoiceNumber,
  useReleaseVoiceNumber,
  useListCallRecords,
  useListVoicemails,
  useMarkVoicemailListened,
  useMakeOutboundCall,
  useGetVoiceToken,
  getListVoiceNumbersQueryKey,
  getListCallRecordsQueryKey,
  getListVoicemailsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Phone, PhoneIncoming, PhoneOutgoing, Voicemail, Plus, Trash2, Play, PhoneCall, Mic, MicOff, PhoneOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatDuration(secs: number | null | undefined) {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function callStatusBadge(status: string) {
  const map: Record<string, string> = {
    completed: "bg-green-100 text-green-800",
    "in-progress": "bg-blue-100 text-blue-800",
    queued: "bg-yellow-100 text-yellow-800",
    failed: "bg-red-100 text-red-800",
    "no-answer": "bg-muted text-muted-foreground",
    initiated: "bg-yellow-100 text-yellow-800",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-none font-mono ${map[status] ?? "bg-muted"}`}>{status}</span>;
}

export function AppVoice() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState("numbers");
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [outboundOpen, setOutboundOpen] = useState(false);
  const [outboundTo, setOutboundTo] = useState("");
  const [country, setCountry] = useState("GB");
  const [searchCountry, setSearchCountry] = useState("GB");
  const [manualNumber, setManualNumber] = useState("");
  const [manualFriendly, setManualFriendly] = useState("");
  const [callActive, setCallActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [activeSid, setActiveSid] = useState<string | null>(null);

  const { data: numbersData, isLoading: numbersLoading } = useListVoiceNumbers();
  const { data: availableData, isLoading: availableLoading } = useListAvailableVoiceNumbers(
    { country: searchCountry } as any,
    { query: { enabled: provisionOpen } as any }
  );
  const { data: callsData, isLoading: callsLoading } = useListCallRecords({ limit: 50 } as any);
  const { data: voicemailsData } = useListVoicemails();

  const provision = useProvisionVoiceNumber({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListVoiceNumbersQueryKey() });
        setProvisionOpen(false);
        setManualNumber("");
        toast({ title: "Number provisioned" });
      },
      onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    },
  });

  const release = useReleaseVoiceNumber({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListVoiceNumbersQueryKey() });
        toast({ title: "Number released" });
      },
    },
  });

  const outboundCall = useMakeOutboundCall({
    mutation: {
      onSuccess: (data: any) => {
        qc.invalidateQueries({ queryKey: getListCallRecordsQueryKey() });
        setOutboundOpen(false);
        setActiveSid(data.call?.twilioCallSid ?? null);
        setCallActive(true);
        toast({ title: "Call initiated" });
      },
      onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    },
  });

  const markListened = useMarkVoicemailListened({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListVoicemailsQueryKey() }),
    },
  });

  const unheardVoicemails = (voicemailsData?.voicemails ?? []).filter((v) => !v.listenedAt).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Phone className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-tight">CtrlVoice</h1>
            <p className="text-sm text-muted-foreground">Telephony — phone numbers, calls, voicemails & transcription</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-none uppercase text-xs font-bold tracking-wider gap-2" onClick={() => setOutboundOpen(true)}>
            <PhoneOutgoing className="h-4 w-4" /> Dial
          </Button>
          <Button className="rounded-none uppercase text-xs font-bold tracking-wider gap-2" onClick={() => setProvisionOpen(true)}>
            <Plus className="h-4 w-4" /> Add Number
          </Button>
        </div>
      </div>

      {/* Active call bar */}
      {callActive && (
        <Card className="rounded-none border-green-500 bg-green-50">
          <CardContent className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="font-semibold text-sm text-green-800">Call active {activeSid && <span className="text-xs font-mono opacity-70">({activeSid.slice(-8)})</span>}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="rounded-none gap-1 text-xs" onClick={() => setMuted((m) => !m)}>
                {muted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                {muted ? "Unmute" : "Mute"}
              </Button>
              <Button size="sm" className="rounded-none gap-1 text-xs bg-red-600 hover:bg-red-700 text-white" onClick={() => { setCallActive(false); setActiveSid(null); }}>
                <PhoneOff className="h-3 w-3" /> End
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="rounded-none">
          <TabsTrigger value="numbers" className="rounded-none uppercase text-xs font-bold tracking-wider">Numbers</TabsTrigger>
          <TabsTrigger value="calls" className="rounded-none uppercase text-xs font-bold tracking-wider">Call Log</TabsTrigger>
          <TabsTrigger value="voicemails" className="rounded-none uppercase text-xs font-bold tracking-wider">
            Voicemails {unheardVoicemails > 0 && <Badge className="ml-1 rounded-none text-[10px] px-1 h-4">{unheardVoicemails}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Phone Numbers */}
        <TabsContent value="numbers" className="mt-4">
          {numbersLoading ? (
            <div className="space-y-3">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : !numbersData?.numbers?.length ? (
            <Card className="rounded-none border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Phone className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No phone numbers yet</p>
                <p className="text-sm mt-1">Add a number to start receiving calls and voicemails.</p>
                <Button onClick={() => setProvisionOpen(true)} variant="outline" className="mt-4 rounded-none uppercase text-xs font-bold tracking-wider gap-2">
                  <Plus className="h-4 w-4" /> Add Number
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {numbersData.numbers.map((n) => (
                <Card key={n.id} className="rounded-none">
                  <CardContent className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-semibold font-mono">{n.phoneNumber}</p>
                        <p className="text-xs text-muted-foreground">{n.friendlyName ?? "—"} {n.twilioSid && <span className="font-mono opacity-60">{n.twilioSid.slice(-8)}</span>}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {n.active && <Badge variant="outline" className="rounded-none text-xs text-green-600 border-green-300">Active</Badge>}
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => release.mutate({ id: n.id })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Call Log */}
        <TabsContent value="calls" className="mt-4">
          {callsLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !callsData?.calls?.length ? (
            <Card className="rounded-none">
              <CardContent className="py-12 text-center text-muted-foreground">
                <PhoneCall className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No calls yet.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-none">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Direction</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {callsData.calls.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell>
                        {call.direction === "inbound"
                          ? <PhoneIncoming className="h-4 w-4 text-blue-500" />
                          : <PhoneOutgoing className="h-4 w-4 text-green-500" />}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{call.fromNumber ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{call.toNumber ?? "—"}</TableCell>
                      <TableCell>{callStatusBadge(call.status)}</TableCell>
                      <TableCell className="text-xs">{formatDuration(call.durationSeconds)}</TableCell>
                      <TableCell className="text-xs max-w-48 truncate text-muted-foreground">{call.aiSummary ?? call.transcription ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(call.createdAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* Voicemails */}
        <TabsContent value="voicemails" className="mt-4 space-y-3">
          {!voicemailsData?.voicemails?.length ? (
            <Card className="rounded-none">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Voicemail className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No voicemails yet.</p>
              </CardContent>
            </Card>
          ) : (
            voicemailsData.voicemails.map((vm) => (
              <Card key={vm.id} className={`rounded-none ${!vm.listenedAt ? "border-primary/40" : ""}`}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Voicemail className={`h-5 w-5 mt-0.5 ${!vm.listenedAt ? "text-primary" : "text-muted-foreground"}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm font-mono">{vm.fromNumber ?? "Unknown"}</span>
                          {!vm.listenedAt && <Badge className="rounded-none text-[10px] h-4 px-1">New</Badge>}
                          <span className="text-xs text-muted-foreground">{formatDuration(vm.durationSeconds)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{new Date(vm.createdAt).toLocaleString()}</p>
                        {vm.transcription && (
                          <p className="text-sm mt-2 text-foreground bg-muted/50 p-2 border-l-2 border-primary">{vm.transcription}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {vm.recordingUrl && (
                        <Button size="sm" variant="outline" className="rounded-none gap-1 text-xs" asChild>
                          <a href={vm.recordingUrl} target="_blank" rel="noreferrer">
                            <Play className="h-3 w-3" /> Play
                          </a>
                        </Button>
                      )}
                      {!vm.listenedAt && (
                        <Button size="sm" variant="ghost" className="rounded-none text-xs" onClick={() => markListened.mutate({ id: vm.id })}>
                          Mark heard
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Provision dialog */}
      <Dialog open={provisionOpen} onOpenChange={setProvisionOpen}>
        <DialogContent className="max-w-lg rounded-none">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-tight">Add Phone Number</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-wider">Enter number manually</Label>
              <Input className="rounded-none font-mono" placeholder="+447700900000" value={manualNumber} onChange={(e) => setManualNumber(e.target.value)} />
              <Input className="rounded-none" placeholder="Friendly name (optional)" value={manualFriendly} onChange={(e) => setManualFriendly(e.target.value)} />
              <Button className="w-full rounded-none uppercase text-xs font-bold tracking-wider" onClick={() => provision.mutate({ data: { phoneNumber: manualNumber, friendlyName: manualFriendly || undefined } })} disabled={!manualNumber || provision.isPending}>
                {provision.isPending ? "Provisioning..." : "Add Number"}
              </Button>
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or search available</span></div>
            </div>
            <div className="flex gap-2">
              <Input className="rounded-none flex-1" placeholder="Country code (GB, US...)" value={searchCountry} onChange={(e) => setSearchCountry(e.target.value.toUpperCase())} maxLength={2} />
            </div>
            {availableLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {(availableData?.numbers ?? []).map((n: any) => (
                  <div key={n.phoneNumber} className="flex items-center justify-between border border-border p-2">
                    <div>
                      <p className="font-mono text-sm">{n.phoneNumber}</p>
                      <p className="text-xs text-muted-foreground">{n.friendlyName} {n.region && `· ${n.region}`}</p>
                    </div>
                    <Button size="sm" className="rounded-none text-xs" onClick={() => provision.mutate({ data: { phoneNumber: n.phoneNumber, friendlyName: n.friendlyName } })} disabled={provision.isPending}>
                      Select
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setProvisionOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Outbound call dialog */}
      <Dialog open={outboundOpen} onOpenChange={setOutboundOpen}>
        <DialogContent className="max-w-sm rounded-none">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-tight">Make a Call</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-wider">Phone number to call</Label>
              <Input className="rounded-none font-mono text-lg" placeholder="+447700900000" value={outboundTo} onChange={(e) => setOutboundTo(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setOutboundOpen(false)}>Cancel</Button>
            <Button className="rounded-none gap-2 uppercase text-xs font-bold tracking-wider" onClick={() => outboundCall.mutate({ data: { to: outboundTo } })} disabled={!outboundTo || outboundCall.isPending}>
              <Phone className="h-4 w-4" /> Call
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
