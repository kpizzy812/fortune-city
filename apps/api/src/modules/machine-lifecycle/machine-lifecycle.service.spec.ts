import { Test, TestingModule } from '@nestjs/testing';
import { MachineLifecycleService } from './machine-lifecycle.service';
import { MachinesService } from '../machines/machines.service';
import { AutoCollectService } from '../machines/services/auto-collect.service';
import { TierCacheService } from '../machines/services/tier-cache.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MachineLifecycleService', () => {
  let service: MachineLifecycleService;
  let machinesService: jest.Mocked<MachinesService>;
  let notificationsService: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    const mockMachinesService = {
      checkAndExpireMachines: jest.fn(),
      calculateIncome: jest.fn(),
    };

    const mockAutoCollectService = {
      getMachinesForAutoCollect: jest.fn().mockResolvedValue([]),
      executeAutoCollect: jest.fn(),
    };

    const mockTierCacheService = {
      getTier: jest.fn().mockReturnValue({
        name: 'Bronze Slot',
        emoji: '🎰',
      }),
    };

    const mockNotificationsService = {
      notify: jest.fn().mockResolvedValue({}),
    };

    const mockPrismaService = {
      machine: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MachineLifecycleService,
        {
          provide: MachinesService,
          useValue: mockMachinesService,
        },
        {
          provide: AutoCollectService,
          useValue: mockAutoCollectService,
        },
        {
          provide: TierCacheService,
          useValue: mockTierCacheService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MachineLifecycleService>(MachineLifecycleService);
    machinesService = module.get(MachinesService);
    notificationsService = module.get(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleExpiredMachines', () => {
    it('should call checkAndExpireMachines and return count', async () => {
      const expiredMachines = [
        { id: 'm1', userId: 'u1', tier: 1, accumulatedIncome: 100 },
        { id: 'm2', userId: 'u2', tier: 2, accumulatedIncome: 200 },
      ];
      machinesService.checkAndExpireMachines.mockResolvedValue(expiredMachines);

      const result = await service.handleExpiredMachines();

      expect(machinesService.checkAndExpireMachines).toHaveBeenCalledTimes(1);
      expect(result).toBe(2);
    });

    it('should send notifications for each expired machine', async () => {
      const expiredMachines = [
        { id: 'm1', userId: 'u1', tier: 1, accumulatedIncome: 50.5 },
      ];
      machinesService.checkAndExpireMachines.mockResolvedValue(expiredMachines);

      await service.handleExpiredMachines();

      expect(notificationsService.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          type: 'machine_expired',
        }),
      );
    });

    it('should return 0 when no machines expired', async () => {
      machinesService.checkAndExpireMachines.mockResolvedValue([]);

      const result = await service.handleExpiredMachines();

      expect(result).toBe(0);
    });

    it('should propagate errors from machinesService', async () => {
      const error = new Error('Database error');
      machinesService.checkAndExpireMachines.mockRejectedValue(error);

      await expect(service.handleExpiredMachines()).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('triggerExpireCheck', () => {
    it('should call handleExpiredMachines', async () => {
      machinesService.checkAndExpireMachines.mockResolvedValue([
        { id: 'm1', userId: 'u1', tier: 1, accumulatedIncome: 100 },
      ]);

      const result = await service.triggerExpireCheck();

      expect(machinesService.checkAndExpireMachines).toHaveBeenCalled();
      expect(result).toBe(1);
    });
  });
});
