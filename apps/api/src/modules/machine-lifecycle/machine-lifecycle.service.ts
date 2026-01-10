import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MachinesService } from '../machines/machines.service';

@Injectable()
export class MachineLifecycleService {
  private readonly logger = new Logger(MachineLifecycleService.name);

  constructor(private readonly machinesService: MachinesService) {}

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
}
