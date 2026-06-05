"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Zap, CheckCircle, AlertCircle, Bug } from "lucide-react";
import { getMagic } from "@/lib/magic";

export default function SponsoredTxTestPage() {
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"login" | "ready" | "sent">("login");
  const [debugLog, setDebugLog] = useState<string[]>([]);

  function log(msg: string) {
    setDebugLog((prev) => [...prev, `[${new Date().toISOString().slice(11, 19)}] ${msg}`]);
  }

  // Env check on mount
  const [envStatus, setEnvStatus] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setEnvStatus({
      MAGIC_KEY: !!process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY,
      ALCHEMY_KEY: !!process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
      GAS_POLICY: !!process.env.NEXT_PUBLIC_ALCHEMY_GAS_POLICY_ID,
      SEPOLIA_RPC: !!process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL,
      CHAIN_ID: !!process.env.NEXT_PUBLIC_CHAIN_ID,
    });
  }, []);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    log("Starting email OTP login...");
    try {
      const magic = getMagic();
      log(`Magic instance created. Has smartAccount: ${!!(magic as any).smartAccount}`);

      await (magic as any).auth.loginWithEmailOTP({ email });
      log("OTP verified. Getting user info...");

      const metadata = await (magic as any).user.getInfo();
      log(`User metadata: ${JSON.stringify(metadata, null, 2)}`);

      const addr = metadata?.publicAddress || metadata?.wallets?.ethereum?.publicAddress;
      if (addr) {
        setAddress(addr);
        setStep("ready");
        log(`Address: ${addr}`);
      } else {
        setError("Login succeeded but no address returned");
        log("ERROR: No address in metadata");
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      setError(msg);
      log(`LOGIN ERROR: ${msg}`);
      log(`Full error: ${JSON.stringify(err, Object.getOwnPropertyNames(err), 2)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendTx() {
    if (!address) return;
    setLoading(true);
    setError(null);
    setTxHash(null);
    log("--- SEND SPONSORED TX ---");

    try {
      const magic = getMagic();

      // Diagnostic checks
      const hasSmartAccount = !!(magic as any).smartAccount;
      log(`magic.smartAccount exists: ${hasSmartAccount}`);

      if (!hasSmartAccount) {
        throw new Error("magic.smartAccount is undefined — SmartAccountExtension not loaded");
      }

      const hasSendTx = typeof (magic as any).smartAccount.sendTransaction === "function";
      log(`magic.smartAccount.sendTransaction is function: ${hasSendTx}`);

      // Build payload
      const payload = {
        chainId: 11155111,
        calls: [
          {
            to: "0x000000000000000000000000000000000000dEaD",
            value: "0",
            data: "0x",
          },
        ],
      };
      log(`Payload: ${JSON.stringify(payload)}`);

      // Send
      log("Calling magic.smartAccount.sendTransaction(payload)...");
      const result = await (magic as any).smartAccount.sendTransaction(payload);
      log(`Result: ${JSON.stringify(result)}`);

      const hash = result?.transactionHash || result;
      setTxHash(typeof hash === "string" ? hash : JSON.stringify(hash));
      setStep("sent");
      log(`TX HASH: ${hash}`);
    } catch (err: any) {
      const msg = err?.message || String(err);
      setError(msg);
      log(`TX ERROR: ${msg}`);
      log(`Error code: ${err?.code}`);
      log(`Error data: ${JSON.stringify(err?.data)}`);
      log(`Full error: ${JSON.stringify(err, Object.getOwnPropertyNames(err), 2)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
        <Zap className="w-6 h-6 text-primary" />
        Sponsored Transaction Test
      </h1>
      <p className="text-sm text-muted mb-4">
        Magic Smart Account + Alchemy Gas Manager on Sepolia. No ETH needed.
      </p>

      {/* Env status */}
      <div className="mb-6 p-3 rounded-lg bg-stone-50 border border-stone-200 text-xs space-y-1">
        <p className="font-medium text-stone-700 mb-1">Environment check:</p>
        {Object.entries(envStatus).map(([key, ok]) => (
          <div key={key} className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`} />
            <span className={ok ? "text-stone-600" : "text-red-600 font-medium"}>{key}: {ok ? "set" : "MISSING"}</span>
          </div>
        ))}
        <p className="text-stone-500 mt-1">
          magic-sdk: 33.7.1 | @magic-ext/smart-account: 1.1.1
        </p>
      </div>

      {/* Step 1: Login */}
      {step === "login" && (
        <Card className="p-6 space-y-4">
          <h2 className="text-base font-semibold">1. Login with Email OTP</h2>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
          />
          <Button onClick={handleLogin} disabled={loading || !email.trim()} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Login with Magic"}
          </Button>
        </Card>
      )}

      {/* Step 2: Ready to send */}
      {step === "ready" && (
        <Card className="p-6 space-y-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Logged in
          </h2>
          <div className="bg-stone-50 rounded-lg p-3">
            <p className="text-xs text-muted">Your address</p>
            <p className="text-sm font-mono break-all">{address}</p>
          </div>

          <h2 className="text-base font-semibold mt-4">2. Send Sponsored Transaction</h2>
          <p className="text-xs text-muted">
            Sends a 0-value transaction to burn address on Sepolia.
            Gas is paid by Alchemy Gas Manager. You need 0 ETH.
          </p>
          <Button onClick={handleSendTx} disabled={loading} className="w-full gap-2">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            Send Sponsored Tx
          </Button>
        </Card>
      )}

      {/* Step 3: Success */}
      {step === "sent" && txHash && (
        <Card className="p-6 space-y-4">
          <h2 className="text-base font-semibold flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            Transaction Sent!
          </h2>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs text-muted mb-1">Tx Hash</p>
            <p className="text-xs font-mono break-all">{txHash}</p>
          </div>
          <a
            href={`https://sepolia.etherscan.io/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            View on Etherscan →
          </a>
          <Button onClick={() => setStep("ready")} variant="secondary" className="w-full">
            Send another
          </Button>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 break-all">{error}</p>
        </div>
      )}

      {/* Debug log */}
      {debugLog.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
            <Bug className="w-4 h-4" />
            Debug Log
          </h3>
          <div className="bg-stone-900 text-green-400 rounded-lg p-4 text-xs font-mono max-h-80 overflow-y-auto space-y-0.5">
            {debugLog.map((line, i) => (
              <div key={i} className="break-all">{line}</div>
            ))}
          </div>
          <Button
            onClick={() => setDebugLog([])}
            variant="ghost"
            size="sm"
            className="mt-2 text-xs"
          >
            Clear log
          </Button>
        </div>
      )}
    </div>
  );
}
