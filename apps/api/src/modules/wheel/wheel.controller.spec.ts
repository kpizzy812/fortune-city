jest.mock('nanoid', () => ({ nanoid: jest.fn(() => 'mock-id') }));
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn().mockReturnValue('mock-jwks'),
  jwtVerify: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { WheelController } from './wheel.controller';
import { WheelService } from './wheel.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('WheelController', () => {
  let controller: WheelController;
  let wheelService: jest.Mocked<WheelService>;

  const mockReq = { user: { sub: 'user-1' } } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WheelController],
      providers: [
        {
          provide: WheelService,
          useValue: {
            spin: jest.fn(),
            getState: jest.fn(),
            getHistory: jest.fn(),
            getJackpotInfo: jest.fn(),
            getRecentWins: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<WheelController>(WheelController);
    wheelService = module.get(WheelService);

    jest.clearAllMocks();
  });

  describe('spin', () => {
    it('should delegate to wheelService.spin', async () => {
      const mockResult = {
        result: 'fortune',
        amount: 10,
        newBalance: 110,
        freeSpinsLeft: 2,
      };
      (wheelService.spin as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.spin(mockReq, { multiplier: 1 });

      expect(result).toEqual(mockResult);
      expect(wheelService.spin).toHaveBeenCalledWith('user-1', 1);
    });
  });

  describe('getState', () => {
    it('should return wheel state for user', async () => {
      const mockState = {
        jackpotPool: 500,
        freeSpinsLeft: 3,
        sectors: [],
      };
      (wheelService.getState as jest.Mock).mockResolvedValue(mockState);

      const result = await controller.getState(mockReq);

      expect(result.jackpotPool).toBe(500);
      expect(wheelService.getState).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getHistory', () => {
    it('should pass default pagination', async () => {
      (wheelService.getHistory as jest.Mock).mockResolvedValue({
        items: [],
        total: 0,
      });

      await controller.getHistory(mockReq);

      expect(wheelService.getHistory).toHaveBeenCalledWith('user-1', 1, 20);
    });

    it('should parse query parameters', async () => {
      (wheelService.getHistory as jest.Mock).mockResolvedValue({
        items: [],
        total: 0,
      });

      await controller.getHistory(mockReq, '3', '10');

      expect(wheelService.getHistory).toHaveBeenCalledWith('user-1', 3, 10);
    });
  });

  describe('getJackpot', () => {
    it('should return jackpot info (public)', async () => {
      const mockJackpot = {
        currentPool: 1000,
        lastWinner: 'Alice',
        lastAmount: 500,
        timesWon: 5,
      };
      (wheelService.getJackpotInfo as jest.Mock).mockResolvedValue(mockJackpot);

      const result = await controller.getJackpot();

      expect(result.currentPool).toBe(1000);
    });
  });

  describe('getRecentWins', () => {
    it('should use default limit of 20', async () => {
      (wheelService.getRecentWins as jest.Mock).mockResolvedValue([]);

      await controller.getRecentWins();

      expect(wheelService.getRecentWins).toHaveBeenCalledWith(20);
    });

    it('should cap limit at 50', async () => {
      (wheelService.getRecentWins as jest.Mock).mockResolvedValue([]);

      await controller.getRecentWins('100');

      expect(wheelService.getRecentWins).toHaveBeenCalledWith(50);
    });

    it('should parse limit from query', async () => {
      (wheelService.getRecentWins as jest.Mock).mockResolvedValue([]);

      await controller.getRecentWins('10');

      expect(wheelService.getRecentWins).toHaveBeenCalledWith(10);
    });
  });
});
