import { getBaseUrl } from "./custom-fetch";

export type PosLiveMode = "full" | "read_only" | "locked";

export interface PosLivePayload {
  mode?: PosLiveMode;
  status?: string;
  message?: string | null;
}

export interface SubscribePosLiveOptions {
  /** The signed POS bearer token to authenticate the stream. */
  token: string;
  /**
   * Called whenever the server pushes a licence-change (or the initial mode
   * snapshot). The payload carries the freshly resolved mode, but callers
   * should still re-fetch the authoritative session via `/v1/pos/me`.
   */
  onChange: (payload: PosLivePayload) => void;
  /** Optional error hook (connection dropped). Polling remains the fallback. */
  onError?: (err: unknown) => void;
}

/**
 * Subscribe to the authenticated POS live licence-status channel (SSE).
 *
 * Returns an unsubscribe function. This is a best-effort UX accelerator layered
 * on top of polling — when EventSource is unavailable (React Native native
 * runtime), it is a no-op and the caller's polling loop covers convergence.
 *
 * The token is passed via query param because EventSource cannot send an
 * Authorization header; the server validates it identically to /v1/pos/me.
 */
export function subscribePosLive(options: SubscribePosLiveOptions): () => void {
  const { token, onChange, onError } = options;

  // No EventSource (React Native native) → rely on polling. Also bail without a
  // token rather than opening an unauthenticated stream.
  if (typeof EventSource === "undefined" || !token) {
    return () => {};
  }

  const base = getBaseUrl() ?? "";
  const url = `${base}/api/v1/pos/live?token=${encodeURIComponent(token)}`;

  let closed = false;
  // `withCredentials` lets same-origin web bundles include the session cookie
  // too; harmless for cross-origin token-only (Expo/Electron) connections.
  const source = new EventSource(url, { withCredentials: true });

  const handle = (event: MessageEvent): void => {
    if (closed) return;
    try {
      const payload = event.data ? (JSON.parse(event.data) as PosLivePayload) : {};
      onChange(payload);
    } catch {
      // Malformed frame — still signal a change so the caller re-fetches.
      onChange({});
    }
  };

  source.addEventListener("mode", handle as EventListener);
  source.addEventListener("licence-change", handle as EventListener);
  source.onmessage = handle;
  source.onerror = (err) => {
    if (closed) return;
    onError?.(err);
    // EventSource auto-reconnects on its own; no manual retry needed here.
  };

  return () => {
    closed = true;
    source.close();
  };
}
