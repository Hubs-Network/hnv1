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

function getProvider(): LuksoProvider | null {
  if (typeof window === "undefined") return null;
  if (window.lukso) return window.lukso;
  if (window.ethereum) return window.ethereum as unknown as LuksoProvider;
  return null;
}

export function UPProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasExtension, setHasExtension] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const provider = getProvider();
    setHasExtension(!!provider);

    if (provider) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setAddress(saved);
      }
    }
  }, []);

  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;

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

    provider.on("accountsChanged", handleAccountsChanged);
    return () => {
      provider.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, [hasExtension]);

  const connect = useCallback(async (): Promise<string | null> => {
    const provider = getProvider();

    if (!provider) {
      setError(
        "No wallet extension found. Install the Universal Profile Browser Extension."
      );
      return null;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const accounts = (await provider.request({
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
        err instanceof Error ? err.message : "Failed to connect to wallet";
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
