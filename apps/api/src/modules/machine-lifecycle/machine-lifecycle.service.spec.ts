import { Test, TestingModule } from '@nestjs/testing';
import { MachineLifecycleService } from './machine-lifecycle.service';
import { MachinesService } from '../machines/machines.service';

describe('MachineLifecycleService', () => {
  let service: MachineLifecycleService;
  let machinesService: jest.Mocked<MachinesService>;

  beforeEach(async () => {
    const mockMachinesService = {
      checkAndExpireMachines: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MachineLifecycleService,
        {
          provide: MachinesService,
          useValue: mockMachinesService,
        },
      ],
    }).compile();

    service = module.get<MachineLifecycleService>(MachineLifecycleService);
    machinesService = module.get(MachinesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleExpiredMachines', () => {
    it('should call checkAndExpireMachines and return count', async () => {
      machinesService.checkAndExpireMachines.mockResolvedValue(5);

      const result = await service.handleExpiredMachines();

      expect(machinesService.checkAndExpireMachines).toHaveBeenCalledTimes(1);
      expect(result).toBe(5);
    });

    it('should return 0 when no machines expired', async () => {
      machinesService.checkAndExpireMachines.mockResolvedValue(0);

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
      machinesService.checkAndExpireMachines.mockResolvedValue(3);

      const result = await service.triggerExpireCheck();

      expect(machinesService.checkAndExpireMachines).toHaveBeenCalled();
      expect(result).toBe(3);
    });
  });
});
