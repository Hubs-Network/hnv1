"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { ethers } from "ethers";
import { getMagic } from "@/lib/magic";

export type AuthProvider = "magic" | "injected" | null;

interface AuthContextValue {
  address: string | null;
  ensName: string | null;
  authProvider: AuthProvider;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  loginWithEmail: (email: string) => Promise<void>;
  connectInjected: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  address: null,
  ensName: null,
  authProvider: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  loginWithEmail: async () => {},
  connectInjected: async () => {},
  logout: async () => {},
});

const STORAGE_KEY = "hn_auth_provider";
const STORAGE_ADDR = "hn_auth_address";

export function AuthContextProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [ensName, setEnsName] = useState<string | null>(null);
  const [authProvider, setAuthProvider] = useState<AuthProvider>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolve ENS for injected wallets
  const resolveEns = useCallback(async (addr: string) => {
    try {
      const mainnetProvider = new ethers.JsonRpcProvider(
        "https://cloudflare-eth.com"
      );
      const name = await mainnetProvider.lookupAddress(addr);
      setEnsName(name);
    } catch {
      setEnsName(null);
    }
  }, []);

  // Restore session on mount.
  //
  // This is intentionally NON-destructive: we never clear the saved session on
  // transient errors or because an injected wallet is temporarily locked. We
  // optimistically restore the last address and only verify it in the
  // background. The session is removed only on an explicit logout or when Magic
  // reports the user is genuinely logged out. This prevents the spurious
  // logouts users hit when a wallet auto-locks or an RPC call momentarily fails.
  useEffect(() => {
    async function restoreSession() {
      if (typeof window === "undefined") return;

      const savedProvider = localStorage.getItem(STORAGE_KEY) as AuthProvider;
      const savedAddr = localStorage.getItem(STORAGE_ADDR);

      if (!savedProvider) {
        setIsLoading(false);
        return;
      }

      // Optimistic restore so the user stays logged in across refreshes even if
      // the wallet is locked or the network hiccups.
      if (savedAddr) {
        setAddress(savedAddr);
        setAuthProvider(savedProvider);
        if (savedProvider === "injected") resolveEns(savedAddr);
      }

      try {
        if (savedProvider === "magic") {
          const magic = getMagic();
          const isLoggedIn = await (magic as any).user.isLoggedIn();
          if (isLoggedIn) {
            const info = await (magic as any).user.getInfo();
            const ethAddress =
              info?.publicAddress ||
              info?.wallets?.ethereum?.publicAddress;
            if (ethAddress) {
              setAddress(ethAddress);
              setAuthProvider("magic");
              localStorage.setItem(STORAGE_ADDR, ethAddress);
            }
          } else {
            // Genuine logged-out state reported by Magic → clear session.
            setAddress(null);
            setAuthProvider(null);
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(STORAGE_ADDR);
          }
        } else if (savedProvider === "injected" && window.ethereum) {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const accounts = await provider.listAccounts();
          if (accounts.length > 0) {
            const addr = accounts[0].address;
            setAddress(addr);
            setAuthProvider("injected");
            localStorage.setItem(STORAGE_ADDR, addr);
            resolveEns(addr);
          }
          // No accounts → wallet locked / permission paused. Keep the optimistic
          // session; it re-aligns automatically on unlock (accountsChanged) or
          // the next reload. Do NOT clear it here.
        }
      } catch {
        // Transient error (RPC, Magic network blip): keep the optimistic
        // session rather than logging the user out.
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, [resolveEns]);

  const loginWithEmail = useCallback(async (email: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const magic = getMagic();
      await (magic as any).auth.loginWithEmailOTP({ email });
      const info = await (magic as any).user.getInfo();
      const ethAddress =
        info?.publicAddress ||
        info?.wallets?.ethereum?.publicAddress;

      if (ethAddress) {
        setAddress(ethAddress);
        setAuthProvider("magic");
        setEnsName(null);
        localStorage.setItem(STORAGE_KEY, "magic");
        localStorage.setItem(STORAGE_ADDR, ethAddress);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Magic login failed";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const connectInjected = useCallback(async () => {
    setError(null);

    if (typeof window === "undefined" || !window.ethereum) {
      setError("No wallet extension found. Install MetaMask or Rabby.");
      return;
    }

    setIsLoading(true);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);

      if (accounts && accounts.length > 0) {
        const addr = accounts[0];
        setAddress(addr);
        setAuthProvider("injected");
        localStorage.setItem(STORAGE_KEY, "injected");
        localStorage.setItem(STORAGE_ADDR, addr);
        resolveEns(addr);
      } else {
        setError("No accounts returned from wallet.");
      }
    } catch (err: unknown) {
      let msg = "Failed to connect wallet";
      if (err instanceof Error) {
        msg = err.message;
      } else if (typeof err === "object" && err !== null && "message" in err) {
        msg = String((err as Record<string, unknown>).message);
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [resolveEns]);

  const logout = useCallback(async () => {
    try {
      if (authProvider === "magic") {
        const magic = getMagic();
        await (magic as any).user.logout();
      }
    } catch {}

    setAddress(null);
    setEnsName(null);
    setAuthProvider(null);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_ADDR);
  }, [authProvider]);

  // Listen for account changes on injected wallets
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      if (authProvider !== "injected") return;

      // An empty array means the wallet locked or paused permissions. We do NOT
      // log the user out (that would wipe the session and force a manual
      // reconnect). The session re-aligns automatically once the wallet emits a
      // non-empty account again. Explicit disconnect is available in the menu.
      if (accs.length > 0) {
        const addr = accs[0];
        setAddress(addr);
        localStorage.setItem(STORAGE_ADDR, addr);
        resolveEns(addr);
      }
    };

    window.ethereum.on?.("accountsChanged", handleAccountsChanged);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, [authProvider, logout, resolveEns]);

  return (
    <AuthContext.Provider
      value={{
        address,
        ensName,
        authProvider,
        isAuthenticated: !!address,
        isLoading,
        error,
        loginWithEmail,
        connectInjected,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
