"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

interface UPContextValue {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  hasExtension: boolean;
  connect: () => Promise<string | null>;
  disconnect: () => void;
  error: string | null;
}

const UPContext = createContext<UPContextValue>({
  address: null,
  isConnected: false,
  isConnecting: false,
  hasExtension: false,
  connect: async () => null,
  disconnect: () => {},
  error: null,
});

const STORAGE_KEY = "hn_up_address";

export function UPProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasExtension, setHasExtension] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ext = typeof window !== "undefined" && !!window.lukso;
    setHasExtension(ext);

    if (ext) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setAddress(saved);
      }
    }
  }, []);

  useEffect(() => {
    if (!hasExtension || !window.lukso) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      if (accs.length === 0) {
        setAddress(null);
        localStorage.removeItem(STORAGE_KEY);
      } else {
        const addr = accs[0];
        setAddress(addr);
        localStorage.setItem(STORAGE_KEY, addr);
      }
    };

    window.lukso.on("accountsChanged", handleAccountsChanged);
    return () => {
      window.lukso?.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, [hasExtension]);

  const connect = useCallback(async (): Promise<string | null> => {
    if (!window.lukso) {
      setError(
        "Universal Profile Browser Extension not found. Please install it from universalprofile.cloud"
      );
      return null;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const accounts = (await window.lukso.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (accounts.length > 0) {
        const addr = accounts[0];
        setAddress(addr);
        localStorage.setItem(STORAGE_KEY, addr);
        return addr;
      }

      setError("No accounts returned from the extension.");
      return null;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to connect to Universal Profile";
      setError(msg);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    localStorage.removeItem(STORAGE_KEY);
    setError(null);
  }, []);

  return (
    <UPContext.Provider
      value={{
        address,
        isConnected: !!address,
        isConnecting,
        hasExtension,
        connect,
        disconnect,
        error,
      }}
    >
      {children}
    </UPContext.Provider>
  );
}

export function useUP() {
  return useContext(UPContext);
}
