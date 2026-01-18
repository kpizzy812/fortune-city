// Solana Wallet types
interface SolanaWallet {
  isPhantom?: boolean;
  publicKey?: {
    toString(): string;
  };
  connect(options?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  signMessage?(message: Uint8Array): Promise<{ signature: Uint8Array }>;
}

declare global {
  interface Window {
    solana?: SolanaWallet;
    phantom?: {
      solana?: SolanaWallet;
    };
    braveSolana?: SolanaWallet;
  }
}

export {};
