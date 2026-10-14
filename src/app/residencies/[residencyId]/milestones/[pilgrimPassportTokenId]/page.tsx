import { MilestoneDashboard } from "@/components/residencies/milestone-dashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Residency milestones — Hubs Network",
};

export default async function MilestoneDashboardPage({
  params,
}: {
  params: Promise<{ residencyId: string; pilgrimPassportTokenId: string }>;
}) {
  const { residencyId, pilgrimPassportTokenId } = await params;
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <MilestoneDashboard
        residencyId={residencyId}
        pilgrimPassportTokenId={pilgrimPassportTokenId}
      />
    </div>
  );
}
