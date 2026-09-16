import { ResidencyDetail } from "@/components/residencies/residency-detail";

export const dynamic = "force-dynamic";

export default async function ResidencyDetailPage({
  params,
}: {
  params: Promise<{ residencyId: string }>;
}) {
  const { residencyId } = await params;
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <ResidencyDetail residencyId={residencyId} />
    </div>
  );
}
