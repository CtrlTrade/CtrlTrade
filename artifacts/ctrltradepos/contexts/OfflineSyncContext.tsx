import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  createPosTransaction,
  getGetCurrentTillSessionQueryKey,
} from "@workspace/api-client-react";
import {
  getQueue,
  removeFromQueue,
  markAttempt,
  type QueuedTransaction,
} from "@/lib/offlineQueue";
import { getAuthToken } from "@/contexts/AuthContext";

const SYNC_INTERVAL_MS = 30_000;
const MAX_ATTEMPTS = 10;

export interface SyncedSaleInfo {
  id: string;
  customerName: string | null;
  totalPence: number;
}

interface OfflineSyncContextValue {
  pendingCount: number;
  pendingItems: import("@/lib/offlineQueue").QueuedTransaction[];
  isSyncing: boolean;
  triggerSync: () => void;
  lastSyncedAt: string | null;
  lastSyncedSales: SyncedSaleInfo[];
  dismissSyncedSales: () => void;
}

const OfflineSyncContext = createContext<OfflineSyncContextValue>({
  pendingCount: 0,
  pendingItems: [],
  isSyncing: false,
  triggerSync: () => {},
  lastSyncedAt: null,
  lastSyncedSales: [],
  dismissSyncedSales: () => {},
});

function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err as Error).message ?? "";
  return (
    msg.includes("Network request failed") ||
    msg.includes("Failed to fetch") ||
    msg.toLowerCase().includes("network") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("ETIMEDOUT")
  );
}

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const [pendingItems, setPendingItems] = useState<QueuedTransaction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lastSyncedSales, setLastSyncedSales] = useState<SyncedSaleInfo[]>([]);
  const syncInProgress = useRef(false);
  const qc = useQueryClient();

  const refreshCount = useCallback(async () => {
    const q = await getQueue();
    setPendingItems(q);
  }, []);

  const dismissSyncedSales = useCallback(() => {
    setLastSyncedSales([]);
  }, []);

  const triggerSync = useCallback(async () => {
    if (syncInProgress.current) return;
    const token = getAuthToken();
    if (!token) return;

    const queue = await getQueue();
    if (queue.length === 0) return;

    syncInProgress.current = true;
    setIsSyncing(true);

    const newlySynced: SyncedSaleInfo[] = [];

    for (const item of queue) {
      if (item.attempts >= MAX_ATTEMPTS) continue;
      try {
        const result = await createPosTransaction({
          ...item.payload,
          idempotencyKey: item.clientId,
          items: item.payload.items.map((i) => ({
            ...i,
            vatRatePct: i.vatRatePct ?? undefined,
          })),
        });
        await removeFromQueue(item.clientId);
        newlySynced.push({
          id: result.id,
          customerName: result.customerName ?? null,
          totalPence: result.totalPence,
        });
      } catch (err) {
        if (isNetworkError(err)) {
          break;
        }
        await markAttempt(item.clientId, (err as Error)?.message);
      }
    }

    if (newlySynced.length > 0) {
      setLastSyncedAt(new Date().toISOString());
      void qc.invalidateQueries({ queryKey: getGetCurrentTillSessionQueryKey() });
      setLastSyncedSales(newlySynced);
    }

    await refreshCount();
    setIsSyncing(false);
    syncInProgress.current = false;
  }, [refreshCount, qc]);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    triggerSync();
  }, [triggerSync]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        triggerSync();
      }
    });
    return () => sub.remove();
  }, [triggerSync]);

  useEffect(() => {
    const id = setInterval(() => {
      triggerSync();
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(id);
  }, [triggerSync]);

  return (
    <OfflineSyncContext.Provider value={{ pendingCount: pendingItems.length, pendingItems, isSyncing, triggerSync, lastSyncedAt, lastSyncedSales, dismissSyncedSales }}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSync(): OfflineSyncContextValue {
  return useContext(OfflineSyncContext);
}
