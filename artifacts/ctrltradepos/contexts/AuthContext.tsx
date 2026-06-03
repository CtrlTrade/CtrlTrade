import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { posLogin, getPosSession } from "@workspace/api-client-react";
import type { PosSession } from "@workspace/api-client-react";

const TOKEN_KEY = "ctrltradepos.token";
const LICENCE_KEY = "ctrltradepos.licenceKey";
const TERMINAL_KEY = "ctrltradepos.terminalCode";

export type PosMode = "full" | "read_only" | "locked";

type AuthState =
  | { status: "loading"; session: null }
  | { status: "signed-out"; session: null }
  | { status: "signed-in"; session: PosSession };

interface AuthContextValue {
  state: AuthState;
  mode: PosMode;
  signIn: (licenceKey: string, tillName: string) => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

let memToken: string | null = null;

export function getAuthToken(): string | null {
  return memToken;
}

async function persistToken(token: string | null) {
  memToken = token;
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

function sessionMode(session: PosSession | null): PosMode {
  return (session?.mode as PosMode | undefined) ?? "full";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", session: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(TOKEN_KEY);
        if (!stored) {
          if (!cancelled) setState({ status: "signed-out", session: null });
          return;
        }
        memToken = stored;
        // The POS token carries the licence binding; /v1/pos/me re-validates it
        // and returns the current mode (full / read_only / locked).
        const session = await getPosSession();
        memToken = session.token;
        await AsyncStorage.setItem(TOKEN_KEY, session.token);
        if (!cancelled) setState({ status: "signed-in", session });
      } catch {
        memToken = null;
        await AsyncStorage.removeItem(TOKEN_KEY);
        if (!cancelled) setState({ status: "signed-out", session: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(
    async (licenceKey: string, tillName: string) => {
      // A CtrlTradePos® till activates with just a licence key + till name — the
      // licence key determines the business, so no personal email/password is
      // needed. Fall back to the previously remembered values so a returning
      // till can restore its session.
      const key = licenceKey?.trim() || (await AsyncStorage.getItem(LICENCE_KEY)) || undefined;
      const terminal = tillName?.trim() || (await AsyncStorage.getItem(TERMINAL_KEY)) || undefined;
      const session = await posLogin({
        licenceKey: key ?? null,
        // The "till name" may be the terminal's friendly name or its code; the
        // server resolves it to the canonical terminal binding.
        terminalCode: terminal ?? null,
        // The Expo app is a native installed till, so it activates against the
        // Desktop POS surface of the licence (web-only licences are rejected).
        surface: "desktop",
      });
      await persistToken(session.token);
      if (key) await AsyncStorage.setItem(LICENCE_KEY, key);
      if (terminal) await AsyncStorage.setItem(TERMINAL_KEY, terminal);
      setState({ status: "signed-in", session });
    },
    [],
  );

  const signOut = useCallback(async () => {
    await persistToken(null);
    setState({ status: "signed-out", session: null });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      mode: state.status === "signed-in" ? sessionMode(state.session) : "full",
      signIn,
      signOut,
      getToken: () => memToken,
    }),
    [state, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
