import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramBotService } from '../telegram-bot/telegram-bot.service';
import { NotificationsGateway } from './notifications.gateway';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: jest.Mocked<PrismaService>;
  let gateway: jest.Mocked<NotificationsGateway>;

  const mockUserId = 'user-123';

  const createMockNotification = (overrides = {}) => ({
    id: 'notif-1',
    userId: mockUserId,
    type: 'deposit_credited' as const,
    title: 'Deposit Credited',
    message: '$100 has been added',
    data: { amount: 100 },
    channels: ['in_app', 'telegram'],
    readAt: null,
    sentToTelegramAt: null,
    telegramError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: {
            notification: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: TelegramBotService,
          useValue: {
            sendMessage: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: NotificationsGateway,
          useValue: {
            emitNotificationToUser: jest.fn(),
            emitNotificationRead: jest.fn(),
            emitAllNotificationsRead: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prisma = module.get(PrismaService);
    gateway = module.get(NotificationsGateway);

    jest.clearAllMocks();
  });

  describe('notify', () => {
    it('should create notification and emit via WebSocket', async () => {
      const notif = createMockNotification();
      (prisma.notification.create as jest.Mock).mockResolvedValue(notif);

      const result = await service.notify({
        userId: mockUserId,
        type: 'deposit_credited',
        title: 'Deposit Credited',
        message: '$100 has been added',
        data: { amount: 100 },
      });

      expect(result.id).toBe('notif-1');
      expect(prisma.notification.create).toHaveBeenCalled();
      expect(gateway.emitNotificationToUser).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({ id: 'notif-1' }),
      );
    });

    it('should use default channels if not specified', async () => {
      const notif = createMockNotification();
      (prisma.notification.create as jest.Mock).mockResolvedValue(notif);

      await service.notify({
        userId: mockUserId,
        type: 'deposit_credited',
        title: 'Test',
        message: 'Test',
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          channels: ['in_app', 'telegram'],
        }),
      });
    });
  });

  describe('getNotifications', () => {
    it('should return paginated notifications', async () => {
      const notifs = [createMockNotification()];
      (prisma.notification.findMany as jest.Mock).mockResolvedValue(notifs);
      (prisma.notification.count as jest.Mock)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);

      const result = await service.getNotifications(mockUserId, {});

      expect(result.notifications).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.unreadCount).toBe(1);
    });

    it('should filter by type', async () => {
      (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.notification.count as jest.Mock).mockResolvedValue(0);

      await service.getNotifications(mockUserId, {
        type: 'deposit_credited' as any,
      });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'deposit_credited' }),
        }),
      );
    });

    it('should filter unread only', async () => {
      (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.notification.count as jest.Mock).mockResolvedValue(0);

      await service.getNotifications(mockUserId, { unreadOnly: 'true' });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ readAt: null }),
        }),
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const notif = createMockNotification();
      const readNotif = { ...notif, readAt: new Date() };
      (prisma.notification.findFirst as jest.Mock).mockResolvedValue(notif);
      (prisma.notification.update as jest.Mock).mockResolvedValue(readNotif);

      const result = await service.markAsRead('notif-1', mockUserId);

      expect(result.readAt).toBeDefined();
      expect(gateway.emitNotificationRead).toHaveBeenCalledWith(
        mockUserId,
        'notif-1',
      );
    });

    it('should throw NotFoundException if not found', async () => {
      (prisma.notification.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.markAsRead('notif-1', mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return without update if already read', async () => {
      const notif = createMockNotification({ readAt: new Date() });
      (prisma.notification.findFirst as jest.Mock).mockResolvedValue(notif);

      const result = await service.markAsRead('notif-1', mockUserId);

      expect(prisma.notification.update).not.toHaveBeenCalled();
      expect(result.readAt).toBeDefined();
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread as read', async () => {
      (prisma.notification.updateMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      const result = await service.markAllAsRead(mockUserId);

      expect(result.count).toBe(3);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUserId, readAt: null },
        data: { readAt: expect.any(Date) },
      });
      expect(gateway.emitAllNotificationsRead).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      (prisma.notification.count as jest.Mock).mockResolvedValue(5);

      const result = await service.getUnreadCount(mockUserId);

      expect(result).toBe(5);
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId: mockUserId, readAt: null },
      });
    });
  });

  describe('formatNotification', () => {
    it('should format deposit_credited', () => {
      const result = NotificationsService.formatNotification(
        'deposit_credited',
        {
          amount: 100,
        },
      );

      expect(result.title).toContain('Deposit');
      expect(result.message).toContain('100');
    });

    it('should format machine_expired', () => {
      const result = NotificationsService.formatNotification(
        'machine_expired',
        {
          tierName: 'GOLDEN 7s',
          totalEarned: 50,
        },
      );

      expect(result.title).toContain('Machine Expired');
      expect(result.message).toContain('GOLDEN 7s');
    });

    it('should format wheel_jackpot_won', () => {
      const result = NotificationsService.formatNotification(
        'wheel_jackpot_won',
        {
          amount: 500,
        },
      );

      expect(result.title).toContain('JACKPOT');
      expect(result.message).toContain('500');
    });

    it('should handle unknown type', () => {
      const result = NotificationsService.formatNotification(
        'unknown_type' as any,
        {},
      );

      expect(result.title).toBe('Notification');
    });
  });
});
