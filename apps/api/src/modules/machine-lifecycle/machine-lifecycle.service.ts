import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MachinesService } from '../machines/machines.service';
import { AutoCollectService } from '../machines/services/auto-collect.service';

@Injectable()
export class MachineLifecycleService {
  private readonly logger = new Logger(MachineLifecycleService.name);

  constructor(
    private readonly machinesService: MachinesService,
    private readonly autoCollectService: AutoCollectService,
  ) {}

  /**
   * Cron job that runs every 5 minutes to check for expired machines.
   * Marks machines as 'expired' when their lifespan ends.
   * Players collect remaining coins manually via collectCoins().
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleExpiredMachines(): Promise<number> {
    this.logger.debug('Checking for expired machines...');

    try {
      const count = await this.machinesService.checkAndExpireMachines();

      if (count > 0) {
        this.logger.log(`Marked ${count} machine(s) as expired`);
      }

      return count;
    } catch (error) {
      this.logger.error('Failed to process expired machines', error);
      throw error;
    }
  }

  /**
   * Manual trigger for expiry check (useful for testing and admin actions)
   */
  async triggerExpireCheck(): Promise<number> {
    return this.handleExpiredMachines();
  }

  /**
   * Cron job that runs every 2 minutes to auto-collect full coin boxes.
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
}
