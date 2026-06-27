import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, BadgeCheck, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  getPassportOwner,
  getPassportSkills,
  getSkillAttestations,
} from "@/lib/pilgrim-passport-sbt";
import { getSkillLabelByHash } from "@/lib/pilgrim-skills";
import { NEXT_PUBLIC_PILGRIM_PASSPORT_SBT_ADDRESS } from "@/config/pilgrim-passport";
import type { SkillHash } from "@/lib/pilgrim-passport-message";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ tokenId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tokenId } = await params;
  return { title: `Pilgrim Passport #${tokenId}` };
}

function shorten(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default async function PassportPage({ params }: PageProps) {
  const { tokenId: tokenIdStr } = await params;

  let tokenId: bigint;
  try {
    tokenId = BigInt(tokenIdStr);
  } catch {
    notFound();
  }

  const owner = await getPassportOwner(tokenId);
  if (!owner) notFound();

  const skills = await getPassportSkills(tokenId);
  const attestationsBySkill = await Promise.all(
    skills.map(async (skill) => ({
      skill,
      attestations: await getSkillAttestations(tokenId, skill as SkillHash),
    }))
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Link
        href="/hubs"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to directory
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <BadgeCheck className="w-6 h-6 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">
            Pilgrim Passport #{tokenIdStr}
          </h1>
        </div>
        <p className="text-sm text-muted break-all">
          Holder: <span className="text-foreground">{owner}</span>
        </p>
        <p className="text-xs text-muted break-all mt-1">
          Contract:{" "}
          <a
            href={`https://sepolia.etherscan.io/token/${NEXT_PUBLIC_PILGRIM_PASSPORT_SBT_ADDRESS}?a=${tokenIdStr}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            {NEXT_PUBLIC_PILGRIM_PASSPORT_SBT_ADDRESS}
            <ExternalLink className="w-3 h-3" />
          </a>
        </p>
      </div>

      <h2 className="text-lg font-semibold text-foreground mb-4">
        Attested Skills ({skills.length})
      </h2>

      {skills.length === 0 ? (
        <p className="text-sm text-muted">No skills attested yet.</p>
      ) : (
        <div className="space-y-4">
          {attestationsBySkill.map(({ skill, attestations }) => {
            const active = attestations.filter((a) => !a.revoked);
            return (
              <Card key={skill} padding="md">
                <h3 className="font-medium text-foreground mb-2">
                  {getSkillLabelByHash(skill)}
                </h3>
                {active.length === 0 ? (
                  <p className="text-xs text-muted">No active attestations.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {attestations.map((att, i) => (
                      <li
                        key={i}
                        className="text-xs text-muted flex flex-wrap items-center gap-x-3 gap-y-1"
                      >
                        <span>
                          Hub:{" "}
                          <span className="text-foreground">{shorten(att.hubSafe)}</span>
                        </span>
                        <span>
                          Signer:{" "}
                          <span className="text-foreground">{shorten(att.signer)}</span>
                        </span>
                        <span>
                          {new Date(att.timestamp * 1000).toLocaleDateString()}
                        </span>
                        {att.revoked && (
                          <span className="text-danger font-medium">revoked</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
