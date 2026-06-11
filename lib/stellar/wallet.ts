"use client"

import type { ExternalSigner } from "./signing"
import type { NetworkId } from "./types"

/**
 * Lazily creates a Stellar Wallets Kit instance (Freighter, Albedo, xBull,
 * Lobstr, etc.). The kit is browser-only and dynamically imported so it never
 * runs during SSR or bloats the server bundle.
 */
export async function connectWallet(network: NetworkId): Promise<{
  publicKey: string
  signer: ExternalSigner
  walletName: string
}> {
  const mod = await import("@creit.tech/stellar-wallets-kit")
  const { StellarWalletsKit, WalletNetwork, allowAllModules, FREIGHTER_ID } = mod as any

  const kit = new StellarWalletsKit({
    network: network === "public" ? WalletNetwork.PUBLIC : WalletNetwork.TESTNET,
    selectedWalletId: FREIGHTER_ID,
    modules: allowAllModules(),
  })

  // Present the wallet selection modal and resolve once a wallet is chosen.
  const chosen = await new Promise<{ id: string; name: string }>((resolve, reject) => {
    kit
      .openModal({
        onWalletSelected: (option: any) => resolve({ id: option.id, name: option.name }),
        onClosed: () => reject(new Error("Wallet selection cancelled")),
      })
      .catch(reject)
  })

  kit.setWallet(chosen.id)
  const { address } = await kit.getAddress()

  const signer: ExternalSigner = {
    publicKey: address,
    sign: async (xdr: string) => {
      const { signedTxXdr } = await kit.signTransaction(xdr, {
        address,
        networkPassphrase: network === "public" ? WalletNetwork.PUBLIC : WalletNetwork.TESTNET,
      })
      return signedTxXdr
    },
  }

  return { publicKey: address, signer, walletName: chosen.name }
}
