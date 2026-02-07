jest.mock('nanoid', () => ({ nanoid: jest.fn(() => 'mock-id') }));
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn().mockReturnValue('mock-jwks'),
  jwtVerify: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from './withdrawals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('WithdrawalsController', () => {
  let controller: WithdrawalsController;
  let withdrawalsService: jest.Mocked<WithdrawalsService>;

  const mockUser = { sub: 'user-1' } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WithdrawalsController],
      providers: [
        {
          provide: WithdrawalsService,
          useValue: {
            previewWithdrawal: jest.fn(),
            prepareAtomicWithdrawal: jest.fn(),
            confirmAtomicWithdrawal: jest.fn(),
            cancelAtomicWithdrawal: jest.fn(),
            createInstantWithdrawal: jest.fn(),
            getUserWithdrawals: jest.fn(),
            getWithdrawalById: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<WithdrawalsController>(WithdrawalsController);
    withdrawalsService = module.get(WithdrawalsService);

    jest.clearAllMocks();
  });

  describe('previewWithdrawal', () => {
    it('should delegate to withdrawalsService.previewWithdrawal', async () => {
      const mockPreview = {
        amount: 100,
        taxRate: 0.5,
        taxAmount: 50,
        netAmount: 50,
      };
      (withdrawalsService.previewWithdrawal as jest.Mock).mockResolvedValue(
        mockPreview,
      );

      const result = await controller.previewWithdrawal(mockUser, 100);

      expect(result).toEqual(mockPreview);
      expect(withdrawalsService.previewWithdrawal).toHaveBeenCalledWith(
        'user-1',
        100,
      );
    });
  });

  describe('prepareAtomicWithdrawal', () => {
    it('should delegate to withdrawalsService.prepareAtomicWithdrawal', async () => {
      const mockResult = {
        withdrawalId: 'wd-1',
        serializedTransaction: 'base64tx',
      };
      (
        withdrawalsService.prepareAtomicWithdrawal as jest.Mock
      ).mockResolvedValue(mockResult);

      const result = await controller.prepareAtomicWithdrawal(mockUser, {
        amount: 100,
        walletAddress: 'wallet-1',
      } as any);

      expect(result.withdrawalId).toBe('wd-1');
      expect(withdrawalsService.prepareAtomicWithdrawal).toHaveBeenCalledWith(
        'user-1',
        100,
        'wallet-1',
      );
    });
  });

  describe('confirmAtomicWithdrawal', () => {
    it('should delegate to withdrawalsService.confirmAtomicWithdrawal', async () => {
      const mockResult = { id: 'wd-1', status: 'confirmed' };
      (
        withdrawalsService.confirmAtomicWithdrawal as jest.Mock
      ).mockResolvedValue(mockResult);

      const result = await controller.confirmAtomicWithdrawal(mockUser, {
        withdrawalId: 'wd-1',
        txSignature: 'sig-1',
      });

      expect(result.status).toBe('confirmed');
    });
  });

  describe('cancelAtomicWithdrawal', () => {
    it('should delegate to withdrawalsService.cancelAtomicWithdrawal', async () => {
      const mockResult = { id: 'wd-1', status: 'cancelled' };
      (
        withdrawalsService.cancelAtomicWithdrawal as jest.Mock
      ).mockResolvedValue(mockResult);

      const result = await controller.cancelAtomicWithdrawal(mockUser, 'wd-1');

      expect(result.status).toBe('cancelled');
    });
  });

  describe('createInstantWithdrawal', () => {
    it('should delegate to withdrawalsService.createInstantWithdrawal', async () => {
      const mockResult = {
        id: 'wd-1',
        status: 'processing',
        txSignature: 'sig-1',
      };
      (
        withdrawalsService.createInstantWithdrawal as jest.Mock
      ).mockResolvedValue(mockResult);

      const result = await controller.createInstantWithdrawal(mockUser, {
        amount: 50,
        recipientAddress: 'wallet-1',
      } as any);

      expect(result.status).toBe('processing');
      expect(withdrawalsService.createInstantWithdrawal).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          amount: 50,
          method: 'manual_address',
        }),
      );
    });
  });

  describe('getWithdrawals', () => {
    it('should return user withdrawals with pagination', async () => {
      (withdrawalsService.getUserWithdrawals as jest.Mock).mockResolvedValue([
        { id: 'wd-1' },
        { id: 'wd-2' },
      ]);

      const result = await controller.getWithdrawals(mockUser, 10, 0);

      expect(result).toHaveLength(2);
      expect(withdrawalsService.getUserWithdrawals).toHaveBeenCalledWith(
        'user-1',
        10,
        0,
      );
    });
  });

  describe('getWithdrawalById', () => {
    it('should return single withdrawal', async () => {
      (withdrawalsService.getWithdrawalById as jest.Mock).mockResolvedValue({
        id: 'wd-1',
        status: 'completed',
      });

      const result = await controller.getWithdrawalById(mockUser, 'wd-1');

      expect(result.id).toBe('wd-1');
    });
  });
});
