import { Keypair, TransactionBuilder, type Transaction } from "@stellar/stellar-sdk"
import { isValidSecretKey } from "./analysis"

/**
 * Signs transactions client-side. Secret keys live ONLY in memory inside the
 * Keypair objects held by this set and are never sent anywhere. An optional
 * external signer (e.g. a connected wallet) can append its signature too.
 */
export interface ExternalSigner {
  // returns a fully signed transaction XDR given an input XDR
  sign: (xdr: string, networkPassphrase: string) => Promise<string>
  // public key of the signer, for display
  publicKey: string
}

export interface SignerSet {
  keypairs: Keypair[]
  external?: ExternalSigner
  // all public keys that can contribute signatures
  publicKeys: string[]
}

/** Build a signer set from raw secret keys (validated) and an optional wallet. */
export function createSignerSet(secretKeys: string[], external?: ExternalSigner): SignerSet {
  const keypairs: Keypair[] = []
  for (const raw of secretKeys) {
    const k = raw.trim()
    if (!k) continue
    if (!isValidSecretKey(k)) {
      throw new Error(`Invalid secret key: ${k.slice(0, 6)}…`)
    }
    keypairs.push(Keypair.fromSecret(k))
  }
  const publicKeys = keypairs.map((kp) => kp.publicKey())
  if (external) publicKeys.push(external.publicKey)
  return { keypairs, external, publicKeys }
}

/**
 * Signs a transaction with every local keypair and, if present, the external
 * signer. Returns the signed transaction ready for submission.
 */
export async function signTransaction(
  tx: Transaction,
  signers: SignerSet,
  networkPassphrase: string,
): Promise<Transaction> {
  if (signers.keypairs.length > 0) {
    tx.sign(...signers.keypairs)
  }
  if (signers.external) {
    const signedXdr = await signers.external.sign(tx.toXDR(), networkPassphrase)
    return TransactionBuilder.fromXDR(signedXdr, networkPassphrase) as Transaction
  }
  return tx
}

/**
 * Estimates the total signing weight available from the signer set against an
 * account's signer list, to warn early when a multisig high threshold cannot
 * be met before any irreversible step runs.
 */
export function availableWeight(
  signerPublicKeys: string[],
  accountSigners: { key: string; weight: number }[],
): number {
  return accountSigners
    .filter((s) => signerPublicKeys.includes(s.key))
    .reduce((sum, s) => sum + s.weight, 0)
}
