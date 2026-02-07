jest.mock('nanoid', () => ({ nanoid: jest.fn(() => 'mock-id') }));
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn().mockReturnValue('mock-jwks'),
  jwtVerify: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { EconomyController } from './economy.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PurchaseService } from './services/purchase.service';
import { TransactionsService } from './services/transactions.service';
import { MachinesService } from '../machines/machines.service';

describe('EconomyController', () => {
  let controller: EconomyController;
  let purchaseService: jest.Mocked<PurchaseService>;
  let transactionsService: jest.Mocked<TransactionsService>;
  let machinesService: jest.Mocked<MachinesService>;

  const mockReq = { user: { sub: 'user-1' } } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EconomyController],
      providers: [
        {
          provide: PurchaseService,
          useValue: {
            purchaseMachine: jest.fn(),
            canAffordTier: jest.fn(),
            getPurchaseHistory: jest.fn(),
          },
        },
        {
          provide: TransactionsService,
          useValue: {
            findByUserId: jest.fn(),
            getUserTransactionStats: jest.fn(),
          },
        },
        {
          provide: MachinesService,
          useValue: {
            enrichWithTierInfo: jest.fn().mockReturnValue({
              tierInfo: { name: 'T1', emoji: '🎰' },
            }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<EconomyController>(EconomyController);
    purchaseService = module.get(PurchaseService);
    transactionsService = module.get(TransactionsService);
    machinesService = module.get(MachinesService);

    jest.clearAllMocks();
    (machinesService.enrichWithTierInfo as jest.Mock).mockReturnValue({
      tierInfo: { name: 'T1', emoji: '🎰' },
    });
  });

  describe('purchaseMachine', () => {
    it('should purchase machine and return formatted response', async () => {
      (purchaseService.purchaseMachine as jest.Mock).mockResolvedValue({
        machine: {
          id: 'm-1',
          tier: 1,
          purchasePrice: new Prisma.Decimal(10),
          totalYield: new Prisma.Decimal(14.5),
          profitAmount: new Prisma.Decimal(4.5),
          lifespanDays: 3,
          startedAt: new Date(),
          expiresAt: new Date(),
          status: 'active',
        },
        transaction: {
          id: 'tx-1',
          type: 'machine_purchase',
          amount: new Prisma.Decimal(10),
          status: 'completed',
          createdAt: new Date(),
        },
        user: {
          id: 'user-1',
          fortuneBalance: new Prisma.Decimal(90),
          maxTierReached: 1,
          maxTierUnlocked: 1,
          currentTaxRate: new Prisma.Decimal(0.5),
        },
      });

      const result = await controller.purchaseMachine(
        { tier: 1 } as any,
        mockReq,
      );

      expect(result.machine.id).toBe('m-1');
      expect(result.machine.purchasePrice).toBe('10');
      expect(result.user.fortuneBalance).toBe('90');
      expect(result.transaction.type).toBe('machine_purchase');
    });
  });

  describe('canAffordTier', () => {
    it('should delegate to purchaseService.canAffordTier', async () => {
      (purchaseService.canAffordTier as jest.Mock).mockResolvedValue({
        canAfford: true,
        price: 10,
        balance: 100,
      });

      const result = await controller.canAffordTier(1, mockReq);

      expect(result.canAfford).toBe(true);
      expect(purchaseService.canAffordTier).toHaveBeenCalledWith('user-1', 1);
    });
  });

  describe('getTransactions', () => {
    it('should return formatted transactions', async () => {
      (transactionsService.findByUserId as jest.Mock).mockResolvedValue([
        {
          id: 'tx-1',
          type: 'collect',
          amount: new Prisma.Decimal(5),
          currency: 'FORTUNE',
          taxAmount: new Prisma.Decimal(0.5),
          taxRate: new Prisma.Decimal(0.1),
          netAmount: new Prisma.Decimal(4.5),
          status: 'completed',
          createdAt: new Date(),
          machineId: 'm-1',
        },
      ]);

      const result = await controller.getTransactions(mockReq, '10', '0');

      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe('5');
      expect(result[0].netAmount).toBe('4.5');
      expect(transactionsService.findByUserId).toHaveBeenCalledWith('user-1', {
        limit: 10,
        offset: 0,
      });
    });
  });

  describe('getTransactionStats', () => {
    it('should delegate to transactionsService.getUserTransactionStats', async () => {
      const mockStats = { totalPurchases: 5, totalCollected: 100 };
      (
        transactionsService.getUserTransactionStats as jest.Mock
      ).mockResolvedValue(mockStats);

      const result = await controller.getTransactionStats(mockReq);

      expect(result).toEqual(mockStats);
    });
  });

  describe('getPurchaseHistory', () => {
    it('should return formatted purchase history', async () => {
      (purchaseService.getPurchaseHistory as jest.Mock).mockResolvedValue([
        {
          id: 'tx-1',
          type: 'machine_purchase',
          amount: new Prisma.Decimal(10),
          currency: 'FORTUNE',
          taxAmount: new Prisma.Decimal(0),
          taxRate: new Prisma.Decimal(0),
          netAmount: new Prisma.Decimal(10),
          status: 'completed',
          createdAt: new Date(),
          machineId: 'm-1',
        },
      ]);

      const result = await controller.getPurchaseHistory(mockReq);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('machine_purchase');
    });
  });
});
