import { listResidencyViews } from "@/lib/residencies-directory";
import { ResidencyCard } from "@/components/residencies/residency-card";
import { ScrollText } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bulletin Board — Hubs Network",
  description: "Open residencies across the Hubs Network.",
};

export default async function BulletinBoardPage() {
  const residencies = await listResidencyViews();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="flex items-center gap-3 mb-2">
        <ScrollText className="w-7 h-7 text-primary" />
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          Bulletin Board
        </h1>
      </div>
      <p className="text-sm text-muted mb-8 max-w-2xl">
        Residencies posted by verified Hubs Network hubs. Open a card to see the
        details and apply. You need a Pilgrim Passport to apply.
      </p>

      {residencies.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-xl">
          <p className="text-muted">No residencies posted yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {residencies.map((r) => (
            <ResidencyCard key={r.id} residency={r} />
          ))}
        </div>
      )}
    </div>
  );
}
