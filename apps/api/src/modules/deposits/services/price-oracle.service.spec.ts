import { Test, TestingModule } from '@nestjs/testing';
import { PriceOracleService } from './price-oracle.service';
import { FortuneRateService } from '../../fortune-rate/fortune-rate.service';
import { ConfigService } from '@nestjs/config';

describe('PriceOracleService', () => {
  let service: PriceOracleService;
  let fortuneRateService: jest.Mocked<FortuneRateService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceOracleService,
        {
          provide: FortuneRateService,
          useValue: {
            ensureFreshSolPrice: jest.fn(),
            getRate: jest.fn(),
            isRateAvailable: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(null),
          },
        },
      ],
    }).compile();

    service = module.get<PriceOracleService>(PriceOracleService);
    fortuneRateService = module.get(FortuneRateService);

    jest.clearAllMocks();
  });

  describe('getSolPrice', () => {
    it('should return SOL price', async () => {
      fortuneRateService.ensureFreshSolPrice.mockResolvedValue(200);

      const price = await service.getSolPrice();

      expect(price).toBe(200);
    });

    it('should throw if SOL price is 0', async () => {
      fortuneRateService.ensureFreshSolPrice.mockResolvedValue(0);

      await expect(service.getSolPrice()).rejects.toThrow(
        'SOL price unavailable',
      );
    });
  });

  describe('getFortunePrice', () => {
    it('should return FORTUNE price', () => {
      fortuneRateService.getRate.mockReturnValue({
        priceInUsd: 0.005,
        priceInSol: 0.000025,
        marketCap: 500000,
        timestamp: Date.now(),
      });

      const price = service.getFortunePrice();

      expect(price).toBe(0.005);
    });

    it('should throw if rate unavailable', () => {
      fortuneRateService.getRate.mockReturnValue(null);

      expect(() => service.getFortunePrice()).toThrow(
        'FORTUNE price unavailable',
      );
    });
  });

  describe('getRates', () => {
    it('should return all rates', async () => {
      fortuneRateService.ensureFreshSolPrice.mockResolvedValue(200);
      fortuneRateService.getRate.mockReturnValue({
        priceInUsd: 0.005,
        priceInSol: 0.000025,
        marketCap: 500000,
        timestamp: Date.now(),
      });

      const rates = await service.getRates();

      expect(rates.sol).toBe(200);
      expect(rates.fortune).toBe(0.005);
      expect(rates.usdt).toBe(1);
    });

    it('should return null for fortune if unavailable', async () => {
      fortuneRateService.ensureFreshSolPrice.mockResolvedValue(200);
      fortuneRateService.getRate.mockReturnValue(null);

      const rates = await service.getRates();

      expect(rates.fortune).toBeNull();
    });
  });

  describe('isFortuneRateAvailable', () => {
    it('should delegate to FortuneRateService', () => {
      fortuneRateService.isRateAvailable.mockReturnValue(true);

      expect(service.isFortuneRateAvailable()).toBe(true);
    });
  });

  describe('convertToUsd', () => {
    it('should convert USDT 1:1', async () => {
      const result = await service.convertToUsd('USDT_SOL', 100);

      expect(result).toBe(100);
    });

    it('should convert SOL using price', async () => {
      fortuneRateService.ensureFreshSolPrice.mockResolvedValue(200);

      const result = await service.convertToUsd('SOL', 1.5);

      expect(result).toBe(300);
    });

    it('should convert FORTUNE using price', async () => {
      fortuneRateService.getRate.mockReturnValue({
        priceInUsd: 0.005,
        priceInSol: 0.000025,
        marketCap: 500000,
        timestamp: Date.now(),
      });

      const result = await service.convertToUsd('FORTUNE', 1000);

      expect(result).toBe(5);
    });
  });
});
