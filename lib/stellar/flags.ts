// Feature flags for the demolisher engine.
//
// The Soroban sweep pipeline (Blend / Phoenix / Soroswap withdrawals, token
// sweeps, allowance revocation) is built ALONGSIDE the stable Stellar-classic
// flow. It is OFF by default so existing users are never affected: when
// `SOROBAN_SWEEP_ENABLED` is false, no Soroban planning, UI, or execution runs
// and the classic path behaves byte-for-byte as before.
//
// Enable it by setting NEXT_PUBLIC_SOROBAN_SWEEP=1 in the environment (or by
// flipping the default below once the adapters are verified on funded testnet
// accounts).
export const SOROBAN_SWEEP_ENABLED: boolean =
  process.env.NEXT_PUBLIC_SOROBAN_SWEEP === "1" || process.env.NEXT_PUBLIC_SOROBAN_SWEEP === "true"

// localStorage key recording that the user has rehearsed the current Soroban
// sweep on testnet / Simulate. Mainnet Soroban writes are gated on this.
export const SOROBAN_REHEARSED_KEY = "blackhole_soroban_rehearsed_v1"
