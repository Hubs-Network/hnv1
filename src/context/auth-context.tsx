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

  // Restore session on mount
  useEffect(() => {
    async function restoreSession() {
      if (typeof window === "undefined") return;

      const savedProvider = localStorage.getItem(STORAGE_KEY) as AuthProvider;

      try {
        if (savedProvider === "magic") {
          const magic = getMagic();
          const isLoggedIn = await magic.user.isLoggedIn();
          if (isLoggedIn) {
            const info = await magic.user.getInfo();
            const ethAddress = info.wallets?.ethereum?.publicAddress;
            if (ethAddress) {
              setAddress(ethAddress);
              setAuthProvider("magic");
            }
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        } else if (savedProvider === "injected") {
          if (window.ethereum) {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const accounts = await provider.listAccounts();
            if (accounts.length > 0) {
              const addr = accounts[0].address;
              setAddress(addr);
              setAuthProvider("injected");
              resolveEns(addr);
            } else {
              localStorage.removeItem(STORAGE_KEY);
            }
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
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
      await magic.auth.loginWithEmailOTP({ email });
      const info = await magic.user.getInfo();
      const ethAddress = info.wallets?.ethereum?.publicAddress;

      if (ethAddress) {
        setAddress(ethAddress);
        setAuthProvider("magic");
        setEnsName(null);
        localStorage.setItem(STORAGE_KEY, "magic");
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
        await magic.user.logout();
      }
    } catch {}

    setAddress(null);
    setEnsName(null);
    setAuthProvider(null);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  }, [authProvider]);

  // Listen for account changes on injected wallets
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      if (authProvider !== "injected") return;

      if (accs.length === 0) {
        logout();
      } else {
        const addr = accs[0];
        setAddress(addr);
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
