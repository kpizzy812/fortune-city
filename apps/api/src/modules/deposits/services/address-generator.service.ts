import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Keypair } from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';

@Injectable()
export class AddressGeneratorService implements OnModuleInit {
  private readonly logger = new Logger(AddressGeneratorService.name);
  private masterSeed: Buffer | null = null;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const seedHex = this.config.get<string>('SOLANA_MASTER_SEED');
    if (seedHex) {
      this.masterSeed = Buffer.from(seedHex, 'hex');
      this.logger.log('Master seed loaded for HD wallet derivation');
    } else {
      this.logger.warn(
        'SOLANA_MASTER_SEED not configured - deposit address generation disabled',
      );
    }
  }

  /**
   * Check if HD wallet is configured
   */
  isConfigured(): boolean {
    return this.masterSeed !== null;
  }

  /**
   * Generate unique Solana address for a user
   * Derivation path: m/44'/501'/0'/{derivationIndex}'
   *
   * BIP44 standard:
   * - 44' = BIP44 purpose
   * - 501' = Solana coin type
   * - 0' = account
   * - derivationIndex' = address index
   */
  generateDepositAddress(derivationIndex: number): {
    publicKey: string;
    secretKey: Uint8Array;
  } {
    if (!this.masterSeed) {
      throw new Error('Master seed not configured');
    }

    const path = `m/44'/501'/0'/${derivationIndex}'`;
    const derived = derivePath(path, this.masterSeed.toString('hex'));
    const keypair = Keypair.fromSeed(derived.key);

    return {
      publicKey: keypair.publicKey.toBase58(),
      secretKey: keypair.secretKey,
    };
  }

  /**
   * Recover keypair from derivation index
   * Used for sweep operations
   */
  getKeypair(derivationIndex: number): Keypair {
    const { secretKey } = this.generateDepositAddress(derivationIndex);
    return Keypair.fromSecretKey(secretKey);
  }

  /**
   * Validate that a keypair matches expected address
   * Used to verify integrity
   */
  validateAddress(derivationIndex: number, expectedAddress: string): boolean {
    try {
      const { publicKey } = this.generateDepositAddress(derivationIndex);
      return publicKey === expectedAddress;
    } catch {
      return false;
    }
  }
}
