import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AuctionService } from './auction.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MachinesService } from '../machines.service';
import { FundSourceService } from '../../economy/services/fund-source.service';

describe('AuctionService', () => {
  let service: AuctionService;
  let machinesService: jest.Mocked<MachinesService>;
  let prisma: jest.Mocked<PrismaService>;

  const mockUserId = 'user-123';
  const mockMachineId = 'machine-456';

  const createMockMachine = (overrides = {}) => ({
    id: mockMachineId,
    userId: mockUserId,
    tier: 3,
    status: 'active',
    coinBoxLevel: 1,
    fortuneGambleLevel: 0,
    autoCollectEnabled: false,
    startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuctionService,
        {
          provide: MachinesService,
          useValue: {
            findByIdOrThrow: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            auctionListing: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
            machine: {
              findUnique: jest.fn(),
              findUniqueOrThrow: jest.fn(),
              update: jest.fn(),
            },
            user: { update: jest.fn() },
            transaction: { create: jest.fn() },
            $transaction: jest.fn(),
          },
        },
        {
          provide: FundSourceService,
          useValue: {
            propagateMachineFundSourceToBalance: jest.fn().mockResolvedValue({
              freshPortion: 0,
              profitPortion: 0,
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuctionService>(AuctionService);
    machinesService = module.get(MachinesService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('listOnAuction', () => {
    it('should throw if machine does not belong to user', async () => {
      machinesService.findByIdOrThrow.mockResolvedValue(
        createMockMachine({ userId: 'other' }) as any,
      );

      await expect(
        service.listOnAuction(mockMachineId, mockUserId),
      ).rejects.toThrow('Machine does not belong to user');
    });

    it('should throw if machine is not active', async () => {
      machinesService.findByIdOrThrow.mockResolvedValue(
        createMockMachine({ status: 'expired' }) as any,
      );

      await expect(
        service.listOnAuction(mockMachineId, mockUserId),
      ).rejects.toThrow('Only active machines can be listed on auction');
    });

    it('should throw if already listed', async () => {
      machinesService.findByIdOrThrow.mockResolvedValue(
        createMockMachine() as any,
      );
      (prisma.auctionListing.findUnique as jest.Mock).mockResolvedValue({
        status: 'pending',
      });

      await expect(
        service.listOnAuction(mockMachineId, mockUserId),
      ).rejects.toThrow('Machine is already listed on auction');
    });

    it('should list machine on auction', async () => {
      machinesService.findByIdOrThrow.mockResolvedValue(
        createMockMachine() as any,
      );
      (prisma.auctionListing.findUnique as jest.Mock).mockResolvedValue(null);

      const listing = { id: 'listing-1', status: 'pending' };
      const updatedMachine = createMockMachine({ status: 'listed_auction' });

      (prisma.$transaction as jest.Mock).mockResolvedValue({
        listing,
        machine: updatedMachine,
      });

      const result = await service.listOnAuction(mockMachineId, mockUserId);

      expect(result.listing).toBeDefined();
      expect(result.wearPercent).toBeGreaterThanOrEqual(0);
      expect(result.commissionRate).toBeGreaterThanOrEqual(0);
      expect(result.expectedPayout).toBeGreaterThan(0);
    });
  });

  describe('cancelAuctionListing', () => {
    it('should throw if machine does not belong to user', async () => {
      machinesService.findByIdOrThrow.mockResolvedValue(
        createMockMachine({ userId: 'other' }) as any,
      );

      await expect(
        service.cancelAuctionListing(mockMachineId, mockUserId),
      ).rejects.toThrow('Machine does not belong to user');
    });

    it('should throw if no active listing', async () => {
      machinesService.findByIdOrThrow.mockResolvedValue(
        createMockMachine() as any,
      );
      (prisma.auctionListing.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.cancelAuctionListing(mockMachineId, mockUserId),
      ).rejects.toThrow('No active listing found for this machine');
    });

    it('should cancel listing and restore machine', async () => {
      machinesService.findByIdOrThrow.mockResolvedValue(
        createMockMachine({ status: 'listed_auction' }) as any,
      );
      (prisma.auctionListing.findUnique as jest.Mock).mockResolvedValue({
        id: 'listing-1',
        status: 'pending',
      });

      const cancelledListing = { id: 'listing-1', status: 'cancelled' };
      const restoredMachine = createMockMachine({ status: 'active' });

      (prisma.$transaction as jest.Mock).mockResolvedValue({
        listing: cancelledListing,
        machine: restoredMachine,
      });

      const result = await service.cancelAuctionListing(
        mockMachineId,
        mockUserId,
      );

      expect(result.listing.status).toBe('cancelled');
      expect(result.machine.status).toBe('active');
    });
  });

  describe('getFirstPendingListing', () => {
    it('should return first pending listing for tier', async () => {
      const listing = { id: 'listing-1', tier: 3, status: 'pending' };
      (prisma.auctionListing.findFirst as jest.Mock).mockResolvedValue(listing);

      const result = await service.getFirstPendingListing(3);

      expect(result).toEqual(listing);
      expect(prisma.auctionListing.findFirst).toHaveBeenCalledWith({
        where: { tier: 3, status: 'pending' },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should return null if no pending listings', async () => {
      (prisma.auctionListing.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getFirstPendingListing(3);

      expect(result).toBeNull();
    });
  });

  describe('getQueueLength', () => {
    it('should return count of pending listings for tier', async () => {
      (prisma.auctionListing.count as jest.Mock).mockResolvedValue(5);

      const result = await service.getQueueLength(3);

      expect(result).toBe(5);
    });
  });

  describe('getAuctionInfo', () => {
    it('should return auction info for active machine', async () => {
      machinesService.findByIdOrThrow.mockResolvedValue(
        createMockMachine() as any,
      );
      (prisma.auctionListing.count as jest.Mock).mockResolvedValue(2);

      const info = await service.getAuctionInfo(mockMachineId, mockUserId);

      expect(info.canList).toBe(true);
      expect(info.wearPercent).toBeGreaterThanOrEqual(0);
      expect(info.commissionRate).toBeGreaterThanOrEqual(0);
      expect(info.expectedPayout).toBeGreaterThan(0);
      expect(info.queueLength).toBe(2);
    });

    it('should not allow listing for already listed machine', async () => {
      machinesService.findByIdOrThrow.mockResolvedValue(
        createMockMachine({ status: 'listed_auction' }) as any,
      );
      (prisma.auctionListing.count as jest.Mock).mockResolvedValue(1);
      (prisma.auctionListing.findUnique as jest.Mock).mockResolvedValue({
        status: 'pending',
        createdAt: new Date(),
      });
      (prisma.auctionListing.count as jest.Mock)
        .mockResolvedValueOnce(1) // getQueueLength
        .mockResolvedValueOnce(0); // position count

      const info = await service.getAuctionInfo(mockMachineId, mockUserId);

      expect(info.canList).toBe(false);
      expect(info.reason).toContain('already listed');
    });

    it('should throw if machine does not belong to user', async () => {
      machinesService.findByIdOrThrow.mockResolvedValue(
        createMockMachine({ userId: 'other' }) as any,
      );

      await expect(
        service.getAuctionInfo(mockMachineId, mockUserId),
      ).rejects.toThrow('Machine does not belong to user');
    });
  });

  describe('processAuctionSale', () => {
    it('should process sale and pay seller', async () => {
      const listing = {
        id: 'listing-1',
        machineId: mockMachineId,
        sellerId: 'seller-1',
        tier: 3,
        expectedPayout: 180,
        commissionRateAtListing: 0.1,
      };

      (prisma.$transaction as jest.Mock).mockResolvedValue({
        sellerNewBalance: 280,
      });

      const result = await service.processAuctionSale(
        listing as any,
        'buyer-1',
        'new-machine-1',
      );

      expect(result.sellerPayout).toBe(180);
      expect(result.sellerNewBalance).toBe(280);
    });
  });

  describe('getUserListings', () => {
    it('should return user active listings', async () => {
      const listings = [
        { id: 'listing-1', sellerId: mockUserId, status: 'pending' },
      ];
      (prisma.auctionListing.findMany as jest.Mock).mockResolvedValue(listings);

      const result = await service.getUserListings(mockUserId);

      expect(result).toHaveLength(1);
      expect(prisma.auctionListing.findMany).toHaveBeenCalledWith({
        where: { sellerId: mockUserId, status: 'pending' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('handleExpiredListings', () => {
    it('should expire listings for expired machines', async () => {
      const expired = new Date(Date.now() - 1000);
      (prisma.auctionListing.findMany as jest.Mock).mockResolvedValue([
        { id: 'listing-1', machineId: 'machine-1', status: 'pending' },
      ]);
      (prisma.machine.findUnique as jest.Mock).mockResolvedValue({
        id: 'machine-1',
        expiresAt: expired,
      });
      (prisma.$transaction as jest.Mock).mockImplementation((cb) => cb(prisma));
      (prisma.auctionListing.update as jest.Mock).mockResolvedValue({});
      (prisma.machine.update as jest.Mock).mockResolvedValue({});

      const count = await service.handleExpiredListings();

      expect(count).toBe(1);
    });

    it('should not expire listings for active machines', async () => {
      (prisma.auctionListing.findMany as jest.Mock).mockResolvedValue([
        { id: 'listing-1', machineId: 'machine-1', status: 'pending' },
      ]);
      (prisma.machine.findUnique as jest.Mock).mockResolvedValue({
        id: 'machine-1',
        expiresAt: new Date(Date.now() + 86400000),
      });

      const count = await service.handleExpiredListings();

      expect(count).toBe(0);
    });
  });
});
