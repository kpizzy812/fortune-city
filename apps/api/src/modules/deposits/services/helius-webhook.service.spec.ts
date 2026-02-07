import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HeliusWebhookService } from './helius-webhook.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SOLANA_TOKENS } from '../constants/tokens';

describe('HeliusWebhookService', () => {
  let service: HeliusWebhookService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HeliusWebhookService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config: Record<string, string> = {
                HELIUS_API_KEY: 'test-key',
                HELIUS_WEBHOOK_SECRET: 'test-secret',
                API_URL: 'https://api.test.com',
                SOLANA_HOT_WALLET: 'HotWallet111111111111111111111111111111111',
                FORTUNE_MINT_ADDRESS:
                  'FortuneMint1111111111111111111111111111111',
              };
              return config[key] || null;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            depositAddress: {
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        },
      ],
    }).compile();

    service = module.get<HeliusWebhookService>(HeliusWebhookService);
    configService = module.get(ConfigService);

    jest.clearAllMocks();
  });

  describe('isConfigured', () => {
    it('should return false before init', () => {
      // Before onModuleInit, apiKey is not set yet
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('validateAuthHeader', () => {
    it('should return false before init (no webhookSecret)', () => {
      expect(service.validateAuthHeader('Bearer test-secret')).toBe(false);
    });
  });

  describe('isOurAddress', () => {
    it('should return false for unknown address', () => {
      expect(service.isOurAddress('unknown-addr')).toBe(false);
    });
  });

  describe('getCurrencyFromMint', () => {
    it('should return USDT_SOL for USDT mint', async () => {
      // Init service to load config
      await service.onModuleInit();

      const result = service.getCurrencyFromMint(SOLANA_TOKENS.USDT.mint);
      expect(result).toBe('USDT_SOL');
    });

    it('should return FORTUNE for fortune mint', async () => {
      await service.onModuleInit();

      const result = service.getCurrencyFromMint(
        'FortuneMint1111111111111111111111111111111',
      );
      expect(result).toBe('FORTUNE');
    });

    it('should return null for unknown mint', async () => {
      await service.onModuleInit();

      const result = service.getCurrencyFromMint('unknown-mint');
      expect(result).toBeNull();
    });
  });

  describe('parseWebhookPayload', () => {
    it('should parse SOL native transfer', async () => {
      await service.onModuleInit();

      const payload = [
        {
          signature: 'sig-1',
          slot: 12345,
          nativeTransfers: [
            {
              fromUserAccount: 'sender-1',
              toUserAccount: 'HotWallet111111111111111111111111111111111',
              amount: 1_000_000_000, // 1 SOL in lamports
            },
          ],
          tokenTransfers: [],
        },
      ];

      const deposits = service.parseWebhookPayload(payload as any);

      expect(deposits).toHaveLength(1);
      expect(deposits[0].currency).toBe('SOL');
      expect(deposits[0].amount).toBe(1);
      expect(deposits[0].signature).toBe('sig-1');
    });

    it('should parse SPL token transfer (USDT)', async () => {
      await service.onModuleInit();

      const payload = [
        {
          signature: 'sig-2',
          slot: 12346,
          nativeTransfers: [],
          tokenTransfers: [
            {
              fromUserAccount: 'sender-1',
              toUserAccount: 'HotWallet111111111111111111111111111111111',
              mint: SOLANA_TOKENS.USDT.mint,
              tokenAmount: 50,
            },
          ],
        },
      ];

      const deposits = service.parseWebhookPayload(payload as any);

      expect(deposits).toHaveLength(1);
      expect(deposits[0].currency).toBe('USDT_SOL');
      expect(deposits[0].amount).toBe(50);
    });

    it('should ignore transfers to unknown addresses', async () => {
      await service.onModuleInit();

      const payload = [
        {
          signature: 'sig-3',
          slot: 12347,
          nativeTransfers: [
            {
              fromUserAccount: 'sender-1',
              toUserAccount: 'unknown-address',
              amount: 1_000_000_000,
            },
          ],
          tokenTransfers: [],
        },
      ];

      const deposits = service.parseWebhookPayload(payload as any);

      expect(deposits).toHaveLength(0);
    });

    it('should handle empty payload', async () => {
      await service.onModuleInit();

      const deposits = service.parseWebhookPayload([] as any);

      expect(deposits).toHaveLength(0);
    });
  });

  describe('onModuleInit', () => {
    it('should load hot wallet and deposit addresses', async () => {
      await service.onModuleInit();

      expect(service.isConfigured()).toBe(true);
      expect(
        service.isOurAddress('HotWallet111111111111111111111111111111111'),
      ).toBe(true);
    });
  });
});
