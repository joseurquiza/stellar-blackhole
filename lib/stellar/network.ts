import { Networks } from "@stellar/stellar-sdk"
import type { NetworkConfig, NetworkId, AssetId } from "./types"

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  public: {
    id: "public",
    label: "Public Mainnet",
    horizonUrl: "https://horizon.stellar.org",
    sorobanRpcUrl: "https://soroban-rpc.mainnet.stellar.gateway.fm",
    networkPassphrase: Networks.PUBLIC,
    explorerBase: "https://stellar.expert/explorer/public",
  },
  testnet: {
    id: "testnet",
    label: "Testnet",
    horizonUrl: "https://horizon-testnet.stellar.org",
    sorobanRpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: Networks.TESTNET,
    explorerBase: "https://stellar.expert/explorer/testnet",
  },
}

export function getNetwork(id: NetworkId): NetworkConfig {
  return NETWORKS[id]
}

export const NATIVE_ASSET: AssetId = {
  code: "XLM",
  isNative: true,
  key: "native",
}

export function makeAssetId(code: string, issuer?: string): AssetId {
  if (!issuer || code === "XLM" || code === "native") return NATIVE_ASSET
  return {
    code,
    issuer,
    isNative: false,
    key: `${code}:${issuer}`,
  }
}

export function explorerTxUrl(network: NetworkId, hash: string): string {
  return `${NETWORKS[network].explorerBase}/tx/${hash}`
}

export function explorerAccountUrl(network: NetworkId, account: string): string {
  return `${NETWORKS[network].explorerBase}/account/${account}`
}
