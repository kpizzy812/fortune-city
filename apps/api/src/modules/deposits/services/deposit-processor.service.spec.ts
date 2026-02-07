import { Test, TestingModule } from '@nestjs/testing';
import { DepositProcessorService } from './deposit-processor.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PriceOracleService } from './price-oracle.service';
import { DepositsGateway } from '../deposits.gateway';
import { NotificationsService } from '../../notifications/notifications.service';
import { Prisma, DepositStatus } from '@prisma/client';

describe('DepositProcessorService', () => {
  let service: DepositProcessorService;
  let prisma: jest.Mocked<PrismaService>;
  let priceOracle: jest.Mocked<PriceOracleService>;
  let depositsGateway: jest.Mocked<DepositsGateway>;
  let notificationsService: jest.Mocked<NotificationsService>;

  const mockDeposit = {
    id: 'dep-1',
    userId: 'user-1',
    amount: new Prisma.Decimal(1.5),
    currency: 'SOL' as const,
    chain: 'solana' as const,
    txSignature: 'sig-123',
    status: 'confirmed' as const,
    amountUsd: null,
    rateToUsd: null,
    slot: null,
    memo: null,
    depositAddressId: null,
    errorMessage: null,
    creditedAt: null,
    confirmedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepositProcessorService,
        {
          provide: PrismaService,
          useValue: {
            deposit: {
              update: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              count: jest.fn(),
            },
            user: { update: jest.fn() },
            transaction: { create: jest.fn() },
            referralBonus: { create: jest.fn() },
            $transaction: jest.fn(),
          },
        },
        {
          provide: PriceOracleService,
          useValue: {
            convertToUsd: jest.fn(),
          },
        },
        {
          provide: DepositsGateway,
          useValue: {
            emitDepositCredited: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            notify: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<DepositProcessorService>(DepositProcessorService);
    prisma = module.get(PrismaService);
    priceOracle = module.get(PriceOracleService);
    depositsGateway = module.get(DepositsGateway);
    notificationsService = module.get(NotificationsService);

    jest.clearAllMocks();
  });

  describe('processConfirmedDeposit', () => {
    it('should process SOL deposit and credit balance', async () => {
      priceOracle.convertToUsd.mockResolvedValue(300); // 1.5 SOL * $200

      const updatedDeposit = {
        ...mockDeposit,
        status: 'credited',
        amountUsd: 300,
      };
      const updatedUser = {
        id: 'user-1',
        fortuneBalance: new Prisma.Decimal(400),
        referredById: null,
      };

      (prisma.$transaction as jest.Mock).mockResolvedValue({
        updated: updatedDeposit,
        newBalance: 400,
      });

      const result = await service.processConfirmedDeposit(mockDeposit as any);

      expect(result.status).toBe('credited');
      expect(priceOracle.convertToUsd).toHaveBeenCalledWith('SOL', 1.5);
      expect(depositsGateway.emitDepositCredited).toHaveBeenCalledWith(
        expect.objectContaining({
          depositId: 'dep-1',
          userId: 'user-1',
          amountUsd: 300,
        }),
      );
      expect(notificationsService.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: 'deposit_credited',
        }),
      );
    });

    it('should process USDT deposit (1:1 rate)', async () => {
      const usdtDeposit = {
        ...mockDeposit,
        currency: 'USDT_SOL',
        amount: new Prisma.Decimal(50),
      };
      priceOracle.convertToUsd.mockResolvedValue(50);

      (prisma.$transaction as jest.Mock).mockResolvedValue({
        updated: { ...usdtDeposit, status: 'credited', amountUsd: 50 },
        newBalance: 150,
      });

      await service.processConfirmedDeposit(usdtDeposit as any);

      expect(priceOracle.convertToUsd).toHaveBeenCalledWith('USDT_SOL', 50);
    });
  });

  describe('markDepositFailed', () => {
    it('should update deposit status to failed', async () => {
      const failedDeposit = {
        ...mockDeposit,
        status: 'failed',
        errorMessage: 'Transaction reverted',
      };
      (prisma.deposit.update as jest.Mock).mockResolvedValue(failedDeposit);

      const result = await service.markDepositFailed(
        'dep-1',
        'Transaction reverted',
      );

      expect(result.status).toBe('failed');
      expect(prisma.deposit.update).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
        data: {
          status: DepositStatus.failed,
          errorMessage: 'Transaction reverted',
        },
      });
      expect(notificationsService.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'deposit_rejected',
        }),
      );
    });
  });

  describe('markDepositConfirmed', () => {
    it('should update deposit status to confirmed', async () => {
      const confirmed = { ...mockDeposit, status: 'confirmed' };
      (prisma.deposit.update as jest.Mock).mockResolvedValue(confirmed);

      const result = await service.markDepositConfirmed('dep-1', BigInt(12345));

      expect(prisma.deposit.update).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
        data: {
          status: DepositStatus.confirmed,
          slot: BigInt(12345),
          confirmedAt: expect.any(Date),
        },
      });
    });
  });

  describe('findBySignature', () => {
    it('should find deposit by tx signature', async () => {
      (prisma.deposit.findUnique as jest.Mock).mockResolvedValue(mockDeposit);

      const result = await service.findBySignature('sig-123');

      expect(result).toBeDefined();
      expect(prisma.deposit.findUnique).toHaveBeenCalledWith({
        where: { txSignature: 'sig-123' },
      });
    });

    it('should return null if not found', async () => {
      (prisma.deposit.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.findBySignature('not-exist');

      expect(result).toBeNull();
    });
  });

  describe('findByMemo', () => {
    it('should find deposit by memo', async () => {
      (prisma.deposit.findFirst as jest.Mock).mockResolvedValue(mockDeposit);

      const result = await service.findByMemo('memo-abc');

      expect(prisma.deposit.findFirst).toHaveBeenCalledWith({
        where: { memo: 'memo-abc' },
      });
    });
  });

  describe('depositExists', () => {
    it('should return true if deposit exists', async () => {
      (prisma.deposit.count as jest.Mock).mockResolvedValue(1);

      const result = await service.depositExists('sig-123');

      expect(result).toBe(true);
    });

    it('should return false if not exists', async () => {
      (prisma.deposit.count as jest.Mock).mockResolvedValue(0);

      const result = await service.depositExists('not-exist');

      expect(result).toBe(false);
    });
  });
});
