import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MachinesService } from '../machines/machines.service';
import { Prisma } from '@prisma/client';

/** Milestone definitions: activeRefs threshold → reward */
const MILESTONES = [
  {
    milestone: '5_refs',
    threshold: 5,
    reward: 'free_machine_tier1',
    description: 'Free Rusty Lever (Tier 1)',
  },
  {
    milestone: '15_refs',
    threshold: 15,
    reward: 'tax_discount_5',
    description: '-5% city fee forever',
  },
  {
    milestone: '50_refs',
    threshold: 50,
    reward: 'free_machine_tier2',
    description: 'Free Lucky Cherry (Tier 2)',
  },
  {
    milestone: '500_refs',
    threshold: 500,
    reward: 'vip',
    description: 'VIP status',
  },
] as const;

export interface MilestoneStatus {
  milestone: string;
  threshold: number;
  reward: string;
  description: string;
  claimed: boolean;
  claimedAt: string | null;
  /** Can be claimed right now (threshold met, not yet claimed) */
  canClaim: boolean;
}

export interface MilestoneProgress {
  activeReferrals: number;
  milestones: MilestoneStatus[];
}

@Injectable()
export class ReferralMilestonesService {
  private readonly logger = new Logger(ReferralMilestonesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => MachinesService))
    private readonly machinesService: MachinesService,
  ) {}

  /**
   * Get milestone progress for a user
   */
  async getMilestoneProgress(userId: string): Promise<MilestoneProgress> {
    const [activeCount, claimed] = await Promise.all([
      this.countActiveReferrals(userId),
      this.prisma.referralMilestone.findMany({
        where: { userId },
        select: { milestone: true, claimedAt: true },
      }),
    ]);

    const claimedMap = new Map(claimed.map((c) => [c.milestone, c.claimedAt]));

    const milestones: MilestoneStatus[] = MILESTONES.map((m) => {
      const claimedAt = claimedMap.get(m.milestone);
      return {
        milestone: m.milestone,
        threshold: m.threshold,
        reward: m.reward,
        description: m.description,
        claimed: !!claimedAt,
        claimedAt: claimedAt?.toISOString() ?? null,
        canClaim: !claimedAt && activeCount >= m.threshold,
      };
    });

    return { activeReferrals: activeCount, milestones };
  }

  /**
   * Claim a specific milestone reward
   */
  async claimMilestone(
    userId: string,
    milestoneId: string,
  ): Promise<{ success: boolean; reward: string }> {
    const definition = MILESTONES.find((m) => m.milestone === milestoneId);
    if (!definition) {
      throw new Error('Invalid milestone');
    }

    // Check if already claimed (@@unique protects against race too)
    const existing = await this.prisma.referralMilestone.findUnique({
      where: { userId_milestone: { userId, milestone: milestoneId } },
    });
    if (existing) {
      throw new Error('Milestone already claimed');
    }

    // Verify threshold met
    const activeCount = await this.countActiveReferrals(userId);
    if (activeCount < definition.threshold) {
      throw new Error(
        `Need ${definition.threshold} active referrals, have ${activeCount}`,
      );
    }

    // Award the reward within a transaction
    await this.prisma.$transaction(async (tx) => {
      // Record milestone
      await tx.referralMilestone.create({
        data: {
          userId,
          milestone: milestoneId,
          reward: definition.reward,
        },
      });

      // Apply reward
      switch (definition.reward) {
        case 'free_machine_tier1':
          await this.awardFreeMachine(userId, 1, tx);
          break;
        case 'free_machine_tier2':
          await this.awardFreeMachine(userId, 2, tx);
          break;
        case 'tax_discount_5':
          await tx.user.update({
            where: { id: userId },
            data: { taxDiscount: new Prisma.Decimal(0.05) },
          });
          break;
        case 'vip':
          // VIP status — для будущей реализации
          // Пока просто записываем milestone
          this.logger.log(`User ${userId} achieved VIP status`);
          break;
      }
    });

    this.logger.log(
      `User ${userId} claimed milestone ${milestoneId} → ${definition.reward}`,
    );

    return { success: true, reward: definition.reward };
  }

  /**
   * Count active referrals (direct line 1 only — users who purchased a machine)
   */
  private async countActiveReferrals(userId: string): Promise<number> {
    // Active = has at least one machine (purchased with own funds)
    const count = await this.prisma.user.count({
      where: {
        referredById: userId,
        machines: { some: {} },
      },
    });
    return count;
  }

  /**
   * Create a free machine for the user as milestone reward
   */
  private async awardFreeMachine(
    userId: string,
    tier: number,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    // Use machines service logic to create properly configured machine
    const machine = await this.machinesService.createFreeMachine(
      userId,
      tier,
      tx,
    );
    this.logger.log(
      `Awarded free tier ${tier} machine ${machine.id} to user ${userId}`,
    );
  }
}
