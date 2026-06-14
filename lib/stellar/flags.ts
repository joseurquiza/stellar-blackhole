// Feature flags for the demolisher engine.
//
// The Soroban sweep pipeline (Blend / Phoenix / Soroswap withdrawals, token
// sweeps, allowance revocation) is built ALONGSIDE the stable Stellar-classic
// flow. It is now ON by default but clearly surfaced as BETA throughout the UI:
// adapters stay detection-only ("Manual close") until verified on funded
// testnet positions, and mainnet sweeps remain gated behind a required
// Simulate/testnet rehearsal.
//
// It can be explicitly disabled by setting NEXT_PUBLIC_SOROBAN_SWEEP=0 (or
// "false") in the environment, which fully reverts to the classic-only path.
export const SOROBAN_SWEEP_ENABLED: boolean =
  process.env.NEXT_PUBLIC_SOROBAN_SWEEP !== "0" && process.env.NEXT_PUBLIC_SOROBAN_SWEEP !== "false"

// Whether the Soroban sweep is still in beta. When true, the UI labels the
// feature accordingly so users understand adapters are being hardened.
export const SOROBAN_SWEEP_BETA = true

// localStorage key recording that the user has rehearsed the current Soroban
// sweep on testnet / Simulate. Mainnet Soroban writes are gated on this.
export const SOROBAN_REHEARSED_KEY = "blackhole_soroban_rehearsed_v1"
