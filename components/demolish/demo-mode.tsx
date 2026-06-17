"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  ShieldAlert, 
  Trash2, 
  Orbit,

  CheckCircle2, 
  AlertTriangle, 
  Play, 
  Search, 
  RefreshCw, 
  ChevronRight, 
  ArrowRightLeft, 
  Percent, 
  Coins, 
  Key, 
  Lock, 
  Layers, 
  Eye, 
  BookOpen, 
  HelpCircle, 
  Info,
  DollarSign, 
  Activity, 
  Sparkles, 
  Users, 
  Plus, 
  X,
  Smartphone,
  Check,
  AlertCircle
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { loadAccountAudit } from "@/lib/stellar/account";
import type { AccountAudit, NetworkId } from "@/lib/stellar/types";

// --- Types & Schema Definition ---
interface Trustline {
  assetCode: string;
  assetIssuer: string;
  balance: string;
  limit: string;
  isSoroban?: boolean;
}

interface DataEntry {
  key: string;
  value: string;
}

interface Signer {
  key: string;
  weight: number;
  type: string;
}

interface DexOffer {
  id: string;
  sellingCode: string;
  buyingCode: string;
  amount: string;
  price: string;
}

interface AmmPosition {
  poolId: string;
  assetA: string;
  assetB: string;
  shares: string;
  xlmValue: string;
  tokenAValue: string;
  tokenBValue: string;
}

interface SorobanDeFi {
  protocol: "Blend" | "Soroswap" | "Aquarius";
  type: "Lending" | "Liquidity Pool" | "Farming Stake";
  symbol: string;
  supplied: string;
  borrowed: string;
  rewardEarned: string;
  collateralized: boolean;
}

interface TokenAllowance {
  tokenCode: string;
  spender: string;
  amount: string;
}

interface AccountState {
  accountId: string;
  xlmBalance: number;
  baseReserves: number; // minimum ledger balance
  sponsoredReserves: number;
  numSponsoring: number; // if > 0, blocks merge!
  numSponsored: number;
  trustlines: Trustline[];
  dataEntries: DataEntry[];
  signers: Signer[];
  thresholdLow: number;
  thresholdMed: number;
  thresholdHigh: number;
  dexOffers: DexOffer[];
  ammPositions: AmmPosition[];
  sorobanPositions: SorobanDeFi[];
  allowances: TokenAllowance[];
  claimableBalances: { id: string; assetCode: string; amount: string; sponsor: string }[];
}

// A neutral, zeroed account used before any real lookup happens in live mode —
// so the explorer never shows fabricated numbers on first paint.
const EMPTY_ACCOUNT: AccountState = {
  accountId: "",
  xlmBalance: 0,
  baseReserves: 0,
  sponsoredReserves: 0,
  numSponsoring: 0,
  numSponsored: 0,
  trustlines: [],
  dataEntries: [],
  signers: [],
  thresholdLow: 0,
  thresholdMed: 0,
  thresholdHigh: 0,
  dexOffers: [],
  ammPositions: [],
  sorobanPositions: [],
  allowances: [],
  claimableBalances: [],
};

// Map the canonical AccountAudit (real Horizon + keyless Soroban discovery)
// onto this component's AccountState. Everything here is real on-chain data —
// no placeholders or heuristics are injected.
function mapAuditToAccountState(audit: AccountAudit): AccountState {
  const trustlines: Trustline[] = audit.balances
    .filter((b) => !b.asset.isNative)
    .map((b) => ({
      assetCode: b.asset.code,
      assetIssuer: b.asset.issuer ?? "",
      balance: b.balance,
      limit: b.limit ?? "0",
    }));

  const ammPositions: AmmPosition[] = audit.liquidityPools.map((p) => {
    const a = p.reserves[0];
    const b = p.reserves[1];
    const nativeReserve = p.reserves.find((r) => r.asset.isNative);
    return {
      poolId: p.poolId,
      assetA: a?.asset.code ?? "?",
      assetB: b?.asset.code ?? "?",
      shares: p.shares,
      xlmValue: nativeReserve ? nativeReserve.amount : "—",
      tokenAValue: a ? `${a.amount} ${a.asset.code}` : "—",
      tokenBValue: b ? `${b.amount} ${b.asset.code}` : "—",
    };
  });

  const sorobanPositions: SorobanDeFi[] = [
    ...audit.defiPositions.map((d) => ({
      protocol: d.protocol as SorobanDeFi["protocol"],
      type: (d.kind as SorobanDeFi["type"]) ?? "Lending",
      symbol: d.summary,
      supplied: "—",
      borrowed: "—",
      rewardEarned: "—",
      collateralized: false,
    })),
    ...audit.sorobanTokens.map((t) => ({
      protocol: (t.protocolLabel ?? "Soroban") as SorobanDeFi["protocol"],
      type: "Liquidity Pool" as SorobanDeFi["type"],
      symbol: t.symbol ?? t.name ?? `${t.contractId.slice(0, 4)}…${t.contractId.slice(-4)}`,
      supplied: t.displayBalance,
      borrowed: "0",
      rewardEarned: "—",
      collateralized: false,
    })),
  ];

  const allowances: TokenAllowance[] = audit.sorobanAllowances.map((a) => ({
    tokenCode: a.symbol ?? `${a.contractId.slice(0, 4)}…`,
    spender: a.spender,
    amount: a.amount,
  }));

  return {
    accountId: audit.publicKey,
    xlmBalance: parseFloat(audit.nativeBalance) || 0,
    baseReserves: parseFloat(audit.minBalance) || 0,
    sponsoredReserves: audit.sponsorship.numSponsored * 0.5,
    numSponsoring: audit.sponsorship.numSponsoring,
    numSponsored: audit.sponsorship.numSponsored,
    trustlines,
    dataEntries: audit.dataEntries.map((d) => ({ key: d.name, value: d.value })),
    signers: audit.signers.map((s) => ({ key: s.key, weight: s.weight, type: s.type })),
    thresholdLow: audit.thresholds.low,
    thresholdMed: audit.thresholds.med,
    thresholdHigh: audit.thresholds.high,
    dexOffers: audit.openOffers.map((o) => ({
      id: o.id,
      sellingCode: o.selling.code,
      buyingCode: o.buying.code,
      amount: o.amount,
      price: o.price,
    })),
    ammPositions,
    sorobanPositions,
    allowances,
    claimableBalances: audit.claimableBalances.map((c) => ({
      id: c.id,
      assetCode: c.asset.code,
      amount: c.amount,
      sponsor: c.claimableNow ? "Claimable now" : c.predicateSummary || "—",
    })),
  };
}

export function DemoModeSimulation({
  explorerMode: controlledMode,
  onExplorerModeChange,
  hideModeToggle = false,
}: {
  explorerMode?: "sandbox" | "live"
  onExplorerModeChange?: (mode: "sandbox" | "live") => void
  hideModeToggle?: boolean
} = {}) {
  // --- Sandbox Scenario Preloads ---
  const scenarios: Record<string, AccountState> = {
    trader: {
      accountId: "GDEX2TRADER3O4DEMOXXOXZT5L7Z3XLR6JTRW67WOKIURKTLSDHSA3J",
      xlmBalance: 145.2,
      baseReserves: 15.0,
      sponsoredReserves: 0.0,
      numSponsoring: 0,
      numSponsored: 0,
      trustlines: [
        { assetCode: "USDC", assetIssuer: "GBBD47IF6LWK7P7M65B6743O7ZNLIZXGYT64S2676PWS", balance: "320.00", limit: "10000.0" },
        { assetCode: "yXLM", assetIssuer: "GDRSOH6V6ADGPMSTCSI6W3FTSK5BZBCC76AW67SZZT64", balance: "0.02", limit: "5000.0" },
        { assetCode: "AQUA", assetIssuer: "GBNZ6J2STMI37F647MZNLIZXGYT64S2676PWS6W3FTSK5BZB", balance: "45000.00", limit: "100000.0" },
      ],
      dataEntries: [
        { key: "anchor_memo_id", value: "DemoTrader01" },
        { key: "risk_profile", value: "aggressive_trading" }
      ],
      signers: [
        { key: "GDEX2TRADER3O4DEMOXXOXZT5L7Z3XLR6JTRW67WOKIURKTLSDHSA3J", weight: 1, type: "ed25519_public_key" }
      ],
      thresholdLow: 1,
      thresholdMed: 1,
      thresholdHigh: 1,
      dexOffers: [
        { id: "98421054", sellingCode: "USDC", buyingCode: "XLM", amount: "50.00", price: "8.25" },
        { id: "98421390", sellingCode: "XLM", buyingCode: "yXLM", amount: "10.00", price: "0.99" },
        { id: "98421712", sellingCode: "AQUA", buyingCode: "USDC", amount: "2000.00", price: "0.005" }
      ],
      ammPositions: [
        { poolId: "6f5a3b2c9d...e10a", assetA: "XLM", assetB: "USDC", shares: "12.50", xlmValue: "30.0", tokenAValue: "15.0 XLM", tokenBValue: "12.0 USDC" }
      ],
      sorobanPositions: [],
      allowances: [],
      claimableBalances: [
        { id: "00000000a1b2c3d4e5f6...", assetCode: "AQUA", amount: "150.00", sponsor: "GBNZ6J2STMI3..." }
      ]
    },
    sponsoring: {
      accountId: "GSPONSOR4BLOCKED3RESERVE5DEMOXX7Z3XLR6JTRW67WOKIURKTLDHK",
      xlmBalance: 84.0,
      baseReserves: 22.5,
      sponsoredReserves: 3.0,
      numSponsoring: 3, // Sponsoring 3 ledger entries for other users/contracts! Blocks Merge.
      numSponsored: 0,
      trustlines: [
        { assetCode: "EURC", assetIssuer: "GDUI47IF6LWK7P7M65B6743O7ZNLIZXGYT64S2676PWS", balance: "100.00", limit: "5000.0" }
      ],
      dataEntries: [
        { key: "agent_sponsorship_ref", value: "active" }
      ],
      signers: [
        { key: "GSPONSOR4BLOCKED3RESERVE5DEMOXX7Z3XLR6JTRW67WOKIURKTLDHK", weight: 1, type: "ed25519_public_key" }
      ],
      thresholdLow: 1,
      thresholdMed: 1,
      thresholdHigh: 1,
      dexOffers: [],
      ammPositions: [],
      sorobanPositions: [],
      allowances: [],
      claimableBalances: []
    },
    multisig: {
      accountId: "GMULTI3SIGNER5THRESHOLD4DEMOXXZ3XLR6JTRW67WOKIURKTLSDHSA",
      xlmBalance: 215.0,
      baseReserves: 10.0,
      sponsoredReserves: 0.0,
      numSponsoring: 0,
      numSponsored: 0,
      trustlines: [
        { assetCode: "USDC", assetIssuer: "GBBD47IF6LWK7P7M65B6743O7ZNLIZXGYT64S2676PWS", balance: "0.00", limit: "1000.0" }
      ],
      dataEntries: [
        { key: "multisig_state", value: "active_vault" }
      ],
      signers: [
        { key: "GMULTI3SIGNER5THRESHOLD4DEMOXXZ3XLR6JTRW67WOKIURKTLSDHSA", weight: 1, type: "ed25519_public_key" },
        { key: "GCOSIGNER2PARTNERMDFK7P7M65B6743O7ZNLIZXGYT64S2676PWS6", weight: 1, type: "ed25519_public_key" },
        { key: "GBACKUP3LEDGER7ZNLIZXGYT64S2676PWS6W3FTSK5BZBCC76AW67", weight: 1, type: "ed25519_public_key" }
      ],
      thresholdLow: 1,
      thresholdMed: 2, // Requires weight sum >= 2 to merge / transact
      thresholdHigh: 2,
      dexOffers: [],
      ammPositions: [],
      sorobanPositions: [],
      allowances: [],
      claimableBalances: []
    },
    soroban: {
      accountId: "GDEFI4SOROBAN3CONTRACTS5DEMOXXK4XLR6JTRW67WOKIURKTLSDHS",
      xlmBalance: 350.0,
      baseReserves: 25.0,
      sponsoredReserves: 0.0,
      numSponsoring: 0,
      numSponsored: 1,
      trustlines: [
        { assetCode: "USDC", assetIssuer: "GBBD47IF6LWK7P7M65B6743O7ZNLIZXGYT64S2676PWS", balance: "1200.00", limit: "50000.0", isSoroban: true },
        { assetCode: "BLND", assetIssuer: "GBLEND7IF6LWK7P7M65B6743O7ZNLIZXGYT64S2676PWS", balance: "500.00", limit: "10000.0", isSoroban: true }
      ],
      dataEntries: [
        { key: "soroban_active_flag", value: "0x01" }
      ],
      signers: [
        { key: "GDEFI4SOROBAN3CONTRACTS5DEMOXXK4XLR6JTRW67WOKIURKTLSDHS", weight: 1, type: "ed25519_public_key" }
      ],
      thresholdLow: 1,
      thresholdMed: 1,
      thresholdHigh: 1,
      dexOffers: [],
      ammPositions: [
        { poolId: "8f5a1c1c9d...e12a", assetA: "XLM", assetB: "BLND", shares: "40.00", xlmValue: "80.0", tokenAValue: "40.0 XLM", tokenBValue: "200.0 BLND" }
      ],
      sorobanPositions: [
        { protocol: "Blend", type: "Lending", symbol: "USDC", supplied: "800.00", borrowed: "0.00", rewardEarned: "14.50 BLND", collateralized: true },
        { protocol: "Soroswap", type: "Liquidity Pool", symbol: "XLM/USDC", supplied: "400.00", borrowed: "0.00", rewardEarned: "2.10 XLM", collateralized: false },
        { protocol: "Aquarius", type: "Farming Stake", symbol: "AQUA/XLM", supplied: "1200.00", borrowed: "0.00", rewardEarned: "450.00 AQUA", collateralized: false }
      ],
      allowances: [
        { tokenCode: "USDC", spender: "SoroswapRouter_Contract_Address", amount: "Infinite" },
        { tokenCode: "USDC", spender: "BlendPool_Deposit_Contract", amount: "1000.00" }
      ],
      claimableBalances: []
    }
  };

  // --- Core Application States ---
  const [selectedScenarioKey, setSelectedScenarioKey] = useState<string>("trader");
  const [internalExplorerMode, setInternalExplorerMode] = useState<"sandbox" | "live">("live");
  // When the parent provides explorerMode, the component is controlled (the
  // sidebar submenu drives which Toolkit tool is shown); otherwise it manages
  // its own internal toggle.
  const explorerMode = controlledMode ?? internalExplorerMode;
  const setExplorerMode = (mode: "sandbox" | "live") => {
    if (onExplorerModeChange) onExplorerModeChange(mode);
    if (controlledMode === undefined) setInternalExplorerMode(mode);
  };
  const [liveAddressInput, setLiveAddressInput] = useState<string>("");
  const [liveNetwork, setLiveNetwork] = useState<"testnet" | "mainnet">("testnet");
  const [activeTab, setActiveTab] = useState<"balances" | "defi" | "claims" | "access">("balances");
  
  // Starts empty — the live Account Explorer fills this with REAL on-chain data
  // on lookup; sandbox scenarios overwrite it only when explicitly selected.
  const [account, setAccount] = useState<AccountState>(EMPTY_ACCOUNT);
  const [isLoadingLive, setIsLoadingLive] = useState<boolean>(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  // Exchange Transfer Problem state (Phase 7)
  const [useMediator, setUseMediator] = useState<boolean>(true);
  const [mediatorAccount, setMediatorAccount] = useState<string>("G_MEDIATOR_TEMP_STABLE_SP3XLR6JTRW67WOKIURKTLSD");
  const [exchangeDepositAddress, setExchangeDepositAddress] = useState<string>("GA5XN2ZNP4HKZ2ZNP4HKZ2ZNP4HKZ2ZNP4HKZ2ZNP4HKZ2ZNP4HKZ2ZN");
  const [exchangeMemo, setExchangeMemo] = useState<string>("1065403211_STELLAR_REF");
  const [targetMergeAddress, setTargetMergeAddress] = useState<string>("G_DESTINATION_ACCOUNT_XLM_RECIPIENT_3XLR6");

  // Multisig collection simulation
  const [cosignedKeys, setCosignedKeys] = useState<string[]>([]);
  const [signatureInput, setSignatureInput] = useState<string>("");

  // Dry Run state (Phase 2 & 8)
  const [dryRunReport, setDryRunReport] = useState<any[]>([]);
  const [showDryRun, setShowDryRun] = useState<boolean>(false);

  // Execution state & Log outputs
  const [isDemolishing, setIsDemolishing] = useState<boolean>(false);
  const [demolitionComplete, setDemolitionComplete] = useState<boolean>(false);
  const [demolitionLogs, setDemolitionLogs] = useState<string[]>([]);
  const [confirmInput, setConfirmInput] = useState<string>("");
  const [sliderPosition, setSliderPosition] = useState<number>(0);
  const sliderRef = useRef<HTMLDivElement>(null);

  // Gemini Safe Audit States
  const [isGeneratingAudit, setIsGeneratingAudit] = useState<boolean>(false);
  const [aiAuditReport, setAiAuditReport] = useState<string | null>(null);
  const [showHelperModal, setShowHelperModal] = useState<boolean>(false);

  // Select scenario and configure clean baseline
  const selectScenario = (key: string) => {
    setSelectedScenarioKey(key);
    setAccount(JSON.parse(JSON.stringify(scenarios[key])));
    // Reset simulator actions
    setCosignedKeys([]);
    setDemolitionLogs([]);
    setDemolitionComplete(false);
    setIsDemolishing(false);
    setShowDryRun(false);
    setConfirmInput("");
    setSliderPosition(0);
    setAiAuditReport(null);
  };

  // --- Safety & Risk Analysis Engine (Phase 2) ---
  const safetyCheck = useMemo(() => {
    const blockers: string[] = [];
    const warnings: string[] = [];
    
    // Sponsorship blocker (Phase 2)
    if (account.numSponsoring > 0) {
      blockers.push(`Sponsoring ${account.numSponsoring} balance reserves. Ledger blocks merge while sponsoring others.`);
    }

    // Signers / Multisig analysis
    const totalSignaturesWeight = account.signers.reduce((acc, sig) => {
      if (sig.key === account.accountId || cosignedKeys.includes(sig.key)) {
        return acc + sig.weight;
      }
      return acc;
    }, 0);

    const thresholdNeeded = Math.max(account.thresholdLow, account.thresholdMed, account.thresholdHigh);
    const hasMultisig = account.signers.length > 1;
    let satisfiesMultisig = true;

    if (hasMultisig && totalSignaturesWeight < thresholdNeeded) {
      satisfiesMultisig = false;
      blockers.push(`Multisig threshold of ${thresholdNeeded} not met. Current signature weight: ${totalSignaturesWeight}/${thresholdNeeded}. Collect signatures below.`);
    } else if (hasMultisig) {
      warnings.push(`Multisig configured. High security mode - signature weight of ${totalSignaturesWeight} gathered.`);
    }

    // Active position warnings (Phase 3 & 4)
    if (account.dexOffers.length > 0) {
      warnings.push(`Has ${account.dexOffers.length} active DEX Offers. Merge will fail if there are active offers. Must cancel offers.`);
    }
    if (account.ammPositions.length > 0) {
      warnings.push(`Has ${account.ammPositions.length} active AMM Positions. Must burn/withdraw LP positions.`);
    }
    if (account.sorobanPositions.length > 0) {
      warnings.push(`Has ${account.sorobanPositions.length} Soroban DeFi smart contract integrations (Blend, Soroswap, Aquarius). Must claim collateral and exit pool.`);
    }

    // Asset trustlines (Phase 5)
    const validTrustlines = account.trustlines.filter(t => parseFloat(t.balance) > 0);
    if (validTrustlines.length > 0) {
      warnings.push(`Has ${validTrustlines.length} trustlines with active token balances. Must convert to XLM and close trustlines.`);
    } else if (account.trustlines.length > 0) {
      warnings.push(`Has ${account.trustlines.length} empty trustlines. Must delete trustlines (limit 0) to recover base reserve.`);
    }

    // Claimable balances (Phase 6)
    if (account.claimableBalances.length > 0) {
      warnings.push(`Has ${account.claimableBalances.length} pending claimable balances. Claims must be processed before account closure.`);
    }

    // Data entries (Phase 5)
    if (account.dataEntries.length > 0) {
      warnings.push(`Has ${account.dataEntries.length} key-value data entries. Must clear entries to recover 0.5 XLM per entry reserve.`);
    }

    // Minimum balance
    if (account.xlmBalance <= account.baseReserves) {
      warnings.push(`XLM balance is close to the minimum ledger reserve limit.`);
    }

    return {
      blockers,
      warnings,
      isCleanToGo: blockers.length === 0 && warnings.length === 0,
      canDemolish: blockers.length === 0,
      thresholdNeeded,
      totalSignaturesWeight,
      hasMultisig
    };
  }, [account, cosignedKeys]);

  // --- Real Network Horizon Query (Phase 1 Live Mode) ---
  const handleLiveLookup = async () => {
    if (!liveAddressInput || !liveAddressInput.startsWith("G")) {
      setLiveError("Please enter a valid Stellar Public Account ID starting with 'G'.");
      return;
    }

    setIsLoadingLive(true);
    setLiveError(null);
    setAiAuditReport(null);
    setCosignedKeys([]);

    try {
      // Read the REAL account with the same canonical engine the Live/Demo
      // wizard uses: real balances, liquidity pools, claimable balances, and
      // keyless Soroban discovery. No fabricated positions are injected.
      const network: NetworkId = liveNetwork === "mainnet" ? "public" : "testnet";
      const audit = await loadAccountAudit(liveAddressInput.trim(), network);
      setAccount(mapAuditToAccountState(audit));
    } catch (err: any) {
      const msg = err?.message ?? "";
      setLiveError(
        /not found|404/i.test(msg)
          ? "Account ID not found on Stellar Ledger. Make sure it is funded!"
          : msg || "An unexpected error occurred while communicating with Stellar Horizon node.",
      );
    } finally {
      setIsLoadingLive(false);
    }
  };

  // --- Dynamic Operations Generation & Dry Run Planner ---
  const compileDryRun = () => {
    const list: any[] = [];
    let cumulativeRefund = 0;

    // 1. Classic DEX offers
    account.dexOffers.forEach(o => {
      list.push({
        phase: "Phase 3: DEX Cleanup",
        action: `Cancel DEX Offer #${o.id}`,
        operation: `ManageSellOfferOp (sell: ${o.sellingCode}, buy: ${o.buyingCode}, price: ${o.price}, offerID: "${o.id}", amount: "0.00")`,
        refund: "+0.50 XLM (reclaimed reserve)"
      });
      cumulativeRefund += 0.5;
    });

    // 2. AMM Liquidity Pools
    account.ammPositions.forEach(p => {
      list.push({
        phase: "Phase 3: AMM Position Exit",
        action: `Withdraw LP Shares from Pool [${p.assetA}/${p.assetB}]`,
        operation: `LiquidityPoolWithdrawOp (poolID: "${p.poolId}", maxAmountA: "${p.tokenAValue}", maxAmountB: "${p.tokenBValue}", minShares: "${p.shares}")`,
        refund: "Reclaims underlying assets + recovers pool entry reserve (0.5 XLM)"
      });
      cumulativeRefund += 0.5;
    });

    // 3. Soroban DeFi Position Cleanup
    account.sorobanPositions.forEach(sp => {
      list.push({
        phase: "Phase 3: Soroban Liquidation",
        action: `Exit ${sp.protocol} ${sp.type} for ${sp.symbol}`,
        operation: `SorobanHostCall (Contract: "${sp.protocol.toLowerCase()}_pool_v1", function: "withdraw_all", args: [UserAddress, "${sp.supplied}"])`,
        refund: "Claimed supplies, rewards, and released local Soroban contract instance storage storage-fees"
      });
    });

    // 4. Token Allowance / Authorizations
    account.allowances.forEach(al => {
      list.push({
        phase: "Phase 3: Revoke Allowances",
        action: `Approve 0 allowance to contract "${al.spender}"`,
        operation: `SorobanHostValueCall (token: "${al.tokenCode}", function: "approve", args: [Spender, amount: "0"])`,
        refund: "Secures account authorizations prior to key wipe"
      });
    });

    // 5. Asset Liquidation (Phase 4)
    account.trustlines.forEach(t => {
      if (parseFloat(t.balance) > 0) {
        list.push({
          phase: "Phase 4: Asset Liquidation",
          action: `Convert ${t.balance} ${t.assetCode} into native XLM`,
          operation: `PathPaymentStrictReceiveOp (sendAsset: ${t.assetCode}, sendMax: "${t.balance}", destAsset: XLM, destMin: "Simulated market rate")`,
          refund: `Inflows approximate XLM into balance`
        });
      }
    });

    // 6. Claim Recovery (Phase 6)
    account.claimableBalances.forEach(cb => {
      list.push({
        phase: "Phase 6: Claim Recovery",
        action: `Claim balance #${cb.id.substring(0, 8)}...`,
        operation: `ClaimClaimableBalanceOp (balanceID: "${cb.id}")`,
        refund: `Claimed +${cb.amount} ${cb.assetCode} to wallet`
      });
    });

    // 7. Cleanup trustlines, data entries & extra signers (Phase 5)
    account.trustlines.forEach(t => {
      list.push({
        phase: "Phase 5: Trustline Demolition",
        action: `Remove Trustline for ${t.assetCode}`,
        operation: `ChangeTrustOp (asset: ${t.assetCode}, limit: "0.00")`,
        refund: "+0.50 XLM (reclaimed trustline reserve)"
      });
      cumulativeRefund += 0.5;
    });

    account.dataEntries.forEach(d => {
      list.push({
        phase: "Phase 5: Clear Ledger Storage",
        action: `Delete Data Entry "${d.key}"`,
        operation: `ManageDataOp (key: "${d.key}", value: null)`,
        refund: "+0.50 XLM (reclaimed data reserve)"
      });
      cumulativeRefund += 0.5;
    });

    account.signers.forEach((s) => {
      if (s.key !== account.accountId) {
        list.push({
          phase: "Phase 5: Revoke Multisig Signers",
          action: `Remove Cosigner ${s.key.substring(0, 10)}...`,
          operation: `SetOptionsOp (signerKey: "${s.key}", signerWeight: 0)`,
          refund: "+0.50 XLM (reclaimed signer slot reserve)"
        });
        cumulativeRefund += 0.5;
      }
    });

    // 8. Final Demolition (Phase 8) Split / Transfer
    const estimatedFinalMergeBalance = account.xlmBalance + cumulativeRefund - 1.0; // Minus fees
    
    if (useMediator) {
      list.push({
        phase: "Phase 7 & 8: Mediator routing & Merge",
        action: `Deploy Temporary Mediator Payment`,
        operation: `PaymentOp (destination: "${mediatorAccount}", amount: "${estimatedFinalMergeBalance.toFixed(2)} XLM", memo: "${exchangeMemo}")`,
        refund: "Relays funds safely to exchange dashboard. Zero remainder risk."
      });
      list.push({
        phase: "Phase 8: Final Demolition",
        action: `Merge account and retrieve last remaining reserves`,
        operation: `AccountMergeOp (destination: "${mediatorAccount}")`,
        refund: "Reclaims remaining 1.0 XLM starting base reserve. Wallet completely Demolished."
      });
    } else {
      list.push({
        phase: "Phase 8: Final Demolition",
        action: `Direct Account Merge`,
        operation: `AccountMergeOp (destination: "${targetMergeAddress}")`,
        refund: "Reclaims remaining 1.0 XLM starting base reserve and closes wallet."
      });
    }

    setDryRunReport(list);
    setShowDryRun(true);
  };

  // --- Gemini Security Report Integration ---
  const generateAISecurityAudit = async () => {
    setIsGeneratingAudit(true);
    setAiAuditReport(null);
    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accountData: account }),
      });
      const data = await response.json();
      if (response.ok) {
        setAiAuditReport(data.result);
      } else {
        setAiAuditReport(`### AI Analysis Error\nFailed to invoke server-side Gemini auditor: **${data.error}**`);
      }
    } catch (err: any) {
      setAiAuditReport(`### AI Connection Offline\nCould not connect to security microservice. ${err?.message || ""}`);
    } finally {
      setIsGeneratingAudit(false);
    }
  };

  // --- Cosigner Simulation ---
  const handleAddCosignature = () => {
    if (!signatureInput) return;
    const matchedSigner = account.signers.find(
      s => s.key === signatureInput || s.key.substring(0, 10) === signatureInput.substring(0, 10)
    );
    if (matchedSigner) {
      if (!cosignedKeys.includes(matchedSigner.key)) {
        setCosignedKeys([...cosignedKeys, matchedSigner.key]);
        setSignatureInput("");
      }
    } else {
      alert("Entered key does not match any signers in the threshold configuration!");
    }
  };

  // --- Action Simulator: Wipe DEX offers inside Sandbox ---
  const simulateCancelOffers = () => {
    setAccount(prev => {
      const activeOffersCount = prev.dexOffers.length;
      return {
        ...prev,
        xlmBalance: prev.xlmBalance + (activeOffersCount * 0.5), // refund reserves
        dexOffers: []
      };
    });
    setDemolitionLogs(prev => [...prev, `[CLASSIC] Cancelled ${account.dexOffers.length} classic DEX offers. Reclaimed ${account.dexOffers.length * 0.5} XLM reserves.`]);
  };

  // --- Action Simulator: Withdraw AMMs ---
  const simulateWithdrawAMMs = () => {
    setAccount(prev => {
      const activeAMMsCount = prev.ammPositions.length;
      return {
        ...prev,
        xlmBalance: prev.xlmBalance + 30.0 + (activeAMMsCount * 0.5), // refund LP value + reserve
        ammPositions: []
      };
    });
    setDemolitionLogs(prev => [...prev, `[AMM] Withdrew liquidity from XLM/USDC pool. Exited LP position, retrieved 15.0 XLM & 12.0 USDC, and recycled 0.5 XLM active reserve.`]);
  };

  // --- Action Simulator: Exit Soroban contracts ---
  const simulateExitSoroban = () => {
    setAccount(prev => {
      return {
        ...prev,
        xlmBalance: prev.xlmBalance + 250.0, // Swapped/received value
        sorobanPositions: [],
        allowances: []
      };
    });
    setDemolitionLogs(prev => [
      ...prev, 
      `[SOROBAN] Invoked Contract withdraw on Blend Pool. Closed lending position, recovered collateral USDC supply.`,
      `[SOROBAN] Closed Soroswap AMM contract liquidity pools. Recycled 0.5 XLM reserves.`, 
      `[SOROBAN] Exited Aquarius staking farm. Cleared all allowances/authorizations to infinite spenders.`
    ]);
  };

  // --- Action Simulator: Liquidate Token Balances to XLM ---
  const simulateTokenLiquidation = () => {
    let convertedXlm = 0;
    account.trustlines.forEach(t => {
      const amt = parseFloat(t.balance);
      if (amt > 0) {
        if (t.assetCode === "USDC") convertedXlm += amt * 8.0; // 8 XLM per USDC
        else if (t.assetCode === "EURC") convertedXlm += amt * 9.0;
        else if (t.assetCode === "AQUA") convertedXlm += amt * 0.01;
      }
    });

    setAccount(prev => {
      return {
        ...prev,
        xlmBalance: prev.xlmBalance + convertedXlm,
        trustlines: prev.trustlines.map(t => ({ ...t, balance: "0.00" }))
      };
    });
    setDemolitionLogs(prev => [
      ...prev, 
      `[ASSETS] Route liquidated balances: Sold USDC, EURC, yXLM, and AQUA on Stellar Path Payments.`, 
      `[ASSETS] Inflowed +${convertedXlm.toFixed(2)} native XLM into wallet balance.`
    ]);
  };

  // --- Action Simulator: Recover Claimable Balances ---
  const simulateRecoverClaims = () => {
    setAccount(prev => {
      return {
        ...prev,
        claimableBalances: [],
        trustlines: prev.trustlines.map(t => {
          if (t.assetCode === "AQUA") {
            return { ...t, balance: (parseFloat(t.balance) + 150.0).toFixed(2) };
          }
          return t;
        })
      };
    });
    setDemolitionLogs(prev => [...prev, `[CLAIMS] Recovered claimable balance #00000000a1b2c3d4... Claims completed. Claimed 150.00 AQUAs.`]);
  };

  // --- Demolition Sliding Confirmation Action (Phase 7 & 8) ---
  const handleSliderDrag = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!sliderRef.current || isDemolishing || demolitionComplete || !safetyCheck.canDemolish) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const rect = sliderRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const width = rect.width;
    
    let percent = Math.round((relativeX / width) * 100);
    percent = Math.max(0, Math.min(100, percent));
    setSliderPosition(percent);

    if (percent >= 98) {
      setSliderPosition(100);
      triggerActualDemolition();
    }
  };

  const handleSliderEnd = () => {
    if (sliderPosition < 98) {
      setSliderPosition(0);
    }
  };

  // --- Trigger Full Sequence of Demolition (All 8 Phases) ---
  const triggerActualDemolition = async () => {
    if (confirmInput.toLowerCase() !== "demolish") {
      alert("Please type 'DEMOLISH' in the safety check input field first!");
      setSliderPosition(0);
      return;
    }

    setIsDemolishing(true);
    setDemolitionLogs([]);
    
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    // Phase 1 Audit Check
    setDemolitionLogs(prev => [...prev, "💥 INITIATING STELLAR DEMOLITION PROTOCOL..."]);
    await sleep(800);
    setDemolitionLogs(prev => [...prev, "🔍 PHASE 1: Re-auditing on-chain variables, trustlines, data elements, and safety parameters... OK"]);
    await sleep(900);

    // Phase 2 Safety Config Validator
    setDemolitionLogs(prev => [...prev, "🛡️ PHASE 2: Check active sponsorships, required cosigners, and threshold metrics... COMPLETE"]);
    if (account.numSponsoring > 0) {
      setDemolitionLogs(prev => [...prev, "❌ FAILURE: Stellar network rejects account merge. Account blocks merges since it sponsors active reserves for other. Exit manual reservation first."]);
      setIsDemolishing(false);
      setSliderPosition(0);
      return;
    }
    await sleep(600);

    // Phase 3 & 4: DEX Offers & DeFi position cleanup
    if (account.dexOffers.length > 0) {
      setDemolitionLogs(prev => [...prev, `⚡ PHASE 3: Canceling ${account.dexOffers.length} classic DEX offers sequentially...`]);
      await sleep(1000);
      setDemolitionLogs(prev => [...prev, `✅ DEX offers fully canceled. Reclaimed ${account.dexOffers.length * 0.5} XLM reserves.`]);
    }
    if (account.ammPositions.length > 0) {
      setDemolitionLogs(prev => [...prev, "⚡ PHASE 3: Exiting liquidity pool systems (Classic AMMs). Withdraw raw assets..."]);
      await sleep(1100);
      setDemolitionLogs(prev => [...prev, "✅ Liquidity withdrawn. Retrieved base pool reserve parameters."]);
    }
    if (account.sorobanPositions.length > 0) {
      setDemolitionLogs(prev => [...prev, "⚡ PHASE 3: Decomposing Soroban DeFi Smart Contracts supplied assets (Blend, Soroswap)..."]);
      await sleep(1200);
      setDemolitionLogs(prev => [...prev, "✅ Collateral supply withdrawn. Revoked smart contract allowance authorizations."]);
    }

    // Phase 4: Token liquidation router
    const totalRemainingTokensCount = account.trustlines.filter(t => parseFloat(t.balance) > 0).length;
    if (totalRemainingTokensCount > 0) {
      setDemolitionLogs(prev => [...prev, `⚡ PHASE 4: Initiating token liquidation routing system using Stellar path routing...`]);
      await sleep(1300);
      setDemolitionLogs(prev => [...prev, `✅ Fully routed and liquidated token assets into XLM.`]);
    }

    // Phase 6: Recover claimable balances
    if (account.claimableBalances.length > 0) {
      setDemolitionLogs(prev => [...prev, "⚡ PHASE 6: Discovering and sweeping claimable balances..."]);
      await sleep(1000);
      setDemolitionLogs(prev => [...prev, `✅ Claimed ${account.claimableBalances.length} claimable balances. Relayed assets to buffer.`]);
    }

    // Phase 5: Clean Trustlines and Data Entries
    setDemolitionLogs(prev => [...prev, "⚡ PHASE 5: Pruning trustlines limit limits to 0..."]);
    await sleep(900);
    setDemolitionLogs(prev => [...prev, "⚡ PHASE 5: Wiping custom on-chain string data entries and clearing storage slots..."]);
    await sleep(800);
    setDemolitionLogs(prev => [...prev, "⚡ PHASE 5: Revoking additional signers weights and resetting default signer configurations..."]);
    await sleep(1000);

    // Phase 7: Exchange Mediator Route
    if (useMediator) {
      setDemolitionLogs(prev => [...prev, `⚠️ PHASE 7: Direct Exchange Merge restricted. Routing funds to Temporary Mediator Account [${mediatorAccount.substring(0, 16)}...]`]);
      await sleep(1000);
      setDemolitionLogs(prev => [...prev, `➡️ Mediator routing payment dispatched: Sent equivalent assets with Memo: [${exchangeMemo}]`]);
    } else {
      setDemolitionLogs(prev => [...prev, `➡️ Direct ledger transfer initiated to destination account [${targetMergeAddress.substring(0, 16)}...]`]);
    }
    await sleep(1000);

    // Phase 8: Final Demolition
    setDemolitionLogs(prev => [...prev, "💥 PHASE 8: Firing final ACCOUNT_MERGE operation. Sending base reserve (1.0 XLM)..."]);
    await sleep(1200);
    setDemolitionLogs(prev => [...prev, "💣 ACCOUNT TERMINATED. LEDGER ADVISES ACCOUNT TO BE DESTROYED."]);
    
    // Perform simulated data wipe
    setAccount({
      accountId: account.accountId,
      xlmBalance: 0.0,
      baseReserves: 0.0,
      sponsoredReserves: 0.0,
      numSponsoring: 0,
      numSponsored: 0,
      trustlines: [],
      dataEntries: [],
      signers: [],
      thresholdLow: 0,
      thresholdMed: 0,
      thresholdHigh: 0,
      dexOffers: [],
      ammPositions: [],
      sorobanPositions: [],
      allowances: [],
      claimableBalances: []
    });

    setDemolitionComplete(true);
    setIsDemolishing(false);
  };

  return (
    <div className="bg-muted/40 text-foreground rounded-2xl border border-border px-4 py-8 md:px-8 flex flex-col justify-between overflow-hidden" id="app_root_layout">
      {/* --- Top Navigation Header --- */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-border pb-5 mb-8 gap-4" id="tool_header">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-500/10 border border-red-500/40 rounded-xl animate-pulse text-red-500">
            <Orbit className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold font-sans tracking-tight text-foreground mb-0.5">STELLAR DEMOLITION KIT</h1>
              <span className="font-mono text-[10px] bg-red-950 text-red-400 border border-red-900 px-1.5 py-0.5 rounded uppercase">Mainnet v1.4</span>
            </div>
            <p className="text-xs text-muted-foreground font-sans">Strategic wallet demolition, asset liquidation, and compliance merging toolkit</p>
          </div>
        </div>

        {/* Real Horizon Connection toggle or Demo mode selection */}
        {!hideModeToggle && (
        <div className="flex flex-wrap items-center gap-2 bg-muted border border-border p-1 rounded-xl">
          <button 
            onClick={() => setExplorerMode("sandbox")}
            className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-all ${explorerMode === "sandbox" ? "bg-amber-500 text-black font-semibold shadow" : "text-muted-foreground hover:text-foreground"}`}
            id="sandbox_mode_btn"
          >
            <Activity className="h-3.5 w-3.5" />
            Simulation Sandbox
          </button>
          <button 
            onClick={() => setExplorerMode("live")}
            className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-all ${explorerMode === "live" ? "bg-cyan-500 text-black font-semibold shadow" : "text-muted-foreground hover:text-foreground"}`}
            id="live_horizon_mode_btn"
          >
            <Search className="h-3.5 w-3.5" />
            Account Explorer
          </button>
        </div>
        )}
      </header>

      {/* --- Help Section Info Widget --- */}
      <section className="bg-gradient-to-r from-amber-500/10 to-red-500/10 border border-amber-500/20 rounded-2xl p-4 md:p-5 mb-8 flex flex-col md:flex-row items-start gap-4">
        <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-600 mt-1">
          <Info className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-1">
          <h4 className="text-sm font-semibold text-amber-600">Non-Custodial Multi-Scenario Demolition Warning</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Stellar accounts require specific reserves of XLM for every active trustline, open offer, signer, and data entry. Under Stellar Core protocols, merging or deleting an account is strictly locked unless these positions are fully cleared first. Use the <b>Simulation Sandbox Scenarios</b> to evaluate how the demolition system safely cancels DEX offers, withdraws AMM liquidity, claims locked Soroban DeFi positions, routes liquidations, and bypasses the <b>Exchange Transfer Problem</b>.
          </p>
        </div>
        <button 
          onClick={() => setShowHelperModal(true)} 
          className="text-xs text-amber-600 hover:text-amber-600 underline font-semibold flex items-center gap-1 whitespace-nowrap pt-1"
          id="how_it_works_btn"
        >
          <BookOpen className="h-3.5 w-3.5" /> Code Checklist
        </button>
      </section>

      {/* --- Main Dashboard Body Grid --- */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
        
        {/* ================= LEFT COLUMN: CONTROL & SAFETY ================= */}
        <section className="col-span-1 lg:col-span-12 xl:col-span-5 space-y-8 flex flex-col justify-start">
          
          {/* --- Mode Panel Controller --- */}
          <div className="bg-card/95 border border-border p-5 rounded-2xl relative overflow-hidden shadow-xl" id="inspect_panel">
            <h3 className="text-sm font-semibold font-sans uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
              <span className="w-1.5 h-3 bg-red-500 rounded-sm"></span>
              Account Discovery & Inspector
            </h3>

            {/* Sandbox Mode Profiles */}
            {explorerMode === "sandbox" ? (
              <div className="space-y-4" id="sandbox_controllers">
                <div className="label text-xs text-muted-foreground font-sans block mb-1">Select simulated active Stellar Account scenarios:</div>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => selectScenario("trader")}
                    className={`flex flex-col text-left p-3 rounded-lg border text-xs transition ${selectedScenarioKey === "trader" ? "bg-amber-500/10 border-amber-500 text-amber-600" : "bg-muted border-border text-muted-foreground hover:bg-secondary hover:border-border"}`}
                  >
                    <span className="font-semibold text-foreground mb-0.5">Classic DEX Trader</span>
                    <span className="text-[10px] text-muted-foreground">DEX, AMM, claims, data</span>
                  </button>

                  <button 
                    onClick={() => selectScenario("soroban")}
                    className={`flex flex-col text-left p-3 rounded-lg border text-xs transition ${selectedScenarioKey === "soroban" ? "bg-amber-500/10 border-amber-500 text-amber-600" : "bg-muted border-border text-muted-foreground hover:bg-secondary hover:border-border"}`}
                  >
                    <span className="font-semibold text-foreground mb-0.5">Soroban DeFi Whale</span>
                    <span className="text-[10px] text-muted-foreground">Blend, Soroswap, allowances</span>
                  </button>

                  <button 
                    onClick={() => selectScenario("multisig")}
                    className={`flex flex-col text-left p-3 rounded-lg border text-xs transition ${selectedScenarioKey === "multisig" ? "bg-amber-500/10 border-amber-500 text-amber-600" : "bg-muted border-border text-muted-foreground hover:bg-secondary hover:border-border"}`}
                  >
                    <span className="font-semibold text-foreground mb-0.5">Strict Multisig Wallet</span>
                    <span className="text-[10px] text-muted-foreground">Threshold, multiple signers</span>
                  </button>

                  <button 
                    onClick={() => selectScenario("sponsoring")}
                    className={`flex flex-col text-left p-3 rounded-lg border text-xs transition ${selectedScenarioKey === "sponsoring" ? "bg-amber-500/10 border-amber-500 text-amber-600" : "bg-muted border-border text-muted-foreground hover:bg-secondary hover:border-border"}`}
                  >
                    <span className="font-semibold text-foreground mb-0.5">Sponsoring Account</span>
                    <span className="text-[10px] text-red-400">Sponsors reserves (Blocked)</span>
                  </button>
                </div>
              </div>
            ) : (
              // Live Mode Input Fields
              <div className="space-y-4" id="live_controllers">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-muted-foreground">Stellar Horizon Endpoint</label>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setLiveNetwork("testnet")}
                        className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${liveNetwork === "testnet" ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30" : "text-muted-foreground"}`}
                      >
                        Testnet
                      </button>
                      <button 
                        onClick={() => setLiveNetwork("mainnet")}
                        className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${liveNetwork === "mainnet" ? "bg-amber-500/15 text-amber-600 border border-amber-500/30" : "text-muted-foreground"}`}
                      >
                        Mainnet
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input 
                        type="text"
                        placeholder="GDEX... or GA5..."
                        value={liveAddressInput}
                        onChange={(e) => setLiveAddressInput(e.target.value)}
                        className="w-full text-xs font-mono bg-card border border-border rounded-lg px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500 h-10"
                        id="live_address_input_field"
                      />
                    </div>
                    <button 
                      onClick={handleLiveLookup}
                      disabled={isLoadingLive}
                      className="bg-cyan-500 hover:bg-cyan-600 font-semibold text-xs text-black px-4 py-2.5 rounded-lg flex items-center gap-1.5 h-10 transition disabled:opacity-50"
                      id="live_fetch_btn"
                    >
                      {isLoadingLive ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      Query
                    </button>
                  </div>
                  {liveError && (
                    <div className="text-xs text-red-400 bg-red-950/20 border border-red-900 p-2.5 rounded-lg flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                      <span>{liveError}</span>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground text-center italic">Type any public key to view its live trustlines, signers, thresholds, and data.</p>
                </div>
              </div>
            )}

            {/* Account Card Detail Block */}
            <div className="mt-5 pt-4 border-t border-border font-mono text-xs text-muted-foreground space-y-2">
              <div className="flex justify-between items-center bg-card p-2.5 rounded-lg border border-border">
                <span className="text-[10px] uppercase text-muted-foreground font-bold">Account ID</span>
                <span className="text-foreground text-[11px] truncate w-48 text-right font-semibold select-all" title={account.accountId}>
                  {account.accountId.substring(0, 10)}...{account.accountId.substring(account.accountId.length - 8)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="bg-card p-2.5 rounded-lg border border-border flex flex-col justify-between">
                  <span className="text-[10px] uppercase text-muted-foreground font-bold mb-1">CORE XLM BALANCE</span>
                  <span className="text-foreground text-base font-bold">{account.xlmBalance.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">XLM</span></span>
                </div>
                <div className="bg-card p-2.5 rounded-lg border border-border flex flex-col justify-between">
                  <span className="text-[10px] uppercase text-muted-foreground font-bold mb-1">MANDATORY RESERVE</span>
                  <span className="text-foreground text-base font-bold text-amber-600">{account.baseReserves.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">XLM</span></span>
                </div>
              </div>
            </div>
          </div>

          {/* --- Safety & Audit Mitigation Analysis (Phase 2) --- */}
          <div className="bg-card/95 border border-border p-5 rounded-2xl" id="safety_analysis_module">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold font-sans uppercase tracking-wider text-foreground flex items-center gap-2">
                <span className={`w-1.5 h-3 rounded-sm ${safetyCheck.canDemolish ? "bg-green-500" : "bg-red-500"}`}></span>
                Phase 2: Security & Safety Analysis
              </h3>
              <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-mono font-bold ${safetyCheck.canDemolish ? "bg-green-500/10 text-green-400 border border-green-500/30" : "bg-red-500/10 text-red-400 border border-red-500/30"}`}>
                {safetyCheck.canDemolish ? "Demolish Ready" : "Merge Blocked"}
              </span>
            </div>

            {/* List of Blockers or Warnings */}
            <div className="space-y-3">
              {safetyCheck.blockers.map((bl, bIdx) => (
                <div key={bIdx} className="p-3.5 bg-red-950/20 border border-red-900/50 rounded-xl flex items-start gap-3">
                  <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-red-200 uppercase tracking-wide">Merge Blocker Error</h4>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{bl}</p>
                  </div>
                </div>
              ))}

              {safetyCheck.warnings.map((wa, wIdx) => (
                <div key={wIdx} className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wide">Ledger Warning Alert</h4>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{wa}</p>
                  </div>
                </div>
              ))}

              {safetyCheck.isCleanToGo && (
                <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-xl flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-green-300 uppercase tracking-wide">Account Clean for Merge</h4>
                    <p className="text-xs text-muted-foreground mt-1">No outstanding trustlines, data elements, AMMs, DEX offers, or smart-contracts found. The entire balance will be recovered.</p>
                  </div>
                </div>
              )}
            </div>

            {/* AI Security Opinion Button */}
            <div className="mt-4 pt-3 border-t border-border">
              <button 
                onClick={generateAISecurityAudit}
                disabled={isGeneratingAudit}
                className="w-full bg-muted hover:bg-secondary border border-border text-foreground rounded-xl py-2.5 text-xs font-sans font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
                id="ai_audit_btn"
              >
                <Sparkles className="h-4 w-4 text-amber-600 animate-pulse" />
                {isGeneratingAudit ? "Consulting AI Security Agent..." : "Generate AI Safety Opinion"}
              </button>
            </div>

            {/* AI Report Viewer */}
            <AnimatePresence>
              {aiAuditReport && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mt-4 p-4 bg-card border border-amber-500/20 rounded-xl max-h-60 overflow-y-auto"
                  id="ai_audit_report_view"
                >
                  <div className="flex items-center justify-between border-b border-border pb-2 mb-2">
                    <h4 className="text-xs font-sans font-bold text-amber-600 flex items-center gap-1.5 uppercase">
                      <Sparkles className="h-3.5 w-3.5" /> Gemini Security Audit
                    </h4>
                    <button onClick={() => setAiAuditReport(null)} className="text-muted-foreground hover:text-muted-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="prose prose-invert prose-xs text-muted-foreground font-sans text-xs space-y-2 whitespace-pre-line leading-relaxed">
                    {aiAuditReport}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* --- Interactive Signers Configuration / Signature Collector --- */}
          {safetyCheck.hasMultisig && (
            <div className="bg-card/95 border border-border p-5 rounded-2xl space-y-4" id="multisig_signer_collector">
              <div>
                <h3 className="text-sm font-semibold font-sans uppercase tracking-wider text-foreground mb-1 flex items-center gap-2">
                  <Users className="h-4 w-4 text-cyan-400" />
                  Multisig Signature Gathering
                </h3>
                <p className="text-[11px] text-muted-foreground">Account has high thresholds and signers. Merging balances requires signatures weightsum ≥ {safetyCheck.thresholdNeeded}.</p>
              </div>

              {/* Threshold indicator bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-muted-foreground">Signature Weight gathered:</span>
                  <span className={`font-bold ${safetyCheck.totalSignaturesWeight >= safetyCheck.thresholdNeeded ? "text-green-400" : "text-amber-600"}`}>
                    {safetyCheck.totalSignaturesWeight} / {safetyCheck.thresholdNeeded} Weight
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden border border-border flex">
                  {account.signers.map((s, idx) => {
                    const isSigned = s.key === account.accountId || cosignedKeys.includes(s.key);
                    const weightPct = (s.weight / Math.max(safetyCheck.thresholdNeeded, account.signers.length)) * 100;
                    return (
                      <div 
                        key={idx} 
                        style={{ width: `${weightPct}%` }}
                        className={`h-full border-r border-border last:border-0 transition-all ${isSigned ? "bg-green-500" : "bg-secondary"}`}
                        title={`${s.key.substring(0, 10)}... (weight: ${s.weight}) ${isSigned ? "[Gathered]" : "[Pending]"}`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Quick signer simulator clickable bubbles */}
              <div className="space-y-2 bg-card p-3 rounded-lg border border-border">
                <div className="text-[10px] uppercase text-muted-foreground font-bold font-sans">Required Signers List</div>
                {account.signers.map((s, sIdx) => {
                  const isPowerSigner = s.key === account.accountId;
                  const isGathered = isPowerSigner || cosignedKeys.includes(s.key);
                  return (
                    <div key={sIdx} className="flex justify-between items-center text-xs font-mono">
                      <span className="truncate w-40 text-muted-foreground" title={s.key}>
                        {isPowerSigner ? "⭐⭐ OWN KEY: " : "🔑 CO-KEY: "}{s.key.substring(0, 12)}...
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground font-bold bg-muted px-1.5 py-0.5 rounded text-[10px]">W: {s.weight}</span>
                        {!isPowerSigner && (
                          <button 
                            onClick={() => {
                              if (isGathered) {
                                setCosignedKeys(prev => prev.filter(k => k !== s.key));
                              } else {
                                setCosignedKeys(prev => [...prev, s.key]);
                              }
                            }}
                            className={`text-[10px] font-sans px-2 py-0.5 rounded transition font-bold ${isGathered ? "bg-green-500/20 text-green-400 border border-green-500/40" : "bg-muted text-muted-foreground border border-border hover:text-foreground"}`}
                          >
                            {isGathered ? "Unsign" : "Simulate Sign"}
                          </button>
                        )}
                        {isPowerSigner && <span className="text-green-500 text-[10px] uppercase font-bold">Primary</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* ================= RIGHT COLUMN: INTERACTIVE TABS & POSITION DRY-RUNS ================= */}
        <section className="col-span-1 lg:col-span-12 xl:col-span-7 space-y-8">
          
          {/* --- Interactive ledger tabs (Phase 1 Deep Dive & Action triggers) --- */}
          <div className="bg-card/95 border border-border rounded-3xl overflow-hidden shadow-xl" id="asset_ledger_viewer">
            
            {/* Header Tabs Navigation */}
            <div className="bg-muted/60 p-2 border-b border-border flex justify-between items-center flex-wrap gap-2">
              <div className="flex gap-1 overflow-x-auto max-w-full -mx-1 px-1 [&>button]:shrink-0 [&>button]:whitespace-nowrap">
                <button 
                  onClick={() => setActiveTab("balances")}
                  className={`text-xs px-3 py-2 rounded-xl transition ${activeTab === "balances" ? "bg-amber-500 text-black font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                  id="tab_balances"
                >
                  Balances ({account.trustlines.length})
                </button>
                <button 
                  onClick={() => setActiveTab("defi")}
                  className={`text-xs px-3 py-2 rounded-xl relative transition ${activeTab === "defi" ? "bg-amber-500 text-black font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                  id="tab_defi"
                >
                  DeFi Stake ({account.ammPositions.length + account.sorobanPositions.length})
                  {(account.ammPositions.length + account.sorobanPositions.length) > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                  )}
                </button>
                <button 
                  onClick={() => setActiveTab("claims")}
                  className={`text-xs px-3 py-2 rounded-xl transition ${activeTab === "claims" ? "bg-amber-500 text-black font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                  id="tab_claims"
                >
                  Claimables ({account.claimableBalances.length})
                </button>
                <button 
                  onClick={() => setActiveTab("access")}
                  className={`text-xs px-3 py-2 rounded-xl transition ${activeTab === "access" ? "bg-amber-500 text-black font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                  id="tab_access"
                >
                  Ledger Info ({account.dataEntries.length + account.signers.length})
                </button>
              </div>

              {explorerMode === "sandbox" && (
                <div className="text-[10px] text-muted-foreground bg-card border border-border px-2.5 py-1 rounded-lg">
                  💡 Sandbox: Simulates step-by-step liquidation
                </div>
              )}
            </div>

            {/* Tab 1 Body: BALANCES, TRUSTLINES, LIQUIDATE ACTIONS */}
            <div className="p-5 md:p-6 min-h-[280px]">
              {activeTab === "balances" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide font-mono">Stellar & Soroban Asset Trustlines</h4>
                    {explorerMode === "sandbox" && account.trustlines.some(t => parseFloat(t.balance) > 0) && (
                      <button 
                        onClick={simulateTokenLiquidation}
                        className="text-xs bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/30 text-amber-600 font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
                        id="liquidate_trustlines_btn"
                      >
                        <Coins className="h-3.5 w-3.5" />
                        Phase 4: Route Liquidation to XLM
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {/* Hardcoded XLM Base balance shown on top */}
                    <div className="bg-card/80 border border-border/60 p-4 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 text-amber-600 text-xs font-bold leading-none">XLM</div>
                        <div>
                          <div className="text-xs font-semibold text-foreground">Stellar Lumens (Native)</div>
                          <div className="text-[10px] font-mono text-muted-foreground mt-0.5">Asset ID: CLASSIC_NATIVE</div>
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-sm font-bold text-foreground">{account.xlmBalance.toFixed(2)} XLM</div>
                        <div className="text-[10px] text-muted-foreground">Unrestricted balance</div>
                      </div>
                    </div>

                    {account.trustlines.length === 0 ? (
                      <div className="bg-card/30 border border-dashed border-border text-center py-8 rounded-xl">
                        <Coins className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">No token trustlines detected on this account.</p>
                      </div>
                    ) : (
                      account.trustlines.map((t, idx) => (
                        <div key={idx} className="bg-card/80 border border-border p-4 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="bg-secondary/80 p-2.5 rounded-xl text-xs font-bold font-mono text-foreground leading-none">
                              {t.assetCode}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                {t.assetCode} Trustline
                                {t.isSoroban && (
                                  <span className="text-[10px] bg-purple-950/40 text-purple-400 border border-purple-900 px-1.5 py-0.1 rounded uppercase font-mono">Soroban SAC</span>
                                )}
                              </div>
                              <div className="text-[10px] font-mono text-muted-foreground max-w-[200px] md:max-w-xs truncate" title={t.assetIssuer}>
                                Issuer: {t.assetIssuer.substring(0, 8)}...{t.assetIssuer.substring(t.assetIssuer.length - 8)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right font-mono">
                            <div className={`text-sm font-bold ${parseFloat(t.balance) > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                              {t.balance} {t.assetCode}
                            </div>
                            <div className="text-[10px] text-muted-foreground">Limit: {t.limit || "Unrestricted"}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2 Body: DEFI POSITIONS (AMM, SOROSWAP, BLEND, AQUARIUS) */}
              {activeTab === "defi" && (
                <div className="space-y-6">
                  {/* Classical DEX Offers (Phase 3) */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide font-mono">Active Stellar DEX Offers</h4>
                      {explorerMode === "sandbox" && account.dexOffers.length > 0 && (
                        <button 
                          onClick={simulateCancelOffers}
                          className="text-xs bg-red-500/15 border border-red-500/30 hover:bg-red-500/30 text-red-300 font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1 transition"
                          id="cancel_dex_offers_btn"
                        >
                          <Trash2 className="h-3 w-3" />
                          Cancel DEX Offers
                        </button>
                      )}
                    </div>

                    {account.dexOffers.length === 0 ? (
                      <div className="bg-card/30 border border-dashed border-border text-center py-5 rounded-xl text-xs text-muted-foreground">
                        No active DEX Offers found on this ledger.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {account.dexOffers.map((o, idx) => (
                          <div key={idx} className="bg-card/80 border border-border p-3 rounded-xl flex flex-col justify-between">
                            <div className="flex justify-between items-center border-b border-border pb-1.5 mb-2">
                              <span className="font-mono text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-bold">OFFER #{o.id}</span>
                              <span className="text-[10px] uppercase px-1.5 py-0.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 font-bold font-mono">DEX</span>
                            </div>
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="text-muted-foreground">Selling:</span>
                              <span className="text-foreground font-semibold">{o.amount} {o.sellingCode}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs font-mono mt-1">
                              <span className="text-muted-foreground">Price Rate:</span>
                              <span className="text-cyan-400 font-semibold">{o.price} {o.buyingCode}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* AMM Positions & Liquidity pools (Phase 3) */}
                  <div className="space-y-3 pt-3 border-t border-border">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide font-mono">Classic AMM Positions</h4>
                      {explorerMode === "sandbox" && account.ammPositions.length > 0 && (
                        <button 
                          onClick={simulateWithdrawAMMs}
                          className="text-xs bg-red-500/15 border border-red-500/30 hover:bg-red-500/30 text-red-300 font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1 transition"
                          id="withdraw_amm_positions_btn"
                        >
                          <Trash2 className="h-3 w-3" />
                          Withdraw LP Shares
                        </button>
                      )}
                    </div>

                    {account.ammPositions.length === 0 ? (
                      <div className="bg-card/30 border border-dashed border-border text-center py-5 rounded-xl text-xs text-muted-foreground">
                        No active AMM liquidity pool stakes found on ledger.
                      </div>
                    ) : (
                      account.ammPositions.map((p, idx) => (
                        <div key={idx} className="bg-card/80 border border-border p-4 rounded-xl flex flex-col md:flex-row justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-foreground font-mono">{p.assetA}/{p.assetB} Pool Shares</span>
                              <span className="text-[10px] font-mono text-muted-foreground">Pool ID: {p.poolId}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              Underlying Assets Locked: <span className="text-foreground">{p.tokenAValue}</span> and <span className="text-foreground">{p.tokenBValue}</span>
                            </div>
                          </div>
                          <div className="text-right flex md:flex-col justify-between items-center md:items-end font-mono">
                            <div className="text-xs text-cyan-400 font-bold">{p.shares} LP Shares</div>
                            <div className="text-[10px] text-muted-foreground">Value of LP: ~{p.xlmValue} XLM</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Soroban DeFi positions (Phase 3) */}
                  <div className="space-y-3 pt-3 border-t border-border">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-semibold uppercase text-purple-400 tracking-wide font-mono flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5" />
                        Soroban DeFi Positions
                      </h4>
                      {explorerMode === "sandbox" && account.sorobanPositions.length > 0 && (
                        <button 
                          onClick={simulateExitSoroban}
                          className="text-xs bg-purple-500/15 border border-purple-500/30 hover:bg-purple-500/30 text-purple-300 font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1 transition"
                          id="exit_soroban_defi_btn"
                        >
                          <Orbit className="h-3 w-3" />
                          Deconstruct Smart Contracts
                        </button>
                      )}
                    </div>

                    {account.sorobanPositions.length === 0 ? (
                      <div className="bg-card/30 border border-dashed border-border text-center py-5 rounded-xl text-xs text-muted-foreground">
                        No active smart contract lending or platform farms detected.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {account.sorobanPositions.map((sp, idx) => (
                          <div key={idx} className="bg-card/80 border border-purple-500/10 p-3.5 rounded-xl flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="font-bold text-xs text-purple-400">{sp.protocol}</span>
                                <span className="text-[10px] uppercase px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded font-bold font-mono">{sp.type}</span>
                              </div>
                              <div className="text-xs text-muted-foreground font-mono mt-2">
                                <span className="text-muted-foreground">Supplied:</span> <span className="text-foreground font-bold">{sp.supplied} {sp.symbol}</span>
                              </div>
                              {parseFloat(sp.borrowed) > 0 && (
                                <div className="text-xs text-red-400 font-mono">
                                  <span className="text-muted-foreground">Borrowed:</span> <span>{sp.borrowed} {sp.symbol}</span>
                                </div>
                              )}
                              <div className="text-[11px] text-green-400 font-mono mt-1">
                                <span className="text-muted-foreground">Yield rewards:</span> <span>+{sp.rewardEarned}</span>
                              </div>
                            </div>
                            <div className="border-t border-purple-505/20 pt-2 mt-2 flex justify-between items-center text-[10px] font-mono text-muted-foreground">
                              <span>Collateral:</span>
                              <span className={sp.collateralized ? "text-green-400" : "text-muted-foreground"}>{sp.collateralized ? "ACTIVE" : "NONE"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3 Body: CLAIMABLE BALANCES AND RECLAIM FLIGHT */}
              {activeTab === "claims" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide font-mono">Pending Claimable Balances</h4>
                    {explorerMode === "sandbox" && account.claimableBalances.length > 0 && (
                      <button 
                        onClick={simulateRecoverClaims}
                        className="text-xs bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/30 text-amber-600 font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1 transition"
                        id="recover_claims_btn"
                      >
                        <Coins className="h-3.5 w-3.5" />
                        Recover Claims
                      </button>
                    )}
                  </div>

                  {account.claimableBalances.length === 0 ? (
                    <div className="bg-card/30 border border-dashed border-border text-center py-8 rounded-xl text-xs text-muted-foreground">
                      No unclaimed envelopes on ledger for this account ID.
                    </div>
                  ) : (
                    account.claimableBalances.map((cb, idx) => (
                      <div key={idx} className="bg-card/80 border border-border p-4 rounded-xl flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="text-xs font-bold font-mono text-foreground">Pending Sweep: {cb.amount} {cb.assetCode}</div>
                          <div className="text-[10px] font-mono text-muted-foreground max-w-sm truncate">ID: {cb.id}</div>
                        </div>
                        <div className="text-right font-mono text-[10px] text-muted-foreground">
                          <span>Sponsor Address:</span>
                          <div className="text-foreground font-semibold transition">{cb.sponsor}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 4 Body: LEDGER INFO / DATA ENTRIES / SIGNERS */}
              {activeTab === "access" && (
                <div className="space-y-5">
                  {/* Data entries */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide font-mono">Storage Ledger Data Entries</h4>
                    {account.dataEntries.length === 0 ? (
                      <div className="bg-card/30 border border-dashed border-border text-center py-5 rounded-xl text-xs text-muted-foreground">
                        No custom string data entries found on the ledger.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {account.dataEntries.map((d, dIdx) => (
                          <div key={dIdx} className="bg-card/80 border border-border p-3 rounded-lg flex justify-between items-center font-mono text-xs">
                            <span className="text-muted-foreground">{d.key}</span>
                            <span className="text-cyan-400 font-bold select-all bg-card px-2 py-0.5 rounded">{d.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Allowances/Approvals */}
                  <div className="space-y-3 pt-3 border-t border-border">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide font-mono">Smart Token Clearances & Approvals</h4>
                    {account.allowances.length === 0 ? (
                      <div className="bg-card/30 border border-dashed border-border text-center py-5 rounded-xl text-xs text-muted-foreground">
                        No authorized third-party spender clearances or smart allowances active.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {account.allowances.map((al, aIdx) => (
                          <div key={aIdx} className="bg-card/80 border border-border p-3 rounded-lg flex items-center justify-between font-mono text-xs">
                            <div>
                              <div className="text-foreground text-xs font-bold">{al.tokenCode} Allowance</div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">Spender address: {al.spender}</div>
                            </div>
                            <span className="text-red-400 font-bold text-xs">{al.amount}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* --- Exchange Transfer Problem Section (Phase 7) --- */}
          <div className="bg-card/95 border border-border p-6 rounded-3xl space-y-4" id="relay_mediator_section">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-semibold font-sans uppercase tracking-wider text-amber-600 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  Phase 7: Resolve Exchange Transfer Deficit
                </h3>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  Most modern spot exchanges (Coinbase, Binance, Kraken) do <b>NOT</b> detect or credit standard <code>ACCOUNT_MERGE</code> ledger endpoints, meaning funds merged directly will be lost forever in their omnibus addresses.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Deploy Mediator:</span>
                <button 
                  onClick={() => setUseMediator(prev => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${useMediator ? "bg-amber-500" : "bg-secondary"}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${useMediator ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {useMediator ? (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                  id="mediator_diagram"
                >
                  {/* Schematic Flow Chart */}
                  <div className="bg-card p-4 rounded-xl border border-border grid grid-cols-1 md:grid-cols-5 items-center justify-center text-center gap-1">
                    <div className="p-2 border border-border bg-card rounded-lg">
                      <div className="text-[10px] text-red-400 font-bold font-mono">YOUR DECAYING WALLET</div>
                      <div className="text-[11px] truncate mt-1 text-foreground">{account.accountId.substring(0, 10)}...</div>
                    </div>
                    <div className="text-muted-foreground font-bold flex justify-center text-center py-1 md:py-0">
                      <ChevronRight className="h-5 w-5 rotate-90 md:rotate-0" />
                    </div>
                    <div className="p-2 border border-amber-500/30 bg-amber-500/5 rounded-lg">
                      <div className="text-[10px] text-amber-600 font-bold font-mono">TEMPORARY MEDIATOR</div>
                      <div className="text-[11px] text-foreground font-mono mt-1">Staged Proxy Contract</div>
                    </div>
                    <div className="text-muted-foreground font-bold flex justify-center text-center py-1 md:py-0">
                      <ChevronRight className="h-5 w-5 rotate-90 md:rotate-0" />
                    </div>
                    <div className="p-2 border border-green-500/20 bg-card rounded-lg">
                      <div className="text-[10px] text-green-400 font-bold font-mono">EXCHANGE DESK</div>
                      <div className="text-[11px] text-foreground mt-1">With strict MEMO tag</div>
                    </div>
                  </div>

                  {/* Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase text-muted-foreground font-bold font-mono block">Exchange Deposit Public Key</label>
                      <input 
                        type="text" 
                        value={exchangeDepositAddress}
                        onChange={(e) => setExchangeDepositAddress(e.target.value)}
                        className="w-full text-xs font-mono bg-card border border-border rounded-lg px-3 py-2 text-foreground h-9 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] uppercase text-muted-foreground font-bold font-mono block">Exchange Payment MEMO (Required)</label>
                        <span className="text-[10px] text-red-500 font-bold">MUTISIG REQUIRED</span>
                      </div>
                      <input 
                        type="text" 
                        value={exchangeMemo}
                        onChange={(e) => setExchangeMemo(e.target.value)}
                        className="w-full text-xs font-mono bg-card border border-border rounded-lg px-3 py-2 text-foreground h-9 focus:outline-none"
                      />
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden bg-red-955/20 border border-red-500/10 p-4 rounded-xl"
                  id="direct_merge_details"
                >
                  <label className="text-[10px] uppercase text-muted-foreground font-bold font-mono block">Direct Stellar Wallet Recipient (Strict Non-Exchange URL)</label>
                  <input 
                    type="text" 
                    value={targetMergeAddress}
                    onChange={(e) => setTargetMergeAddress(e.target.value)}
                    placeholder="G..." 
                    className="w-full text-xs font-mono bg-card border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none"
                  />
                  <div className="text-[11px] text-red-400 flex items-start gap-1.5 mt-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                    <span><b>CRITICAL RISK STATEMENT</b>: Direct merger into Coinbase/Kraken/Binance without mediator routing will permanently isolate your liquidated XLM tokens without credentials. Ensure the target is a custom custodial vault or self-hosted hardware key.</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* --- Bottom interactive dry-run inspector / json builder & demolish final --- */}
          <div className="bg-card/95 border border-border rounded-3xl overflow-hidden shadow-xl" id="comp_terminal">
            <div className="bg-muted/60 px-5 py-3 border-b border-border flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                <h3 className="text-xs font-semibold uppercase font-mono tracking-wider text-foreground">Terminal Command Compiler</h3>
              </div>
              <button 
                onClick={compileDryRun}
                className="text-xs bg-card hover:bg-secondary text-foreground font-mono border border-border px-3 py-1.5 rounded-xl transition flex items-center gap-1"
                id="dry_run_btn"
              >
                <Eye className="h-3.5 w-3.5" /> Compiler Dry Run Options
              </button>
            </div>

            {/* Dry Run Detail Expandable Drawer */}
            <AnimatePresence>
              {showDryRun && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-card border-b border-border overflow-hidden"
                  id="dry_run_view_container"
                >
                  <div className="p-5 space-y-4">
                    <div className="flex justify-between items-center border-b border-border pb-2">
                      <div className="text-xs uppercase font-bold text-amber-600 font-sans flex items-center gap-1.5">
                        <Activity className="h-4 w-4" /> Proposed Stellar Demolition Ledger Steps ({dryRunReport.length})
                      </div>
                      <button onClick={() => setShowDryRun(false)} className="text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-2 font-mono text-xs text-muted-foreground">
                      {dryRunReport.map((dr, oIdx) => (
                        <div key={oIdx} className="bg-muted border border-border px-3 py-2 rounded flex flex-col md:flex-row md:items-center justify-between gap-1.5">
                          <div>
                            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{dr.phase}</span>
                            <div className="text-foreground font-bold text-xs mt-0.5">{dr.action}</div>
                            <div className="text-cyan-400 text-[10px] mt-0.5 select-all">{dr.operation}</div>
                          </div>
                          <span className="text-[10px] font-sans font-bold text-green-300 bg-green-950/40 border border-green-900/50 px-2 py-0.5 rounded-full shrink-0">
                            {dr.refund}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Demolition Terminal Console Live Stream Logs */}
            <div className="p-4 bg-background/90 font-mono text-xs text-green-400 min-h-[140px] max-h-[220px] overflow-y-auto space-y-1 select-text border-b border-border">
              {demolitionLogs.length === 0 ? (
                <div className="text-muted-foreground flex flex-col items-center justify-center py-8">
                  <Play className="h-5 w-5 mb-2 animate-bounce" />
                  <div>READY TO INGEST SIGNATURES & DESTRUCT KEYSETS</div>
                  <div className="text-[10px] mt-1 text-muted-foreground">Proposed operations will execute sequentially with cryptographic verification.</div>
                </div>
              ) : (
                demolitionLogs.map((log, lIdx) => (
                  <div key={lIdx} className="leading-relaxed">
                    {log}
                  </div>
                ))
              )}
            </div>

            {/* Demolition Confirmation Sliders and warning flags (Phase 8) */}
            <div className="p-5 md:p-6 bg-muted/30 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1 max-w-md">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-red-500 animate-bounce" /> Warning: Action is Irreversible!
                  </h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Account Demolition performs a total Stellar transaction sweep that permanently collapses trustlines and executes <code>ACCOUNT_MERGE</code>. Private key access to this address will have no authority on the network.
                  </p>
                </div>

                {/* Safety Input confirmations */}
                {!demolitionComplete && (
                  <div className="w-full md:w-auto flex flex-col md:flex-row gap-2">
                    <div className="space-y-1 text-left">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Type &quot;DEMOLISH&quot; to authorize:</div>
                      <input 
                        type="text" 
                        value={confirmInput}
                        onChange={(e) => setConfirmInput(e.target.value)}
                        placeholder="INPUT ACTION PHRASE"
                        disabled={!safetyCheck.canDemolish || isDemolishing}
                        className="w-full text-center text-xs font-bold uppercase tracking-wider bg-card border border-red-500/20 rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground h-10 focus:outline-none focus:border-red-500 transition disabled:opacity-40"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Slider Pull-to-rugged confirm slider */}
              {!demolitionComplete ? (
                <div 
                  ref={sliderRef}
                  className={`relative w-full h-12 bg-card border border-border rounded-xl overflow-hidden flex items-center justify-center transition-all ${!safetyCheck.canDemolish ? "opacity-40 cursor-not-allowed" : "cursor-grab active:cursor-grabbing"}`}
                  onMouseMove={handleSliderDrag}
                  onTouchMove={handleSliderDrag}
                  onMouseUp={handleSliderEnd}
                  onTouchEnd={handleSliderEnd}
                  onMouseLeave={handleSliderEnd}
                  id="demolition_glowing_slider"
                >
                  {/* Glowing Slider Backdrop */}
                  <div 
                    style={{ width: `${sliderPosition}%` }}
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-red-600 to-amber-500 opacity-25 transition-all duration-75"
                  />
                  
                  {/* Pull Node handle */}
                  <div 
                    style={{ left: `calc(${sliderPosition}% - 24px)` }}
                    className="absolute top-1 bottom-1 w-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg flex items-center justify-center text-foreground border border-red-400 select-none transition-all duration-75 h-10"
                    id="slider_drag_node"
                  >
                    <Orbit className="h-5 w-5 animate-pulse" />
                  </div>

                  {/* text hints */}
                  <span className="text-xs uppercase font-extrabold tracking-widest text-red-400 select-none pointer-events-none z-10" id="slider_text_instruction">
                    {isDemolishing 
                      ? "EXECUTING SYSTEM WIPES..." 
                      : !safetyCheck.canDemolish 
                      ? "Resolve Safety Blockers First" 
                      : confirmInput.toLowerCase() !== "demolish"
                      ? "Type 'DEMOLISH' to Unlock Trigger"
                      : `SWIPE SLIDER TO COMMENCE DEMOLITION (${sliderPosition}%)`
                    }
                  </span>
                </div>
              ) : (
                <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-xl flex items-center justify-between" id="demolition_success_banner">
                  <div className="flex items-center gap-3">
                    <Check className="h-6 w-6 text-green-400 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-green-300 uppercase tracking-wide">Wallet Merger & Demolition Succeeded!</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Account merged and reserves successfully liquidated to destination endpoint. Ledger state terminated.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setAccount(JSON.parse(JSON.stringify(scenarios[selectedScenarioKey])));
                      setDemolitionComplete(false);
                      setConfirmInput("");
                      setSliderPosition(0);
                      setDemolitionLogs([]);
                    }}
                    className="text-xs bg-muted border border-border hover:text-foreground px-3 py-1.5 rounded-xl font-sans"
                  >
                    Reset Scenario Simulator
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* --- Helper modal: Stellar merge rules and compliance check list (Phase 1 to 8) --- */}
      {showHelperModal && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm" id="rules_modal_overlay">
          <div className="bg-card border border-border max-w-2xl w-full p-6 md:p-8 rounded-3xl space-y-6 relative max-h-[85vh] overflow-y-auto" id="rules_modal_body">
            <button 
              onClick={() => setShowHelperModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition"
            >
              <X className="h-5 w-5" />
            </button>
            
            <div className="flex items-center gap-3">
              <Orbit className="h-6 w-6 text-amber-600" />
              <h2 className="text-lg font-bold text-foreground uppercase tracking-wider">Stellar Account Merger Demolition Checklist</h2>
            </div>
            
            <p className="text-xs text-muted-foreground leading-relaxed">
              We engineered this product according to Stellar Core protocol standards. The demolition sequencer strictly executes the following phases client-side for absolute security:
            </p>

            <ul className="space-y-3.5 font-mono text-xs text-muted-foreground">
              <li className="flex gap-2 items-start bg-card p-3 rounded-lg border border-border">
                <span className="text-amber-600 shrink-0">[Phase 1]</span>
                <span><b>Account Discovery</b>: Deep-scrapes network validators for trustlines, data elements, sponsorships, claims, and Soroban DeFi positions.</span>
              </li>
              <li className="flex gap-2 items-start bg-card p-3 rounded-lg border border-border">
                <span className="text-amber-600 shrink-0">[Phase 2]</span>
                <span><b>Safety Analysis Check</b>: Blockers identify if account is sponsoring others or has multiple active key thresholds needing cosigns.</span>
              </li>
              <li className="flex gap-2 items-start bg-card p-3 rounded-lg border border-border">
                <span className="text-amber-600 shrink-0">[Phase 3]</span>
                <span><b>Position Cleanup</b>: Cancel Classic DEX offers, exit LP Pools, and exit DeFi smart-contracts (Blend supplies, Soroswap pools, Aquarius farming).</span>
              </li>
              <li className="flex gap-2 items-start bg-card p-3 rounded-lg border border-border">
                <span className="text-amber-600 shrink-0">[Phase 4]</span>
                <span><b>Path-Payment Liquidation</b>: Routing remaining token balances straight into native XLM utilizing the best liquidity paths.</span>
              </li>
              <li className="flex gap-2 items-start bg-card p-3 rounded-lg border border-border">
                <span className="text-amber-600 shrink-0">[Phase 5]</span>
                <span><b>Pruning Cleanup</b>: Revoking all signers to 0 weight, deleting custom data registries (ManageData), and erasing empty trustlines (limit 0).</span>
              </li>
              <li className="flex gap-2 items-start bg-card p-3 rounded-lg border border-border">
                <span className="text-amber-600 shrink-0">[Phase 6]</span>
                <span><b>Claim Recovery</b>: Automatically sweeping any claimable balance wrappers into active balance buffers prior to demolition.</span>
              </li>
              <li className="flex gap-2 items-start bg-card p-3 rounded-lg border border-border">
                <span className="text-amber-600 shrink-0">[Phase 7]</span>
                <span><b>Temporary Mediator Relayer</b>: Injects an active payment-relay with exchange-compatible memos to prevent merged fund loss.</span>
              </li>
              <li className="flex gap-2 items-start bg-card p-3 rounded-lg border border-border">
                <span className="text-amber-600 shrink-0">[Phase 8]</span>
                <span><b>Final Account Demolition</b>: Issues the terminal <code>ACCOUNT_MERGE</code> operation, retrieving active base reserve funds.</span>
              </li>
            </ul>

            <button 
              onClick={() => setShowHelperModal(false)}
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-xl py-3 text-xs uppercase"
            >
              Acknowledge and Proceed
            </button>
          </div>
        </div>
      )}

      {/* --- Footer Signature Segment --- */}
      <footer className="border-t border-border mt-12 pt-6 flex flex-col md:flex-row items-center justify-between text-xs text-muted-foreground gap-4" id="tool_footer">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <span>Secured client-side via Stellar Seed cryptos. All calculations fully testable under simulated conditions.</span>
        </div>
        <div className="flex gap-4">
          <a href="#" onClick={(e) => { e.preventDefault(); setShowHelperModal(true); }} className="hover:text-muted-foreground transition">Protocol Documentation</a>
          <span className="text-muted-foreground">|</span>
          <span>Status: Horizon Services Active</span>
        </div>
      </footer>
    </div>
  );
}
