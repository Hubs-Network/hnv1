/**
 * Residency vouch schema (off-chain Patron pledge).
 *
 * A vouch is a non-binding declaration of support by a verified Patron for an
 * OPEN residency: an amount + currency + purpose (+ optional link). Stored as
 * one JSON file per (residency, patron) so re-submitting upserts.
 */
import { z } from "zod";
import {
  FIAT_CURRENCIES,
  CRYPTO_CURRENCIES,
  VOUCH_CHAIN_IDS,
} from "@/config/vouch-currencies";

const address = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address");
const applicationId = z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid application id");

/** Discriminated currency union (matches VouchCurrency in the config). */
export const vouchCurrencySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("fiat"),
    code: z.enum(FIAT_CURRENCIES),
  }),
  z.object({
    kind: z.literal("crypto"),
    symbol: z.enum(CRYPTO_CURRENCIES),
  }),
  z.object({
    kind: z.literal("token"),
    address,
    chainId: z
      .number()
      .int()
      .refine((id) => VOUCH_CHAIN_IDS.includes(id), "Unsupported chain"),
    symbol: z.string().trim().max(12).optional(),
  }),
]);

/** Positive decimal amount as a string (avoids float precision issues). */
const amount = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, "Enter a valid amount")
  .refine((v) => Number(v) > 0, "Amount must be greater than 0");

export const VOUCH_STATUS_VALUES = ["active", "withdrawn"] as const;
export type VouchStatus = (typeof VOUCH_STATUS_VALUES)[number];

/** Persisted vouch JSON (data/vouches/<residencyId>/<patronApplicationId>.json). */
export const vouchSchema = z.object({
  vouchId: z.string(),
  residencyId: z.string(),
  patronApplicationId: applicationId,
  patronTokenId: z.string(),
  patronName: z.string(),
  createdBy: address,
  amount,
  currency: vouchCurrencySchema,
  purpose: z.string().trim().min(1, "Describe the purpose").max(250),
  link: z.string().trim().url().max(300).optional().or(z.literal("")),
  status: z.enum(VOUCH_STATUS_VALUES),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  withdrawnAt: z.string().optional(),
});

export type Vouch = z.infer<typeof vouchSchema>;

/** Client → server input for creating / updating a vouch. */
export const createVouchInputSchema = z.object({
  patronApplicationId: applicationId,
  amount,
  currency: vouchCurrencySchema,
  purpose: z.string().trim().min(1, "Describe the purpose").max(250),
  link: z.string().trim().url("Enter a valid URL").max(300).optional().or(z.literal("")),
});

export type CreateVouchInput = z.infer<typeof createVouchInputSchema>;
