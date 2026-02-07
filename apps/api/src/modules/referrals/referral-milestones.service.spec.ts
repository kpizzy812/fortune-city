import { Test, TestingModule } from '@nestjs/testing';
import { ReferralMilestonesService } from './referral-milestones.service';
import { PrismaService } from '../prisma/prisma.service';
import { MachinesService } from '../machines/machines.service';

describe('ReferralMilestonesService', () => {
  let service: ReferralMilestonesService;
  let prisma: jest.Mocked<PrismaService>;
  let machinesService: jest.Mocked<MachinesService>;

  const mockUserId = 'user-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralMilestonesService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              count: jest.fn(),
              update: jest.fn(),
            },
            referralMilestone: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: MachinesService,
          useValue: {
            createFreeMachine: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReferralMilestonesService>(ReferralMilestonesService);
    prisma = module.get(PrismaService);
    machinesService = module.get(MachinesService);

    jest.clearAllMocks();
  });

  describe('getMilestoneProgress', () => {
    it('should return all milestones with progress', async () => {
      (prisma.user.count as jest.Mock).mockResolvedValue(3);
      (prisma.referralMilestone.findMany as jest.Mock).mockResolvedValue([]);

      const progress = await service.getMilestoneProgress(mockUserId);

      expect(progress.activeReferrals).toBe(3);
      expect(progress.milestones).toHaveLength(4);

      // None should be claimable (3 < 5 threshold)
      expect(progress.milestones[0].canClaim).toBe(false);
      expect(progress.milestones[0].claimed).toBe(false);
    });

    it('should mark milestone as claimable when threshold met', async () => {
      (prisma.user.count as jest.Mock).mockResolvedValue(7);
      (prisma.referralMilestone.findMany as jest.Mock).mockResolvedValue([]);

      const progress = await service.getMilestoneProgress(mockUserId);

      expect(progress.activeReferrals).toBe(7);
      // 5_refs should be claimable
      expect(progress.milestones[0].canClaim).toBe(true);
      // 15_refs should not
      expect(progress.milestones[1].canClaim).toBe(false);
    });

    it('should mark milestone as claimed', async () => {
      (prisma.user.count as jest.Mock).mockResolvedValue(10);
      (prisma.referralMilestone.findMany as jest.Mock).mockResolvedValue([
        { milestone: '5_refs', claimedAt: new Date('2024-01-15') },
      ]);

      const progress = await service.getMilestoneProgress(mockUserId);

      expect(progress.milestones[0].claimed).toBe(true);
      expect(progress.milestones[0].canClaim).toBe(false);
      expect(progress.milestones[0].claimedAt).toBeDefined();
    });
  });

  describe('claimMilestone', () => {
    it('should throw for invalid milestone', async () => {
      await expect(
        service.claimMilestone(mockUserId, 'invalid_milestone'),
      ).rejects.toThrow('Invalid milestone');
    });

    it('should throw if already claimed', async () => {
      (prisma.referralMilestone.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing',
      });

      await expect(
        service.claimMilestone(mockUserId, '5_refs'),
      ).rejects.toThrow('Milestone already claimed');
    });

    it('should throw if threshold not met', async () => {
      (prisma.referralMilestone.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (prisma.user.count as jest.Mock).mockResolvedValue(3); // < 5

      await expect(
        service.claimMilestone(mockUserId, '5_refs'),
      ).rejects.toThrow('Need 5 active referrals, have 3');
    });

    it('should claim free_machine_tier1 milestone', async () => {
      (prisma.referralMilestone.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (prisma.user.count as jest.Mock).mockResolvedValue(6);

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          referralMilestone: { create: jest.fn() },
          user: { update: jest.fn() },
        };
        await cb(tx);
      });
      machinesService.createFreeMachine.mockResolvedValue({ id: 'm-1' } as any);

      const result = await service.claimMilestone(mockUserId, '5_refs');

      expect(result.success).toBe(true);
      expect(result.reward).toBe('free_machine_tier1');
    });

    it('should claim tax_discount_5 milestone', async () => {
      (prisma.referralMilestone.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (prisma.user.count as jest.Mock).mockResolvedValue(20);

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          referralMilestone: { create: jest.fn() },
          user: { update: jest.fn() },
        };
        await cb(tx);
      });

      const result = await service.claimMilestone(mockUserId, '15_refs');

      expect(result.success).toBe(true);
      expect(result.reward).toBe('tax_discount_5');
    });

    it('should claim vip milestone', async () => {
      (prisma.referralMilestone.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (prisma.user.count as jest.Mock).mockResolvedValue(600);

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          referralMilestone: { create: jest.fn() },
          user: { update: jest.fn() },
        };
        await cb(tx);
      });

      const result = await service.claimMilestone(mockUserId, '500_refs');

      expect(result.success).toBe(true);
      expect(result.reward).toBe('vip');
    });
  });
});
