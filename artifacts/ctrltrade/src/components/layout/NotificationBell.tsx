import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface StaffNotification {
  id: string;
  kind: string;
  title: string;
  message: string;
  linkPath?: string | null;
  createdAt: string;
}

const KIND_ICONS: Record<string, string> = {
  quote_accepted: "✅",
  quote_declined: "❌",
  invoice_paid: "💳",
  customer_message: "💬",
  review_submitted: "⭐",
};

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["staff-notifications-unread"],
    queryFn: async () => {
      const r = await fetch("/api/v1/staff-notifications/unread-count", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load unread count");
      return r.json();
    },
    refetchInterval: 30000,
  });

  const { data: notifications } = useQuery<StaffNotification[]>({
    queryKey: ["staff-notifications"],
    queryFn: async () => {
      const r = await fetch("/api/v1/staff-notifications", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load notifications");
      return r.json();
    },
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/v1/staff-notifications/mark-read", {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to mark read");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-notifications-unread"] });
    },
  });

  useEffect(() => {
    if (!open) return;
    markRead.mutate();
    qc.invalidateQueries({ queryKey: ["staff-notifications"] });
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const unreadCount = unreadData?.count ?? 0;

  function handleNotificationClick(n: StaffNotification) {
    setOpen(false);
    if (n.linkPath) setLocation(n.linkPath);
  }

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="sm"
        className="relative h-9 w-9 p-0"
        onClick={() => setOpen((v) => !v)}
        data-testid="button-notification-bell"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <Badge
            className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] px-1 min-w-[16px] h-4 flex items-center justify-center"
            data-testid="badge-notification-unread"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </Button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-96 max-h-[480px] overflow-y-auto rounded-lg border border-border bg-card shadow-xl z-50"
          data-testid="panel-notifications"
        >
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <Badge className="bg-red-500 text-white text-[10px] px-1.5">
                {unreadCount} new
              </Badge>
            )}
          </div>

          {!notifications || notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${n.linkPath ? "cursor-pointer" : ""}`}
                  onClick={() => handleNotificationClick(n)}
                  data-testid={`notification-item-${n.kind}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg shrink-0 mt-0.5">
                      {KIND_ICONS[n.kind] ?? "🔔"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[11px] text-muted-foreground/70 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
