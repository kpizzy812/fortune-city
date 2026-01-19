// Other Crypto (BEP20/TON) Constants for manual deposits

export enum OtherCryptoNetwork {
  BEP20 = 'BEP20',
  TON = 'TON',
}

export enum OtherCryptoToken {
  USDT = 'USDT',
  BNB = 'BNB',
  TON = 'TON',
}

export const OTHER_CRYPTO_CONFIG: Record<
  OtherCryptoNetwork,
  {
    tokens: OtherCryptoToken[];
    minAmounts: Record<string, number>;
    blockExplorerTx: string;
    blockExplorerAddress: string;
  }
> = {
  BEP20: {
    tokens: [OtherCryptoToken.USDT, OtherCryptoToken.BNB],
    minAmounts: {
      USDT: 1, // $1 USDT
      BNB: 0.002, // ~$1 BNB (approx at $500/BNB)
    },
    blockExplorerTx: 'https://bscscan.com/tx/',
    blockExplorerAddress: 'https://bscscan.com/address/',
  },
  TON: {
    tokens: [OtherCryptoToken.USDT, OtherCryptoToken.TON],
    minAmounts: {
      USDT: 1, // $1 USDT
      TON: 0.5, // ~$1 TON (approx at $2/TON)
    },
    blockExplorerTx: 'https://tonscan.org/tx/',
    blockExplorerAddress: 'https://tonscan.org/address/',
  },
};

// Maximum pending other_crypto deposits per user
export const MAX_PENDING_OTHER_CRYPTO_DEPOSITS = 3;

// Estimated processing time (in hours)
export const OTHER_CRYPTO_PROCESSING_TIME = 24;
