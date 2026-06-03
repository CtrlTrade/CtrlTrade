import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "ctrltradepos.offlineQueue";

export interface QueuedTransaction {
  clientId: string;
  queuedAt: string;
  payload: OfflineTransactionPayload;
  attempts: number;
  lastError?: string;
}

export interface OfflineTransactionPayload {
  tillSessionId?: string | null;
  locationId?: string | null;
  tradeAccountId?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  tender: string;
  cashTakenPence?: number;
  cardTakenPence?: number;
  tradeCreditPence?: number;
  notes?: string | null;
  items: Array<{
    productId?: string | null;
    variantId?: string | null;
    sku?: string | null;
    description: string;
    quantity: number;
    unitPricePence: number;
    vatRatePct?: number | null;
  }>;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function readQueue(): Promise<QueuedTransaction[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedTransaction[];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedTransaction[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueue(payload: OfflineTransactionPayload): Promise<QueuedTransaction> {
  const item: QueuedTransaction = {
    clientId: uuid(),
    queuedAt: new Date().toISOString(),
    payload,
    attempts: 0,
  };
  const queue = await readQueue();
  queue.push(item);
  await writeQueue(queue);
  return item;
}

export async function getQueue(): Promise<QueuedTransaction[]> {
  return readQueue();
}

export async function removeFromQueue(clientId: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((i) => i.clientId !== clientId));
}

export async function markAttempt(clientId: string, error?: string): Promise<void> {
  const queue = await readQueue();
  const updated = queue.map((i) =>
    i.clientId === clientId ? { ...i, attempts: i.attempts + 1, lastError: error } : i,
  );
  await writeQueue(updated);
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
