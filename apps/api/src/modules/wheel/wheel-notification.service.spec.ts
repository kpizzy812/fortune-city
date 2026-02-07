import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WheelNotificationService } from './wheel-notification.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('WheelNotificationService', () => {
  let service: WheelNotificationService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WheelNotificationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config: Record<string, string> = {
                TELEGRAM_BOT_TOKEN: 'test-bot-token',
                TELEGRAM_WEBAPP_URL: 'https://app.test.com',
              };
              return config[key] || undefined;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<WheelNotificationService>(WheelNotificationService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true });
  });

  describe('broadcastJackpotWin', () => {
    it('should send notifications to all non-banned users except winner', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { telegramId: 'tg-1', language: 'en' },
        { telegramId: 'tg-2', language: 'ru' },
      ]);

      await service.broadcastJackpotWin({
        winnerId: 'winner-1',
        winnerName: 'Alice',
        amount: 100,
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          id: { not: 'winner-1' },
          isBanned: false,
        },
        select: {
          telegramId: true,
          language: true,
        },
      });

      // 2 users = 2 Telegram API calls
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should skip users without telegramId', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { telegramId: null, language: 'en' }, // email-only user
        { telegramId: 'tg-1', language: 'en' },
      ]);

      await service.broadcastJackpotWin({
        winnerId: 'winner-1',
        winnerName: 'Alice',
        amount: 50,
      });

      // Only 1 user has telegramId
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should use "Someone" when winnerName is null', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { telegramId: 'tg-1', language: 'en' },
      ]);

      await service.broadcastJackpotWin({
        winnerId: 'winner-1',
        winnerName: null,
        amount: 100,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.text).toContain('Someone');
    });

    it('should not send if no users to notify', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      await service.broadcastJackpotWin({
        winnerId: 'winner-1',
        winnerName: 'Alice',
        amount: 100,
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle Telegram API errors gracefully', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { telegramId: 'tg-1', language: 'en' },
        { telegramId: 'tg-2', language: 'en' },
      ]);

      mockFetch
        .mockResolvedValueOnce({ ok: false, text: () => 'Bot blocked' })
        .mockResolvedValueOnce({ ok: true });

      // Should not throw
      await service.broadcastJackpotWin({
        winnerId: 'winner-1',
        winnerName: 'Alice',
        amount: 100,
      });
    });
  });

  describe('broadcastJackpotWin (disabled bot)', () => {
    it('should return early if TELEGRAM_BOT_TOKEN not set', async () => {
      // Create service without bot token
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          WheelNotificationService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
          {
            provide: PrismaService,
            useValue: {
              user: { findMany: jest.fn() },
            },
          },
        ],
      }).compile();

      const serviceNoBotToken = module.get<WheelNotificationService>(
        WheelNotificationService,
      );

      await serviceNoBotToken.broadcastJackpotWin({
        winnerId: 'winner-1',
        winnerName: 'Alice',
        amount: 100,
      });

      // No users queried, no messages sent
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('notifyWinnerPersonally', () => {
    it('should send personal message to winner', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        language: 'ru',
      });

      await service.notifyWinnerPersonally('tg-winner', 500);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId: 'tg-winner' },
        select: { language: true },
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toContain('sendMessage');
      const body = JSON.parse(callArgs[1].body);
      expect(body.chat_id).toBe('tg-winner');
      expect(body.parse_mode).toBe('HTML');
    });

    it('should return early if bot token not set', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          WheelNotificationService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
          {
            provide: PrismaService,
            useValue: {
              user: { findUnique: jest.fn() },
            },
          },
        ],
      }).compile();

      const serviceNoBotToken = module.get<WheelNotificationService>(
        WheelNotificationService,
      );

      await serviceNoBotToken.notifyWinnerPersonally('tg-1', 100);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle Telegram API failure gracefully', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        language: 'en',
      });
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Forbidden: bot was blocked'),
      });

      // Should not throw
      await service.notifyWinnerPersonally('tg-blocked', 100);
    });
  });
});
