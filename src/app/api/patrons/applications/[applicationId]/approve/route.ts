import { NextRequest, NextResponse } from "next/server";
import {
  isAddress,
  getAddress,
  recoverTypedDataAddress,
  type Hex,
} from "viem";
import { isHNAdmin } from "@/lib/hn-admin";
import {
  getOnChainApplication,
  getApplicationSkills,
  submitApproveApplicationAndMint,
  PATRON_STATUS,
} from "@/lib/patron-sbt";
import { buildApprovePatronTypedData } from "@/lib/patron-sbt-message";
import { getPatronById, savePatron } from "@/lib/data/patrons";

export const dynamic = "force-dynamic";

/**
 * POST /api/patrons/applications/[applicationId]/approve
 * Body: { signer, signatureDeadline, directorSignature }
 *
 * The applicant + skillsHash are reconstructed FROM CHAIN (never trusted from
 * the client). The Director's EIP-712 signature is verified and the signer must
 * be a current HN Directors Safe owner. The relayer then mints.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const { applicationId } = await params;
    const body = await request.json();
    const signer: string = body.signer || "";
    const signatureDeadline: string = String(body.signatureDeadline ?? "");
    const directorSignature: string = body.directorSignature || "";

    if (!/^0x[a-fA-F0-9]{64}$/.test(applicationId)) {
      return NextResponse.json({ error: "Invalid application id" }, { status: 400 });
    }
    if (!isAddress(signer) || !directorSignature) {
      return NextResponse.json(
        { error: "Signed approval required (signer, directorSignature)" },
        { status: 400 }
      );
    }
    const deadline = BigInt(signatureDeadline || "0");
    if (deadline <= BigInt(Math.floor(Date.now() / 1000))) {
      return NextResponse.json({ error: "Signature deadline expired" }, { status: 400 });
    }

    // 1. Application must be Pending on-chain.
    const onChain = await getOnChainApplication(applicationId as Hex);
    if (!onChain) {
      return NextResponse.json({ error: "Application not found on-chain" }, { status: 404 });
    }
    if (onChain.status !== PATRON_STATUS.Pending) {
      return NextResponse.json(
        { error: "Application is not pending" },
        { status: 409 }
      );
    }

    // 2. Reconstruct applicant + skills FROM CHAIN.
    const skills = await getApplicationSkills(applicationId as Hex);

    // 3. Verify the Director signature over the reconstructed typed data.
    const td = buildApprovePatronTypedData({
      applicationId: applicationId as Hex,
      applicant: onChain.applicant,
      skills,
      signer,
      signatureDeadline: deadline,
    });
    const recovered = await recoverTypedDataAddress({
      domain: td.domain,
      types: td.types,
      primaryType: "ApprovePatronApplication",
      message: td.message,
      signature: directorSignature as Hex,
    });
    if (getAddress(recovered) !== getAddress(signer)) {
      return NextResponse.json({ error: "Signature does not match signer" }, { status: 401 });
    }

    // 4. Signer must be a current HN Directors Safe owner.
    if (!(await isHNAdmin(signer))) {
      return NextResponse.json(
        { error: "Signer is not an HN Directors Safe owner" },
        { status: 403 }
      );
    }

    // 5. Relayer mints.
    const { txHash, tokenId } = await submitApproveApplicationAndMint(
      { applicationId: applicationId as Hex, signer, signatureDeadline: deadline },
      directorSignature as Hex
    );

    // 6. Update JSON (status approved). Skills are NOT stored.
    const now = new Date().toISOString();
    const existing = await getPatronById(applicationId);
    if (existing) {
      try {
        await savePatron({
          ...existing,
          status: "approved",
          ...(tokenId ? { tokenId } : {}),
          approvedAt: now,
          approvedBy: getAddress(signer),
          approvalTxHash: txHash,
          updatedAt: now,
        });
      } catch (persistErr) {
        const m = persistErr instanceof Error ? persistErr.message : "persist failed";
        return NextResponse.json(
          {
            error: `Patron minted (tx ${txHash}) but failed to persist status: ${m}`,
            txHash,
            tokenId,
            persisted: false,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, txHash, tokenId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("patron approve error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
