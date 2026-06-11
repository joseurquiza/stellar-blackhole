import { StrKey } from "@stellar/stellar-sdk"
import type { AccountAudit, PlanBlocker } from "./types"

/** Validate a Stellar public key (G...). */
export function isValidPublicKey(key: string): boolean {
  try {
    return StrKey.isValidEd25519PublicKey(key.trim())
  } catch {
    return false
  }
}

/** Validate a Stellar secret key (S...). */
export function isValidSecretKey(key: string): boolean {
  try {
    return StrKey.isValidEd25519SecretSeed(key.trim())
  } catch {
    return false
  }
}

/** Validate a muxed account (M...) or normal account for a destination. */
export function isValidDestination(key: string): boolean {
  const k = key.trim()
  return isValidPublicKey(k) || (() => {
    try {
      return StrKey.isValidMed25519PublicKey(k)
    } catch {
      return false
    }
  })()
}

/**
 * Computes hard blockers that must be resolved before any demolition can run.
 * The most important is active sponsorship of other accounts' reserves:
 * Stellar will reject an account merge while num_sponsoring > 0.
 */
export function computeBlockers(audit: AccountAudit): PlanBlocker[] {
  const blockers: PlanBlocker[] = []

  if (!audit.exists) {
    blockers.push({
      code: "not-funded",
      title: "Account does not exist",
      detail: "This account is not funded on the selected network, so there is nothing to demolish.",
    })
    return blockers
  }

  if (audit.sponsorship.numSponsoring > 0) {
    blockers.push({
      code: "active-sponsorships",
      title: `Sponsoring ${audit.sponsorship.numSponsoring} reserve(s) for other accounts`,
      detail:
        "Stellar will reject an account merge while this account sponsors reserves for others. " +
        "Revoke every sponsorship you created for other accounts before demolishing.",
    })
  }

  if (audit.liquidityPools.some((p) => p.sponsor && p.sponsor !== audit.publicKey)) {
    blockers.push({
      code: "sponsored-pool",
      title: "Liquidity pool stake sponsored by another account",
      detail: "Coordinate with the sponsor before removing sponsored liquidity pool shares.",
    })
  }

  return blockers
}

/**
 * Non-fatal warnings the user should acknowledge.
 */
export function computeWarnings(audit: AccountAudit): string[] {
  const warnings: string[] = []

  if (audit.isMultisig) {
    warnings.push(
      "This account uses multisig. The demolition transactions will require enough additional signatures to meet the high threshold.",
    )
  }

  if (audit.hasMasterKeyDisabled) {
    warnings.push(
      "The master key weight is 0. You must sign with the configured additional signers, not the account's own secret key.",
    )
  }

  const lockedOffers = audit.openOffers.length
  if (lockedOffers > 0) {
    warnings.push(`${lockedOffers} open offer(s) are locking liabilities and will be cancelled before merge.`)
  }

  if (audit.claimableBalances.some((c) => !c.claimableNow)) {
    warnings.push(
      "Some claimable balances are not claimable yet (time-locked). They will be skipped and their reserves cannot be recovered now.",
    )
  }

  if (audit.sorobanTokens.length > 0) {
    warnings.push(
      `${audit.sorobanTokens.length} Soroban token balance(s) detected. These are shown for review; automatic liquidation of Soroban tokens is not performed in this phase.`,
    )
  }

  if (audit.defiPositions.length > 0) {
    warnings.push(
      `${audit.defiPositions.length} possible DeFi position(s) detected. Close these in their respective protocols before merging.`,
    )
  }

  return warnings
}

/**
 * Whether the account can ultimately be merged once the planned cleanup runs.
 * Cleanup removes trustlines/offers/data/signers, but sponsorships of others
 * are a hard external dependency.
 */
export function canMergeAfterCleanup(audit: AccountAudit): boolean {
  return audit.exists && audit.sponsorship.numSponsoring === 0
}
