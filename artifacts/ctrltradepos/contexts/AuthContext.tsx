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

type AuthState =
  | { status: "loading"; session: null }
  | { status: "signed-out"; session: null }
  | { status: "signed-in"; session: PosSession };

interface AuthContextValue {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<void>;
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

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await posLogin({ email, password });
    await persistToken(session.token);
    setState({ status: "signed-in", session });
  }, []);

  const signOut = useCallback(async () => {
    await persistToken(null);
    setState({ status: "signed-out", session: null });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ state, signIn, signOut, getToken: () => memToken }),
    [state, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
