import { listResidencyViews } from "@/lib/residencies-directory";
import { ResidencyCard } from "@/components/residencies/residency-card";
import { ResidenciesPublishCTA } from "@/components/residencies/residencies-publish-cta";
import { CollapsibleSection } from "@/components/residencies/collapsible-section";
import { ScrollText } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Residencies — Hubs Network",
  description: "Open residencies across the Hubs Network.",
};

export default async function ResidenciesPage() {
  const residencies = await listResidencyViews();
  // Closed residencies move to a collapsed section so they don't crowd the
  // open ones. Open + "applications closed" (still ongoing) stay in the main list.
  const openResidencies = residencies.filter((r) => r.uiStatus !== "closed");
  const closedResidencies = residencies.filter((r) => r.uiStatus === "closed");

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="flex items-center gap-3 mb-2">
        <ScrollText className="w-7 h-7 text-primary" />
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          Residencies
        </h1>
      </div>
      <p className="text-sm text-muted mb-8 max-w-2xl">
        Residencies posted by verified Hubs Network hubs. Open a card to see the
        details and apply. You need a Pilgrim Passport to apply.{" "}
        <strong className="text-foreground font-medium">
          You must also hold at least one of the residency&apos;s listed skills
          to apply.
        </strong>
      </p>

      <ResidenciesPublishCTA />

      {residencies.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-xl">
          <p className="text-muted">No residencies posted yet.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {openResidencies.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {openResidencies.map((r) => (
                <ResidencyCard key={r.id} residency={r} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <p className="text-muted">No open residencies right now.</p>
            </div>
          )}

          {closedResidencies.length > 0 && (
            <CollapsibleSection
              title="Closed residencies"
              count={closedResidencies.length}
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {closedResidencies.map((r) => (
                  <ResidencyCard key={r.id} residency={r} />
                ))}
              </div>
            </CollapsibleSection>
          )}
        </div>
      )}
    </div>
  );
}
