import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DepositsService } from './deposits.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddressGeneratorService } from './services/address-generator.service';
import { HeliusWebhookService } from './services/helius-webhook.service';
import { DepositProcessorService } from './services/deposit-processor.service';
import { PriceOracleService } from './services/price-oracle.service';

// Mock nanoid
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'mock-nanoid-12345'),
}));

// Mock qrcode
jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,QRCODE'),
}));

describe('DepositsService', () => {
  let service: DepositsService;
  let prisma: jest.Mocked<PrismaService>;
  let configService: jest.Mocked<ConfigService>;
  let addressGenerator: jest.Mocked<AddressGeneratorService>;
  let heliusWebhook: jest.Mocked<HeliusWebhookService>;
  let depositProcessor: jest.Mocked<DepositProcessorService>;
  let priceOracle: jest.Mocked<PriceOracleService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepositsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config: Record<string, string> = {
                SOLANA_HOT_WALLET: 'HotWallet111',
                OTHER_CRYPTO_BEP20_ADDRESS: '0xBep20Address',
                OTHER_CRYPTO_TON_ADDRESS: 'TonAddress123',
              };
              return config[key] || null;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            walletConnection: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              upsert: jest.fn(),
            },
            deposit: {
              create: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            depositAddress: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: AddressGeneratorService,
          useValue: {
            isConfigured: jest.fn().mockReturnValue(true),
            generateDepositAddress: jest.fn(),
          },
        },
        {
          provide: HeliusWebhookService,
          useValue: {
            isConfigured: jest.fn().mockReturnValue(true),
            parseWebhookPayload: jest.fn(),
            registerAddress: jest.fn(),
          },
        },
        {
          provide: DepositProcessorService,
          useValue: {
            depositExists: jest.fn(),
            processConfirmedDeposit: jest.fn(),
          },
        },
        {
          provide: PriceOracleService,
          useValue: {
            getRates: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DepositsService>(DepositsService);
    prisma = module.get(PrismaService);
    configService = module.get(ConfigService);
    addressGenerator = module.get(AddressGeneratorService);
    heliusWebhook = module.get(HeliusWebhookService);
    depositProcessor = module.get(DepositProcessorService);
    priceOracle = module.get(PriceOracleService);

    jest.clearAllMocks();
  });

  // ============== WALLET CONNECT ==============

  describe('connectWallet', () => {
    it('should throw ConflictException if wallet belongs to another user', async () => {
      (prisma.walletConnection.findUnique as jest.Mock).mockResolvedValue({
        userId: 'other-user',
        walletAddress: 'wallet-1',
        chain: 'solana',
      });

      await expect(service.connectWallet('user-1', 'wallet-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should upsert wallet connection for same user', async () => {
      (prisma.walletConnection.findUnique as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        walletAddress: 'wallet-1',
        chain: 'solana',
      });
      (prisma.walletConnection.upsert as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        walletAddress: 'wallet-1',
      });

      const result = await service.connectWallet('user-1', 'wallet-1');

      expect(result.walletAddress).toBe('wallet-1');
      expect(prisma.walletConnection.upsert).toHaveBeenCalledWith({
        where: { userId_chain: { userId: 'user-1', chain: 'solana' } },
        update: expect.objectContaining({ walletAddress: 'wallet-1' }),
        create: expect.objectContaining({
          userId: 'user-1',
          walletAddress: 'wallet-1',
        }),
      });
    });

    it('should create new connection for new wallet', async () => {
      (prisma.walletConnection.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.walletConnection.upsert as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        walletAddress: 'wallet-new',
      });

      const result = await service.connectWallet('user-1', 'wallet-new');

      expect(result.walletAddress).toBe('wallet-new');
    });
  });

  describe('getConnectedWallet', () => {
    it('should return wallet connection', async () => {
      const mockWallet = {
        userId: 'user-1',
        walletAddress: 'wallet-1',
        chain: 'solana',
      };
      (prisma.walletConnection.findUnique as jest.Mock).mockResolvedValue(
        mockWallet,
      );

      const result = await service.getConnectedWallet('user-1');

      expect(result).toEqual(mockWallet);
    });

    it('should return null if no wallet connected', async () => {
      (prisma.walletConnection.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getConnectedWallet('user-1');

      expect(result).toBeNull();
    });
  });

  // ============== WALLET DEPOSIT ==============

  describe('initiateWalletDeposit', () => {
    it('should throw if amount below minimum', async () => {
      // SOL min is 0.01
      await expect(
        service.initiateWalletDeposit('user-1', {
          currency: 'SOL',
          amount: 0.001,
          walletAddress: 'wallet-1',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if hot wallet not configured', async () => {
      (configService.get as jest.Mock).mockReturnValue(null);
      // connectWallet needs to not throw first
      (prisma.walletConnection.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.initiateWalletDeposit('user-1', {
          currency: 'SOL',
          amount: 1,
          walletAddress: 'wallet-1',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create pending deposit and return info', async () => {
      (prisma.walletConnection.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.walletConnection.upsert as jest.Mock).mockResolvedValue({});
      (prisma.deposit.create as jest.Mock).mockResolvedValue({
        id: 'dep-1',
        currency: 'SOL',
        amount: 1,
        memo: 'mock-nanoid-12345',
      });

      const result = await service.initiateWalletDeposit('user-1', {
        currency: 'SOL',
        amount: 1,
        walletAddress: 'wallet-1',
      } as any);

      expect(result.depositId).toBe('dep-1');
      expect(result.recipientAddress).toBe('HotWallet111');
      expect(result.amount).toBe(1);
      expect(result.currency).toBe('SOL');
    });
  });

  describe('confirmWalletDeposit', () => {
    it('should throw if no pending deposit found', async () => {
      (prisma.deposit.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.confirmWalletDeposit('user-1', 'dep-1', 'sig-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException on duplicate signature', async () => {
      (prisma.deposit.findFirst as jest.Mock).mockResolvedValue({
        id: 'dep-1',
        userId: 'user-1',
        status: 'pending',
      });
      (prisma.deposit.findUnique as jest.Mock).mockResolvedValue({
        id: 'dep-other',
        txSignature: 'sig-1',
      });

      await expect(
        service.confirmWalletDeposit('user-1', 'dep-1', 'sig-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should update deposit with real signature', async () => {
      (prisma.deposit.findFirst as jest.Mock).mockResolvedValue({
        id: 'dep-1',
        userId: 'user-1',
        status: 'pending',
      });
      (prisma.deposit.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.deposit.update as jest.Mock).mockResolvedValue({
        id: 'dep-1',
        txSignature: 'real-sig',
      });

      const result = await service.confirmWalletDeposit(
        'user-1',
        'dep-1',
        'real-sig',
      );

      expect(result.txSignature).toBe('real-sig');
      expect(prisma.deposit.update).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
        data: { txSignature: 'real-sig' },
      });
    });
  });

  // ============== DEPOSIT ADDRESS ==============

  describe('getOrCreateDepositAddress', () => {
    it('should throw if address generator not configured', async () => {
      (addressGenerator.isConfigured as jest.Mock).mockReturnValue(false);

      await expect(service.getOrCreateDepositAddress('user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return existing address with QR code', async () => {
      (prisma.depositAddress.findUnique as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        address: 'SolAddr123',
        chain: 'solana',
      });

      const result = await service.getOrCreateDepositAddress('user-1');

      expect(result.address).toBe('SolAddr123');
      expect(result.qrCode).toContain('data:image/png');
      expect(result.minDeposit).toBe(0.01);
    });

    it('should create new address if none exists', async () => {
      (prisma.depositAddress.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.depositAddress.findFirst as jest.Mock).mockResolvedValue({
        derivationIndex: 4,
      });
      (addressGenerator.generateDepositAddress as jest.Mock).mockReturnValue({
        publicKey: 'NewSolAddr',
      });
      (prisma.depositAddress.create as jest.Mock).mockResolvedValue({
        id: 'da-1',
        userId: 'user-1',
        address: 'NewSolAddr',
        derivationIndex: 5,
      });
      (heliusWebhook.registerAddress as jest.Mock).mockResolvedValue(
        'webhook-1',
      );
      (prisma.depositAddress.update as jest.Mock).mockResolvedValue({});

      const result = await service.getOrCreateDepositAddress('user-1');

      expect(result.address).toBe('NewSolAddr');
      expect(addressGenerator.generateDepositAddress).toHaveBeenCalledWith(5);
    });
  });

  // ============== WEBHOOK PROCESSING ==============

  describe('processWebhookPayload', () => {
    it('should process parsed deposits', async () => {
      (heliusWebhook.parseWebhookPayload as jest.Mock).mockReturnValue([
        {
          signature: 'sig-1',
          fromAddress: 'sender-1',
          toAddress: 'HotWallet111',
          currency: 'SOL',
          amount: 1,
          slot: 100,
        },
      ]);
      (depositProcessor.depositExists as jest.Mock).mockResolvedValue(false);
      (prisma.walletConnection.findFirst as jest.Mock).mockResolvedValue({
        userId: 'user-1',
      });
      (prisma.deposit.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.deposit.create as jest.Mock).mockResolvedValue({
        id: 'dep-1',
      });
      (depositProcessor.processConfirmedDeposit as jest.Mock).mockResolvedValue(
        {},
      );

      const result = await service.processWebhookPayload([] as any);

      expect(result.processed).toBe(1);
      expect(result.skipped).toBe(0);
    });

    it('should skip duplicate deposits', async () => {
      (heliusWebhook.parseWebhookPayload as jest.Mock).mockReturnValue([
        {
          signature: 'dup-sig',
          fromAddress: 'sender-1',
          toAddress: 'HotWallet111',
          currency: 'SOL',
          amount: 1,
          slot: 100,
        },
      ]);
      (depositProcessor.depositExists as jest.Mock).mockResolvedValue(true);

      const result = await service.processWebhookPayload([] as any);

      expect(result.processed).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it('should handle empty payload', async () => {
      (heliusWebhook.parseWebhookPayload as jest.Mock).mockReturnValue([]);

      const result = await service.processWebhookPayload([] as any);

      expect(result.processed).toBe(0);
      expect(result.skipped).toBe(0);
    });
  });

  // ============== QUERIES ==============

  describe('getUserDeposits', () => {
    it('should return user deposits ordered by createdAt desc', async () => {
      const mockDeposits = [
        { id: 'dep-2', createdAt: new Date() },
        { id: 'dep-1', createdAt: new Date() },
      ];
      (prisma.deposit.findMany as jest.Mock).mockResolvedValue(mockDeposits);

      const result = await service.getUserDeposits('user-1');

      expect(result).toHaveLength(2);
      expect(prisma.deposit.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getDepositById', () => {
    it('should return deposit by id', async () => {
      (prisma.deposit.findUnique as jest.Mock).mockResolvedValue({
        id: 'dep-1',
      });

      const result = await service.getDepositById('dep-1');

      expect(result?.id).toBe('dep-1');
    });
  });

  describe('getRates', () => {
    it('should return rates with fortune fallback to 0', async () => {
      (priceOracle.getRates as jest.Mock).mockResolvedValue({
        sol: 150,
        fortune: null,
        usdt: 1,
      });

      const result = await service.getRates();

      expect(result.sol).toBe(150);
      expect(result.fortune).toBe(0);
      expect(result.usdt).toBe(1);
    });

    it('should return fortune rate when available', async () => {
      (priceOracle.getRates as jest.Mock).mockResolvedValue({
        sol: 150,
        fortune: 0.05,
        usdt: 1,
      });

      const result = await service.getRates();

      expect(result.fortune).toBe(0.05);
    });
  });

  // ============== OTHER CRYPTO ==============

  describe('getOtherCryptoInstructions', () => {
    it('should return BEP20 instructions', () => {
      const result = service.getOtherCryptoInstructions('BEP20' as any);

      expect(result.network).toBe('BEP20');
      expect(result.depositAddress).toBe('0xBep20Address');
      expect(result.supportedTokens).toContain('USDT');
    });

    it('should throw if address not configured', () => {
      (configService.get as jest.Mock).mockReturnValue(null);

      expect(() => service.getOtherCryptoInstructions('BEP20' as any)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('initiateOtherCryptoDeposit', () => {
    it('should throw if below minimum', async () => {
      await expect(
        service.initiateOtherCryptoDeposit('user-1', {
          network: 'BEP20',
          token: 'USDT',
          claimedAmount: 0.1,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if token not supported on network', async () => {
      await expect(
        service.initiateOtherCryptoDeposit('user-1', {
          network: 'BEP20',
          token: 'TON', // TON not on BEP20
          claimedAmount: 10,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create pending other_crypto deposit', async () => {
      (prisma.deposit.create as jest.Mock).mockResolvedValue({
        id: 'dep-1',
        method: 'other_crypto',
        status: 'pending',
      });

      const result = await service.initiateOtherCryptoDeposit('user-1', {
        network: 'BEP20',
        token: 'USDT',
        claimedAmount: 50,
      } as any);

      expect(result.depositId).toBe('dep-1');
      expect(result.status).toBe('pending');
      expect(prisma.deposit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          method: 'other_crypto',
          chain: 'bsc',
          currency: 'USDT_SOL',
          claimedAmount: 50,
          status: 'pending',
        }),
      });
    });
  });
});
