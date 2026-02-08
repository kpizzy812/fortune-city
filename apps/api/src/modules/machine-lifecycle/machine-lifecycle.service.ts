import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MachinesService } from '../machines/machines.service';
import { AutoCollectService } from '../machines/services/auto-collect.service';
import { TierCacheService } from '../machines/services/tier-cache.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MachineLifecycleService {
  private readonly logger = new Logger(MachineLifecycleService.name);

  constructor(
    private readonly machinesService: MachinesService,
    private readonly autoCollectService: AutoCollectService,
    private readonly tierCacheService: TierCacheService,
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Cron job that runs every 5 minutes to check for expired machines.
   * Marks machines as 'expired' when their lifespan ends.
   * Sends machine_expired notification to each owner.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleExpiredMachines(): Promise<number> {
    this.logger.debug('Checking for expired machines...');

    try {
      const expired = await this.machinesService.checkAndExpireMachines();

      if (expired.length > 0) {
        this.logger.log(`Marked ${expired.length} machine(s) as expired`);
      }

      // Send notifications (non-blocking)
      for (const machine of expired) {
        const tierName = this.getTierName(machine.tier);
        const { title, message } = NotificationsService.formatNotification(
          'machine_expired',
          {
            tierName,
            totalEarned: machine.accumulatedIncome.toFixed(2),
            machineId: machine.id,
          },
        );

        this.notificationsService
          .notify({
            userId: machine.userId,
            type: 'machine_expired',
            title,
            message,
            data: {
              tierName,
              totalEarned: machine.accumulatedIncome.toFixed(2),
              machineId: machine.id,
            },
          })
          .catch((err) =>
            this.logger.error(
              `Failed to notify machine_expired for ${machine.id}`,
              err,
            ),
          );
      }

      return expired.length;
    } catch (error) {
      this.logger.error('Failed to process expired machines', error);
      throw error;
    }
  }

  /**
   * Cron job that runs every 30 minutes to warn about expiring machines (24h).
   * Sends machine_expired_soon notification once per machine.
   */
  @Cron('0 */30 * * * *')
  async handleExpiringSoonMachines(): Promise<number> {
    this.logger.debug('Checking for machines expiring soon...');

    try {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const machines = await this.prisma.machine.findMany({
        where: {
          status: 'active',
          expiresAt: { gt: now, lte: in24h },
          expireSoonNotifiedAt: null,
        },
      });

      if (machines.length === 0) return 0;

      this.logger.log(
        `Found ${machines.length} machine(s) expiring within 24h`,
      );

      for (const machine of machines) {
        const tierName = this.getTierName(machine.tier);
        const { title, message } = NotificationsService.formatNotification(
          'machine_expired_soon',
          { tierName, machineId: machine.id },
        );

        // Mark as notified first to avoid duplicates on failure
        await this.prisma.machine.update({
          where: { id: machine.id },
          data: { expireSoonNotifiedAt: now },
        });

        this.notificationsService
          .notify({
            userId: machine.userId,
            type: 'machine_expired_soon',
            title,
            message,
            data: { tierName, machineId: machine.id },
          })
          .catch((err) =>
            this.logger.error(
              `Failed to notify machine_expired_soon for ${machine.id}`,
              err,
            ),
          );
      }

      return machines.length;
    } catch (error) {
      this.logger.error('Failed to process expiring soon machines', error);
      return 0;
    }
  }

  /**
   * Cron job that runs every 30 minutes to check coin box fill levels.
   * Sends coin_box_almost_full (90%) and coin_box_full (100%) notifications.
   * Only for machines WITHOUT auto-collect (auto-collected boxes stay empty).
   */
  @Cron('0 */30 * * * *')
  async handleCoinBoxAlerts(): Promise<number> {
    this.logger.debug('Checking coin box fill levels...');

    try {
      // Only check machines without auto-collect — those with it never fill up
      const machines = await this.prisma.machine.findMany({
        where: {
          status: 'active',
          autoCollectEnabled: false,
        },
      });

      if (machines.length === 0) return 0;

      let notified = 0;

      for (const machine of machines) {
        const capacity = Number(machine.coinBoxCapacity);
        if (capacity <= 0) continue;

        const incomeState = await this.machinesService.calculateIncome(
          machine.id,
        );
        const fillPercent = incomeState.coinBoxCurrent / capacity;

        const tierName = this.getTierName(machine.tier);

        // 100% full — notify once
        if (fillPercent >= 1 && !machine.coinBoxFullNotifiedAt) {
          const { title, message } = NotificationsService.formatNotification(
            'coin_box_full',
            { tierName, machineId: machine.id },
          );

          await this.prisma.machine.update({
            where: { id: machine.id },
            data: { coinBoxFullNotifiedAt: new Date() },
          });

          this.notificationsService
            .notify({
              userId: machine.userId,
              type: 'coin_box_full',
              title,
              message,
              data: { tierName, machineId: machine.id },
            })
            .catch((err) =>
              this.logger.error(
                `Failed to notify coin_box_full for ${machine.id}`,
                err,
              ),
            );

          notified++;
        }
        // 90%+ — notify once (only if not already full-notified)
        else if (
          fillPercent >= 0.9 &&
          !machine.coinBoxAlmostFullNotifiedAt &&
          !machine.coinBoxFullNotifiedAt
        ) {
          const { title, message } = NotificationsService.formatNotification(
            'coin_box_almost_full',
            { tierName, machineId: machine.id },
          );

          await this.prisma.machine.update({
            where: { id: machine.id },
            data: { coinBoxAlmostFullNotifiedAt: new Date() },
          });

          this.notificationsService
            .notify({
              userId: machine.userId,
              type: 'coin_box_almost_full',
              title,
              message,
              data: { tierName, machineId: machine.id },
            })
            .catch((err) =>
              this.logger.error(
                `Failed to notify coin_box_almost_full for ${machine.id}`,
                err,
              ),
            );

          notified++;
        }
      }

      if (notified > 0) {
        this.logger.log(`Sent ${notified} coin box alert(s)`);
      }

      return notified;
    } catch (error) {
      this.logger.error('Failed to process coin box alerts', error);
      return 0;
    }
  }

  /**
   * Manual trigger for expiry check (useful for testing and admin actions)
   */
  async triggerExpireCheck(): Promise<number> {
    return this.handleExpiredMachines();
  }

  /**
   * Cron job that runs every 30 seconds to auto-collect full coin boxes.
   * Collects coins from machines with Auto Collect module enabled.
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleAutoCollect(): Promise<number> {
    this.logger.debug('Running auto-collect for machines...');

    try {
      const results = await this.autoCollectService.executeAutoCollectForAll();

      if (results.length > 0) {
        const totalCollected = results.reduce(
          (sum, r) => sum + r.amountCollected,
          0,
        );
        this.logger.log(
          `Auto-collected ${totalCollected.toFixed(2)} $FORTUNE from ${results.length} machine(s)`,
        );
      }

      return results.length;
    } catch (error) {
      this.logger.error('Failed to process auto-collect', error);
      throw error;
    }
  }

  /**
   * Manual trigger for auto-collect (useful for testing and admin actions)
   */
  async triggerAutoCollect(): Promise<number> {
    return this.handleAutoCollect();
  }

  private getTierName(tier: number): string {
    const config = this.tierCacheService.getTier(tier);
    return config ? `${config.emoji} ${config.name}` : `Tier ${tier}`;
  }
}
