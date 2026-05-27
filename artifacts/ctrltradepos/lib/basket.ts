import { useSyncExternalStore } from "react";

export interface BasketItem {
  productId?: string;
  variantId?: string | null;
  sku?: string | null;
  description: string;
  quantity: number;
  unitPricePence: number;
  vatRatePct?: number | null;
}

type BasketState = {
  items: BasketItem[];
  tradeAccountId: string | null;
  tradeAccountName: string | null;
};

let state: BasketState = { items: [], tradeAccountId: null, tradeAccountName: null };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return state;
}

export function useBasket() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    items: snapshot.items,
    tradeAccountId: snapshot.tradeAccountId,
    tradeAccountName: snapshot.tradeAccountName,
    addItem(item: BasketItem) {
      const existing = state.items.findIndex(
        (i) => i.productId && i.productId === item.productId && i.variantId === (item.variantId ?? null),
      );
      if (existing >= 0) {
        const updated = [...state.items];
        updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + item.quantity };
        state = { ...state, items: updated };
      } else {
        state = { ...state, items: [...state.items, item] };
      }
      emit();
    },
    updateQty(idx: number, qty: number) {
      const items = [...state.items];
      if (qty <= 0) items.splice(idx, 1);
      else items[idx] = { ...items[idx], quantity: qty };
      state = { ...state, items };
      emit();
    },
    removeItem(idx: number) {
      const items = [...state.items];
      items.splice(idx, 1);
      state = { ...state, items };
      emit();
    },
    setTradeAccount(id: string | null, name: string | null) {
      state = { ...state, tradeAccountId: id, tradeAccountName: name };
      emit();
    },
    clear() {
      state = { items: [], tradeAccountId: null, tradeAccountName: null };
      emit();
    },
  };
}
