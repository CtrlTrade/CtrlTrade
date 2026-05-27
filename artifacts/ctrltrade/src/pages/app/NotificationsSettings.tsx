import { useMemo } from "react";
import {
  useListNotificationEvents,
  useGetNotificationPreferences,
  useSetNotificationPreference,
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";

export function AppNotificationsSettings() {
  const qc = useQueryClient();
  const { data: catalog, isLoading: cl } = useListNotificationEvents();
  const { data: prefs, isLoading: pl } = useGetNotificationPreferences();
  const setPref = useSetNotificationPreference();

  const prefMap = useMemo(() => {
    const m = new Map<string, { enabled: boolean; frequency: string }>();
    (prefs?.preferences ?? []).forEach((p) =>
      m.set(`${p.eventKind}:${p.channel}`, { enabled: p.enabled, frequency: (p as any).frequency ?? "immediate" }),
    );
    return m;
  }, [prefs]);

  if (cl || pl) {
    return <Skeleton className="h-96 w-full" />;
  }

  const channels = catalog?.channels ?? [];
  const events = catalog?.events ?? [];

  const isEnabled = (eventKind: string, channel: string, defaults: string[] | undefined) => {
    const k = `${eventKind}:${channel}`;
    if (prefMap.has(k)) return prefMap.get(k)!.enabled;
    return (defaults ?? []).includes(channel);
  };
  const freqFor = (eventKind: string, channel: string) =>
    prefMap.get(`${eventKind}:${channel}`)?.frequency ?? "immediate";

  return (
    <div className="space-y-6">
      <Card className="rounded-none border-border">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight">Notification Preferences</CardTitle>
          <CardDescription>
            Choose which channels deliver each event to you. Customer-facing transactional messages always send
            (using each customer&apos;s contact details).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2 uppercase tracking-wider text-xs font-bold">Event</th>
                  {channels.map((c) => (
                    <th key={c} className="text-center p-2 uppercase tracking-wider text-xs font-bold w-24">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.kind} className="border-b border-border" data-testid={`notif-row-${e.kind}`}>
                    <td className="p-2">
                      <div className="font-bold text-sm">{e.kind}</div>
                      <div className="text-xs text-muted-foreground">{e.description}</div>
                    </td>
                    {channels.map((c) => {
                      const enabled = isEnabled(e.kind, c, e.defaultChannels);
                      const freq = freqFor(e.kind, c);
                      return (
                        <td key={c} className="p-2 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Switch
                              checked={enabled}
                              onCheckedChange={(checked) =>
                                setPref.mutate(
                                  { data: { eventKind: e.kind, channel: c, enabled: checked, frequency: freq as any } },
                                  { onSuccess: () => qc.invalidateQueries() },
                                )
                              }
                              data-testid={`pref-${e.kind}-${c}`}
                            />
                            <select
                              className="text-[10px] uppercase border border-border rounded-none px-1 py-0.5 bg-transparent"
                              disabled={!enabled}
                              value={freq}
                              onChange={(ev) =>
                                setPref.mutate(
                                  { data: { eventKind: e.kind, channel: c, enabled, frequency: ev.target.value as any } },
                                  { onSuccess: () => qc.invalidateQueries() },
                                )
                              }
                              data-testid={`freq-${e.kind}-${c}`}
                            >
                              <option value="immediate">Instant</option>
                              <option value="digest_daily">Daily</option>
                              <option value="digest_weekly">Weekly</option>
                            </select>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
