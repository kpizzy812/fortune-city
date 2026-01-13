// Solana Token Constants
// NOTE: Actual mint addresses are loaded from .env via ConfigService
// These are just type definitions and decimals

export const SOLANA_TOKENS = {
  // Native SOL
  SOL: {
    symbol: 'SOL',
    decimals: 9,
  },

  // USDT SPL Token (Mainnet) - fixed address
  USDT: {
    symbol: 'USDT',
    decimals: 6,
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  },

  // FORTUNE SPL Token
  // Mint: process.env.FORTUNE_MINT_ADDRESS
  FORTUNE: {
    symbol: 'FORTUNE',
    decimals: 9,
  },
} as const;

export const LAMPORTS_PER_SOL = 1_000_000_000;

// Minimum amounts for deposits (in native units)
export const MIN_DEPOSIT = {
  SOL: 0.01, // 0.01 SOL
  USDT_SOL: 1, // 1 USDT
  FORTUNE: 10, // 10 FORTUNE
} as const;

// Sweep thresholds
export const SWEEP_THRESHOLDS = {
  SOL: 0.01 * LAMPORTS_PER_SOL, // 0.01 SOL in lamports
  TOKEN: 1, // 1 token (USDT or FORTUNE)
} as const;

// Gas requirements
export const GAS_REQUIREMENTS = {
  MIN_SOL_FOR_GAS: 0.002 * LAMPORTS_PER_SOL, // 0.002 SOL for token transfers
  RENT_EXEMPT_MIN: 0.00089088 * LAMPORTS_PER_SOL, // ~890k lamports
} as const;

// Get mint address by currency
// NOTE: Use ConfigService in services to get actual mint addresses from env
// This helper is for cases where you already have the mint addresses
export function getMintByCurrency(
  currency: 'SOL' | 'USDT_SOL' | 'FORTUNE',
  usdtMint: string,
  fortuneMint: string,
): string | null {
  switch (currency) {
    case 'SOL':
      return null;
    case 'USDT_SOL':
      return usdtMint;
    case 'FORTUNE':
      return fortuneMint;
    default:
      return null;
  }
}

// Get decimals by currency
export function getDecimalsByCurrency(
  currency: 'SOL' | 'USDT_SOL' | 'FORTUNE',
): number {
  switch (currency) {
    case 'SOL':
      return SOLANA_TOKENS.SOL.decimals;
    case 'USDT_SOL':
      return SOLANA_TOKENS.USDT.decimals;
    case 'FORTUNE':
      return SOLANA_TOKENS.FORTUNE.decimals;
    default:
      return 9;
  }
}
