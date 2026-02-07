import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityItem } from './dto/activity.dto';

// Seed names (masked format)
const SEED_NAMES = [
  'Al***ex', 'Vi***or', 'Ni***ai', 'An***ey', 'Se***ey',
  'Di***ry', 'Ma***im', 'Pa***el', 'Ar***em', 'Iv***an',
  'Da***la', 'Mi***el', 'Ol***eg', 'Ro***an', 'Ti***ey',
];

const MIN_SEED_ITEMS = 15;

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async getFeed(limit: number = 30): Promise<ActivityItem[]> {
    const items: ActivityItem[] = [];
    const perType = Math.ceil(limit / 3);

    // 1. Recent machine purchases
    const purchases = await this.prisma.transaction.findMany({
      where: { type: 'machine_purchase' },
      orderBy: { createdAt: 'desc' },
      take: perType,
      include: {
        user: { select: { username: true, firstName: true } },
        machine: { select: { tier: true } },
      },
    });

    for (const p of purchases) {
      items.push({
        type: 'machine_purchase',
        username: this.maskUsername(p.user.username || p.user.firstName || 'Player'),
        amount: Math.abs(Number(p.amount)),
        tier: p.machine?.tier,
        createdAt: p.createdAt.toISOString(),
      });
    }

    // 2. Recent completed withdrawals
    const withdrawals = await this.prisma.withdrawal.findMany({
      where: { status: 'completed' },
      orderBy: { createdAt: 'desc' },
      take: perType,
      include: {
        user: { select: { username: true, firstName: true } },
      },
    });

    for (const w of withdrawals) {
      items.push({
        type: 'withdrawal',
        username: this.maskUsername(w.user.username || w.user.firstName || 'Player'),
        amount: Number(w.usdtAmount),
        createdAt: w.createdAt.toISOString(),
      });
    }

    // 3. Recent wheel wins
    const wins = await this.prisma.wheelSpin.findMany({
      where: { netResult: { gt: 0 } },
      orderBy: { createdAt: 'desc' },
      take: perType,
    });

    if (wins.length > 0) {
      const userIds = [...new Set(wins.map((w) => w.userId))];
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true, firstName: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));

      for (const w of wins) {
        const user = userMap.get(w.userId);
        items.push({
          type: w.jackpotWon ? 'jackpot' : 'wheel_win',
          username: this.maskUsername(
            user?.username || user?.firstName || 'Player',
          ),
          amount: Number(w.totalPayout),
          multiplier: this.extractTopMultiplier(w.spinResults),
          createdAt: w.createdAt.toISOString(),
        });
      }
    }

    // Fill with seed data if not enough real items
    if (items.length < MIN_SEED_ITEMS) {
      items.push(...this.generateSeedData(MIN_SEED_ITEMS - items.length));
    }

    // Sort by time descending, limit
    return items
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, limit);
  }

  private generateSeedData(count: number): ActivityItem[] {
    const now = Date.now();
    const types: ActivityItem['type'][] = [
      'machine_purchase',
      'withdrawal',
      'wheel_win',
      'machine_purchase',
      'wheel_win',
    ];

    return Array.from({ length: count }, (_, i) => {
      const type = types[i % types.length];
      const minutesAgo = 3 + Math.floor(Math.random() * 55); // 3-58 min ago

      return {
        type,
        username: SEED_NAMES[i % SEED_NAMES.length],
        amount:
          type === 'machine_purchase'
            ? [10, 10, 30, 30, 80][Math.floor(Math.random() * 5)]
            : type === 'withdrawal'
              ? Math.floor(Math.random() * 150) + 15
              : Math.floor(Math.random() * 8) + 1,
        tier:
          type === 'machine_purchase'
            ? [1, 1, 1, 2, 2, 3][Math.floor(Math.random() * 6)]
            : undefined,
        multiplier:
          type === 'wheel_win'
            ? ['1.5x', '2x', '2x', '5x'][Math.floor(Math.random() * 4)]
            : undefined,
        createdAt: new Date(now - minutesAgo * 60000).toISOString(),
      };
    });
  }

  private maskUsername(name: string): string {
    if (name.length <= 3) return name[0] + '***';
    return name.substring(0, 2) + '***' + name.substring(name.length - 2);
  }

  private extractTopMultiplier(spinResults: unknown): string | undefined {
    try {
      const results = spinResults as { multiplier: number }[];
      if (!Array.isArray(results) || results.length === 0) return undefined;
      const maxMult = Math.max(...results.map((r) => r.multiplier || 0));
      return maxMult > 0 ? `${maxMult}x` : undefined;
    } catch {
      return undefined;
    }
  }
}
