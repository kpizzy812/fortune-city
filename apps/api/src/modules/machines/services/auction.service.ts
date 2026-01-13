import {
  Injectable,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Machine, AuctionListing } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MachinesService } from '../machines.service';
import { FundSourceService } from '../../economy/services/fund-source.service';
import {
  calculateAuctionCommission,
  calculateMachineWear,
  getTierConfigOrThrow,
  COIN_BOX_LEVELS,
} from '@fortune-city/shared';

export interface ListOnAuctionResult {
  listing: AuctionListing;
  machine: Machine;
  wearPercent: number;
  commissionRate: number;
  expectedPayout: number;
}

export interface CancelAuctionResult {
  listing: AuctionListing;
  machine: Machine;
}

export interface AuctionInfo {
  canList: boolean;
  reason?: string;
  wearPercent: number;
  commissionRate: number;
  expectedPayout: number;
  tierPrice: number;
  queuePosition?: number;
  queueLength: number;
}

export interface AuctionQueueInfo {
  tier: number;
  queueLength: number;
  oldestListing?: {
    id: string;
    createdAt: Date;
    wearPercent: number;
    hasUpgrades: boolean;
  };
}

@Injectable()
export class AuctionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly machinesService: MachinesService,
    @Inject(forwardRef(() => FundSourceService))
    private readonly fundSourceService: FundSourceService,
  ) {}

  /**
   * List machine on auction for P2P sale
   */
  async listOnAuction(
    machineId: string,
    userId: string,
  ): Promise<ListOnAuctionResult> {
    const machine = await this.machinesService.findByIdOrThrow(machineId);

    if (machine.userId !== userId) {
      throw new BadRequestException('Machine does not belong to user');
    }

    if (machine.status !== 'active') {
      throw new BadRequestException(
        'Only active machines can be listed on auction',
      );
    }

    // Check if already listed
    const existingListing = await this.prisma.auctionListing.findUnique({
      where: { machineId },
    });

    if (existingListing && existingListing.status === 'pending') {
      throw new BadRequestException('Machine is already listed on auction');
    }

    // Calculate wear and commission at listing time
    const wearPercent = calculateMachineWear(
      machine.startedAt,
      machine.expiresAt,
    );
    const commissionRate = calculateAuctionCommission(wearPercent);
    const tierConfig = getTierConfigOrThrow(machine.tier);
    const expectedPayout = tierConfig.price * (1 - commissionRate);

    // Atomic transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Update machine status
      const updatedMachine = await tx.machine.update({
        where: { id: machineId },
        data: {
          status: 'listed_auction',
        },
      });

      // 2. Create auction listing
      const listing = await tx.auctionListing.create({
        data: {
          machineId,
          sellerId: userId,
          tier: machine.tier,
          wearPercentAtListing: wearPercent,
          commissionRateAtListing: commissionRate,
          expectedPayout,
          coinBoxLevelAtListing: machine.coinBoxLevel,
          fortuneGambleLevelAtListing: machine.fortuneGambleLevel,
          autoCollectAtListing: machine.autoCollectEnabled,
          status: 'pending',
        },
      });

      // 3. Create transaction record
      await tx.transaction.create({
        data: {
          userId,
          machineId,
          type: 'machine_auction_list',
          amount: 0,
          currency: 'FORTUNE',
          netAmount: 0,
          status: 'completed',
        },
      });

      return { listing, machine: updatedMachine };
    });

    return {
      listing: result.listing,
      machine: result.machine,
      wearPercent,
      commissionRate,
      expectedPayout,
    };
  }

  /**
   * Cancel auction listing
   */
  async cancelAuctionListing(
    machineId: string,
    userId: string,
  ): Promise<CancelAuctionResult> {
    const machine = await this.machinesService.findByIdOrThrow(machineId);

    if (machine.userId !== userId) {
      throw new BadRequestException('Machine does not belong to user');
    }

    const listing = await this.prisma.auctionListing.findUnique({
      where: { machineId },
    });

    if (!listing || listing.status !== 'pending') {
      throw new BadRequestException('No active listing found for this machine');
    }

    // Atomic transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Update listing status
      const updatedListing = await tx.auctionListing.update({
        where: { id: listing.id },
        data: {
          status: 'cancelled',
        },
      });

      // 2. Restore machine status to active
      const updatedMachine = await tx.machine.update({
        where: { id: machineId },
        data: {
          status: 'active',
        },
      });

      // 3. Create transaction record
      await tx.transaction.create({
        data: {
          userId,
          machineId,
          type: 'machine_auction_cancel',
          amount: 0,
          currency: 'FORTUNE',
          netAmount: 0,
          status: 'completed',
        },
      });

      return { listing: updatedListing, machine: updatedMachine };
    });

    return result;
  }

  /**
   * Get first pending listing for a tier (FIFO)
   */
  async getFirstPendingListing(tier: number): Promise<AuctionListing | null> {
    return this.prisma.auctionListing.findFirst({
      where: {
        tier,
        status: 'pending',
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Get queue length for a tier
   */
  async getQueueLength(tier: number): Promise<number> {
    return this.prisma.auctionListing.count({
      where: {
        tier,
        status: 'pending',
      },
    });
  }

  /**
   * Process auction sale when someone buys a machine of this tier
   * Called from purchase flow
   */
  async processAuctionSale(
    listing: AuctionListing,
    buyerId: string,
    newMachineId: string,
  ): Promise<{ sellerPayout: number; sellerNewBalance: number }> {
    const tierConfig = getTierConfigOrThrow(listing.tier);
    const sellerPayout = Number(listing.expectedPayout);

    // Atomic transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Update listing status
      await tx.auctionListing.update({
        where: { id: listing.id },
        data: {
          status: 'sold',
          buyerId,
          soldAt: new Date(),
          newMachineId,
        },
      });

      // 2. Update seller's machine status
      await tx.machine.update({
        where: { id: listing.machineId },
        data: {
          status: 'sold_auction',
        },
      });

      // 3. Pay seller
      const updatedSeller = await tx.user.update({
        where: { id: listing.sellerId },
        data: {
          fortuneBalance: {
            increment: sellerPayout,
          },
        },
      });

      // 4. Propagate fund source from sold machine back to seller's balance trackers
      // This maintains correct fresh/profit ratio for tax calculation on withdrawal
      await this.fundSourceService.propagateMachineFundSourceToBalance(
        listing.sellerId,
        listing.machineId,
        sellerPayout,
        tx,
      );

      // 5. Create transaction for seller
      await tx.transaction.create({
        data: {
          userId: listing.sellerId,
          machineId: listing.machineId,
          type: 'machine_auction_sale',
          amount: tierConfig.price,
          currency: 'FORTUNE',
          taxAmount: tierConfig.price - sellerPayout,
          taxRate: Number(listing.commissionRateAtListing),
          netAmount: sellerPayout,
          status: 'completed',
        },
      });

      return { sellerNewBalance: Number(updatedSeller.fortuneBalance) };
    });

    return {
      sellerPayout,
      sellerNewBalance: result.sellerNewBalance,
    };
  }

  /**
   * Apply upgrades from auction listing to new machine
   */
  async applyUpgradesToMachine(
    machineId: string,
    listing: AuctionListing,
  ): Promise<Machine> {
    const coinBoxConfig = COIN_BOX_LEVELS[listing.coinBoxLevelAtListing - 1];

    // Calculate new coin box capacity based on machine's rate
    const machine = await this.prisma.machine.findUniqueOrThrow({
      where: { id: machineId },
    });

    const newCapacity =
      Number(machine.ratePerSecond) * (coinBoxConfig.capacityHours * 3600);

    return this.prisma.machine.update({
      where: { id: machineId },
      data: {
        coinBoxLevel: listing.coinBoxLevelAtListing,
        coinBoxCapacity: newCapacity,
        fortuneGambleLevel: listing.fortuneGambleLevelAtListing,
        autoCollectEnabled: listing.autoCollectAtListing,
        autoCollectPurchasedAt: listing.autoCollectAtListing
          ? new Date()
          : null,
      },
    });
  }

  /**
   * Get auction info for a machine
   */
  async getAuctionInfo(
    machineId: string,
    userId: string,
  ): Promise<AuctionInfo> {
    const machine = await this.machinesService.findByIdOrThrow(machineId);

    if (machine.userId !== userId) {
      throw new BadRequestException('Machine does not belong to user');
    }

    const tierConfig = getTierConfigOrThrow(machine.tier);
    const wearPercent = calculateMachineWear(
      machine.startedAt,
      machine.expiresAt,
    );
    const commissionRate = calculateAuctionCommission(wearPercent);
    const expectedPayout = tierConfig.price * (1 - commissionRate);
    const queueLength = await this.getQueueLength(machine.tier);

    // Check if can list
    let canList = true;
    let reason: string | undefined;

    if (machine.status === 'listed_auction') {
      canList = false;
      reason = 'Machine is already listed on auction';
    } else if (machine.status !== 'active') {
      canList = false;
      reason = 'Only active machines can be listed';
    }

    // Get queue position if already listed
    let queuePosition: number | undefined;
    if (machine.status === 'listed_auction') {
      const listing = await this.prisma.auctionListing.findUnique({
        where: { machineId },
      });

      if (listing && listing.status === 'pending') {
        const positionCount = await this.prisma.auctionListing.count({
          where: {
            tier: machine.tier,
            status: 'pending',
            createdAt: { lt: listing.createdAt },
          },
        });
        queuePosition = positionCount + 1;
      }
    }

    return {
      canList,
      reason,
      wearPercent,
      commissionRate,
      expectedPayout,
      tierPrice: tierConfig.price,
      queuePosition,
      queueLength,
    };
  }

  /**
   * Get auction queue info for all tiers
   */
  async getAuctionQueueByTier(): Promise<AuctionQueueInfo[]> {
    const result: AuctionQueueInfo[] = [];

    for (let tier = 1; tier <= 10; tier++) {
      const queueLength = await this.getQueueLength(tier);
      const oldestListing = await this.getFirstPendingListing(tier);

      result.push({
        tier,
        queueLength,
        oldestListing: oldestListing
          ? {
              id: oldestListing.id,
              createdAt: oldestListing.createdAt,
              wearPercent: Number(oldestListing.wearPercentAtListing),
              hasUpgrades:
                oldestListing.coinBoxLevelAtListing > 1 ||
                oldestListing.fortuneGambleLevelAtListing > 0 ||
                oldestListing.autoCollectAtListing,
            }
          : undefined,
      });
    }

    return result;
  }

  /**
   * Get user's active listings
   */
  async getUserListings(userId: string): Promise<AuctionListing[]> {
    return this.prisma.auctionListing.findMany({
      where: {
        sellerId: userId,
        status: 'pending',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get user's active listings with queue position
   */
  async getUserListingsWithPosition(userId: string): Promise<
    Array<{
      id: string;
      machineId: string;
      tier: number;
      wearPercent: number;
      commissionRate: number;
      expectedPayout: number;
      status: string;
      queuePosition: number;
      createdAt: Date;
    }>
  > {
    const listings = await this.getUserListings(userId);

    return Promise.all(
      listings.map(async (listing) => {
        const positionCount = await this.prisma.auctionListing.count({
          where: {
            tier: listing.tier,
            status: 'pending',
            createdAt: { lt: listing.createdAt },
          },
        });

        return {
          id: listing.id,
          machineId: listing.machineId,
          tier: listing.tier,
          wearPercent: Number(listing.wearPercentAtListing),
          commissionRate: Number(listing.commissionRateAtListing),
          expectedPayout: Number(listing.expectedPayout),
          status: listing.status,
          queuePosition: positionCount + 1,
          createdAt: listing.createdAt,
        };
      }),
    );
  }

  /**
   * Handle expired machines that are listed
   * Called periodically to clean up expired listings
   */
  async handleExpiredListings(): Promise<number> {
    const now = new Date();

    // Find all pending listings where the machine has expired
    const expiredListings = await this.prisma.auctionListing.findMany({
      where: {
        status: 'pending',
      },
    });

    let expiredCount = 0;

    for (const listing of expiredListings) {
      const machine = await this.prisma.machine.findUnique({
        where: { id: listing.machineId },
      });

      if (machine && machine.expiresAt <= now) {
        await this.prisma.$transaction(async (tx) => {
          // Update listing status
          await tx.auctionListing.update({
            where: { id: listing.id },
            data: { status: 'expired' },
          });

          // Update machine status
          await tx.machine.update({
            where: { id: listing.machineId },
            data: { status: 'expired' },
          });
        });

        expiredCount++;
      }
    }

    return expiredCount;
  }
}
