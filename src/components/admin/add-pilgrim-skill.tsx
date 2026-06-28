"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Sparkles, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSkillCatalog } from "@/lib/use-skill-catalog";
import { slugifySkillId } from "@/lib/pilgrim-skills";
import { addPilgrimSkill } from "@/lib/pilgrim-skill-admin-client";

const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io/tx/";

interface AddPilgrimSkillProps {
  address: string;
  authProvider: string | null;
}

export function AddPilgrimSkill({ address, authProvider }: AddPilgrimSkillProps) {
  const { categories, loading, reload } = useSkillCatalog();
  const [label, setLabel] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ label: string; txHash: string } | null>(
    null
  );

  const derivedId = useMemo(() => slugifySkillId(label), [label]);

  const existingIds = useMemo(
    () => new Set(categories.flatMap((c) => c.skills.map((s) => s.id))),
    [categories]
  );
  const duplicate = derivedId.length > 0 && existingIds.has(derivedId);

  const canSubmit =
    !submitting && derivedId.length > 0 && !duplicate && categoryId.length > 0;

  async function handleAdd() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await addPilgrimSkill({
        label: label.trim(),
        categoryId,
        signerAddress: address,
        authProvider,
      });
      setSuccess({ label: result.label, txHash: result.txHash });
      setLabel("");
      setCategoryId("");
      await reload();
    } catch (err) {
      setError(extractErrorMessage(err) || "Failed to add skill");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-12">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">
          Add New Skill to Pilgrim Passport SBT
        </h2>
      </div>

      <Card className="p-5 space-y-5">
        <p className="text-sm text-muted">
          New skills become readable text in the app and a bytes32 hash on-chain.
          You sign the change; the relayer submits it gas-free
          (<span className="font-mono text-xs">setSkillStatusByHNDirector</span>).
        </p>

        {/* Add form */}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div>
            <label className="block text-xs text-muted mb-1">Skill name</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Glass Blowing"
              disabled={submitting}
              className={cn(
                "w-full px-3 py-2 rounded-lg text-sm bg-surface border border-border",
                "focus:outline-none focus:ring-2 focus:ring-primary"
              )}
            />
            {derivedId && (
              <p className="text-[11px] text-muted mt-1">
                id: <span className="font-mono">{derivedId}</span>
                {duplicate && (
                  <span className="text-danger"> — already exists</span>
                )}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Area</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={submitting}
              className={cn(
                "px-3 py-2 rounded-lg text-sm bg-surface border border-border",
                "focus:outline-none focus:ring-2 focus:ring-primary"
              )}
            >
              <option value="">Select area…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!canSubmit}
            className="gap-1.5"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Add skill
          </Button>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        {success && (
          <p className="flex items-center gap-1.5 text-sm text-green-700">
            <CheckCircle className="w-4 h-4" />
            Added “{success.label}” —
            <a
              href={`${SEPOLIA_EXPLORER}${success.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono hover:underline"
            >
              {success.txHash.slice(0, 12)}…
            </a>
          </p>
        )}

        {/* Existing skills by area */}
        <div className="pt-2 border-t border-border-light">
          <h3 className="text-xs uppercase tracking-wider text-muted mb-3">
            Current skills
          </h3>
          {loading && categories.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="space-y-4">
              {categories.map((cat) => (
                <div key={cat.id}>
                  <h4 className="text-xs text-muted uppercase tracking-wider mb-1.5">
                    {cat.label}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.skills.map((s) => (
                      <span
                        key={s.id}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-medium border",
                          s.custom
                            ? "bg-primary-bg text-primary border-primary/30"
                            : "bg-surface text-foreground border-border"
                        )}
                      >
                        {s.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "";
}
