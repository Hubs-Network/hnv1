import { NextRequest, NextResponse } from "next/server";
import {
  isAddress,
  getAddress,
  recoverTypedDataAddress,
  type Hex,
} from "viem";
import { isHNAdmin } from "@/lib/hn-admin";
import {
  getPatronOwner,
  getHNDirectorNonce,
  submitRevokePatron,
} from "@/lib/patron-sbt";
import { buildRevokePatronTypedData } from "@/lib/patron-sbt-message";
import { getAllPatrons, savePatron } from "@/lib/data/patrons";

export const dynamic = "force-dynamic";

function parseTokenId(raw: string): bigint | null {
  try {
    const id = BigInt(raw);
    return id >= BigInt(0) ? id : null;
  } catch {
    return null;
  }
}

/**
 * GET /api/patrons/[tokenId]/revoke?signer=0x...
 * Returns the current on-chain owner and the Director's revoke nonce so the
 * client can build the exact RevokePatron typed data to sign.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  try {
    const { tokenId: tokenIdRaw } = await params;
    const signer = new URL(request.url).searchParams.get("signer") || "";
    const tokenId = parseTokenId(tokenIdRaw);
    if (tokenId === null) {
      return NextResponse.json({ error: "Invalid token id" }, { status: 400 });
    }
    if (!isAddress(signer)) {
      return NextResponse.json({ error: "Invalid signer" }, { status: 400 });
    }
    const [owner, nonce] = await Promise.all([
      getPatronOwner(tokenId),
      getHNDirectorNonce(signer),
    ]);
    if (!owner) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }
    return NextResponse.json({
      patronOwner: owner,
      nonce: nonce.toString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/patrons/[tokenId]/revoke
 * Body: { signer, nonce, signatureDeadline, directorSignature }
 *
 * patronOwner is read FROM CHAIN. The Director's EIP-712 signature is verified
 * and the signer must be a current HN Directors Safe owner. The relayer submits.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  try {
    const { tokenId: tokenIdRaw } = await params;
    const body = await request.json();
    const signer: string = body.signer || "";
    const nonceStr: string = String(body.nonce ?? "");
    const signatureDeadline: string = String(body.signatureDeadline ?? "");
    const directorSignature: string = body.directorSignature || "";

    const tokenId = parseTokenId(tokenIdRaw);
    if (tokenId === null) {
      return NextResponse.json({ error: "Invalid token id" }, { status: 400 });
    }
    if (!isAddress(signer) || !directorSignature) {
      return NextResponse.json(
        { error: "Signed revocation required (signer, directorSignature)" },
        { status: 400 }
      );
    }
    const deadline = BigInt(signatureDeadline || "0");
    if (deadline <= BigInt(Math.floor(Date.now() / 1000))) {
      return NextResponse.json({ error: "Signature deadline expired" }, { status: 400 });
    }

    const patronOwner = await getPatronOwner(tokenId);
    if (!patronOwner) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    const nonce = BigInt(nonceStr || "0");
    const td = buildRevokePatronTypedData({
      tokenId,
      patronOwner,
      signer,
      nonce,
      signatureDeadline: deadline,
    });
    const recovered = await recoverTypedDataAddress({
      domain: td.domain,
      types: td.types,
      primaryType: "RevokePatron",
      message: td.message,
      signature: directorSignature as Hex,
    });
    if (getAddress(recovered) !== getAddress(signer)) {
      return NextResponse.json({ error: "Signature does not match signer" }, { status: 401 });
    }

    if (!(await isHNAdmin(signer))) {
      return NextResponse.json(
        { error: "Signer is not an HN Directors Safe owner" },
        { status: 403 }
      );
    }

    const { txHash } = await submitRevokePatron(
      { tokenId, signer, nonce, signatureDeadline: deadline },
      directorSignature as Hex
    );

    // Update the JSON keyed by whichever application minted this tokenId.
    const now = new Date().toISOString();
    const all = await getAllPatrons();
    const profile = all.find((p) => p.tokenId === tokenId.toString());
    if (profile) {
      try {
        await savePatron({
          ...profile,
          status: "revoked",
          revokedAt: now,
          revokedBy: getAddress(signer),
          revocationTxHash: txHash,
          updatedAt: now,
        });
      } catch (persistErr) {
        const m = persistErr instanceof Error ? persistErr.message : "persist failed";
        return NextResponse.json(
          {
            error: `Patron revoked on-chain (tx ${txHash}) but failed to persist status: ${m}`,
            txHash,
            persisted: false,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, txHash });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("patron revoke error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
