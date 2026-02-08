jest.mock('nanoid', () => ({ nanoid: jest.fn(() => 'mock-id') }));
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn().mockReturnValue('mock-jwks'),
  jwtVerify: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { MachinesController } from './machines.controller';
import { MachinesService } from './machines.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RiskyCollectService } from './services/risky-collect.service';
import { AutoCollectService } from './services/auto-collect.service';
import { AuctionService } from './services/auction.service';
import { PawnshopService } from './services/pawnshop.service';

describe('MachinesController', () => {
  let controller: MachinesController;
  let machinesService: jest.Mocked<MachinesService>;
  let riskyCollectService: jest.Mocked<RiskyCollectService>;
  let autoCollectService: jest.Mocked<AutoCollectService>;
  let auctionService: jest.Mocked<AuctionService>;
  let pawnshopService: jest.Mocked<PawnshopService>;

  const mockReq = { user: { sub: 'user-1' } } as any;

  const mockMachine = {
    id: 'm-1',
    userId: 'user-1',
    tier: 1,
    purchasePrice: new Prisma.Decimal(10),
    totalYield: new Prisma.Decimal(14.5),
    profitAmount: new Prisma.Decimal(4.5),
    lifespanDays: 3,
    startedAt: new Date(),
    expiresAt: new Date(),
    ratePerSecond: new Prisma.Decimal(0.0001),
    accumulatedIncome: new Prisma.Decimal(0),
    coinBoxLevel: 1,
    coinBoxCapacity: new Prisma.Decimal(1),
    coinBoxCurrent: new Prisma.Decimal(0.5),
    reinvestRound: 0,
    profitReductionRate: new Prisma.Decimal(0),
    autoCollectEnabled: false,
    autoCollectPurchasedAt: null,
    overclockMultiplier: new Prisma.Decimal(1),
    status: 'active',
    createdAt: new Date(),
  };

  const mockTierInfo = {
    ...mockMachine,
    tierInfo: { name: 'Rusty Lever', emoji: '🎰', imageUrl: '/t1.png' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MachinesController],
      providers: [
        {
          provide: MachinesService,
          useValue: {
            getTiers: jest.fn().mockReturnValue([]),
            getTierById: jest.fn(),
            findByUserId: jest.fn(),
            getActiveMachines: jest.fn(),
            findByIdOrThrow: jest.fn(),
            calculateIncome: jest.fn(),
            create: jest.fn(),
            collectCoins: jest.fn(),
            enrichWithTierInfo: jest.fn().mockReturnValue(mockTierInfo),
            sellMachineEarly: jest.fn(),
          },
        },
        {
          provide: RiskyCollectService,
          useValue: {
            riskyCollect: jest.fn(),
            upgradeFortuneGamble: jest.fn(),
            getGambleInfo: jest.fn(),
          },
        },
        {
          provide: AutoCollectService,
          useValue: {
            getAutoCollectInfo: jest.fn(),
            purchaseAutoCollect: jest.fn(),
          },
        },
        {
          provide: AuctionService,
          useValue: {
            getAuctionQueueByTier: jest.fn(),
            getUserListingsWithPosition: jest.fn(),
            getAuctionInfo: jest.fn(),
            listOnAuction: jest.fn(),
            cancelAuctionListing: jest.fn(),
          },
        },
        {
          provide: PawnshopService,
          useValue: {
            getPawnshopInfo: jest.fn(),
            sellToPawnshop: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MachinesController>(MachinesController);
    machinesService = module.get(MachinesService);
    riskyCollectService = module.get(RiskyCollectService);
    autoCollectService = module.get(AutoCollectService);
    auctionService = module.get(AuctionService);
    pawnshopService = module.get(PawnshopService);

    jest.clearAllMocks();
    // Re-set default mock after clearAllMocks
    (machinesService.enrichWithTierInfo as jest.Mock).mockReturnValue(
      mockTierInfo,
    );
  });

  describe('getTiers', () => {
    it('should delegate to machinesService.getTiers()', () => {
      (machinesService.getTiers as jest.Mock).mockReturnValue([
        { tier: 1, name: 'T1' },
      ]);

      const result = controller.getTiers();

      expect(result).toHaveLength(1);
      expect(machinesService.getTiers).toHaveBeenCalled();
    });
  });

  describe('getUserMachines', () => {
    it('should return mapped machine DTOs', async () => {
      (machinesService.findByUserId as jest.Mock).mockResolvedValue([
        mockMachine,
      ]);

      const result = await controller.getUserMachines(mockReq);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('m-1');
      expect(typeof result[0].purchasePrice).toBe('string');
    });
  });

  describe('getMachineById', () => {
    it('should return machine DTO for owner', async () => {
      (machinesService.findByIdOrThrow as jest.Mock).mockResolvedValue(
        mockMachine,
      );

      const result = await controller.getMachineById('m-1', mockReq);

      expect(result.id).toBe('m-1');
    });

    it('should throw if machine does not belong to user', async () => {
      (machinesService.findByIdOrThrow as jest.Mock).mockResolvedValue({
        ...mockMachine,
        userId: 'other-user',
      });

      await expect(controller.getMachineById('m-1', mockReq)).rejects.toThrow();
    });
  });

  describe('createMachine', () => {
    it('should delegate to machinesService.create', async () => {
      (machinesService.create as jest.Mock).mockResolvedValue(mockMachine);

      const result = await controller.createMachine(
        { tier: 1 } as any,
        mockReq,
      );

      expect(result.id).toBe('m-1');
      expect(machinesService.create).toHaveBeenCalledWith('user-1', {
        tier: 1,
      });
    });
  });

  describe('collectCoins', () => {
    it('should delegate to machinesService.collectCoins', async () => {
      (machinesService.collectCoins as jest.Mock).mockResolvedValue({
        collected: '0.5',
        machine: mockMachine,
        fameEarned: 10,
      });

      const result = await controller.collectCoins('m-1', mockReq);

      expect(result.collected).toBe('0.5');
      expect(result.fameEarned).toBe(10);
    });
  });

  describe('collectRisky', () => {
    it('should delegate to riskyCollectService', async () => {
      (riskyCollectService.riskyCollect as jest.Mock).mockResolvedValue({
        won: true,
        originalAmount: 0.5,
        finalAmount: 1.0,
        winChance: 50,
        multiplier: 2,
        machine: mockMachine,
        newBalance: '10',
      });

      const result = await controller.collectRisky('m-1', mockReq);

      expect(result.won).toBe(true);
      expect(result.finalAmount).toBe(1.0);
    });
  });

  describe('getAuctionQueue', () => {
    it('should return auction queue', async () => {
      (auctionService.getAuctionQueueByTier as jest.Mock).mockResolvedValue([
        { tier: 1, count: 3 },
      ]);

      const result = await controller.getAuctionQueue();

      expect(result).toHaveLength(1);
    });
  });

  describe('getSaleOptions', () => {
    it('should return auction + pawnshop with recommendation', async () => {
      (auctionService.getAuctionInfo as jest.Mock).mockResolvedValue({
        canList: true,
        queueLength: 0,
        expectedPayout: 8,
      });
      (pawnshopService.getPawnshopInfo as jest.Mock).mockResolvedValue({
        canSell: true,
        expectedPayout: 7,
      });

      const result = await controller.getSaleOptions('m-1', mockReq);

      expect(result.recommendation).toBe('auction');
      expect(result.recommendationReasonCode).toBe('noQueue');
    });

    it('should recommend pawnshop when auction does not pay significantly more', async () => {
      (auctionService.getAuctionInfo as jest.Mock).mockResolvedValue({
        canList: true,
        queueLength: 5,
        expectedPayout: 7,
      });
      (pawnshopService.getPawnshopInfo as jest.Mock).mockResolvedValue({
        canSell: true,
        expectedPayout: 7,
      });

      const result = await controller.getSaleOptions('m-1', mockReq);

      expect(result.recommendation).toBe('pawnshop');
    });

    it('should recommend wait when neither is available', async () => {
      (auctionService.getAuctionInfo as jest.Mock).mockResolvedValue({
        canList: false,
        queueLength: 0,
        expectedPayout: 0,
      });
      (pawnshopService.getPawnshopInfo as jest.Mock).mockResolvedValue({
        canSell: false,
        expectedPayout: 0,
      });

      const result = await controller.getSaleOptions('m-1', mockReq);

      expect(result.recommendation).toBe('wait');
    });
  });
});
