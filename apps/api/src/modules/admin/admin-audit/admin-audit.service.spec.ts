import { Test, TestingModule } from '@nestjs/testing';
import { AdminAuditService } from './admin-audit.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AdminAuditService', () => {
  let service: AdminAuditService;
  let prisma: jest.Mocked<PrismaService>;

  const mockLog = {
    id: 'log-1',
    adminAction: 'update_user',
    resource: 'user',
    resourceId: 'user-1',
    oldValue: { balance: 100 },
    newValue: { balance: 200 },
    ipAddress: '127.0.0.1',
    adminUser: 'admin@test.com',
    createdAt: new Date('2024-01-15T12:00:00Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuditService,
        {
          provide: PrismaService,
          useValue: {
            auditLog: {
              findMany: jest.fn(),
              count: jest.fn(),
              groupBy: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AdminAuditService>(AdminAuditService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('getAuditLogs', () => {
    it('should return paginated audit logs', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([mockLog]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getAuditLogs({});

      expect(result.logs).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.logs[0].id).toBe('log-1');
      expect(result.logs[0].createdAt).toBe('2024-01-15T12:00:00.000Z');
    });

    it('should apply filters', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      await service.getAuditLogs({
        action: 'update',
        resource: 'user',
        resourceId: 'user-1',
        adminUser: 'admin',
        limit: 10,
        offset: 5,
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            adminAction: { contains: 'update', mode: 'insensitive' },
            resource: 'user',
            resourceId: 'user-1',
            adminUser: { contains: 'admin', mode: 'insensitive' },
          }),
          skip: 5,
          take: 10,
        }),
      );
    });

    it('should apply date range filters', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-01-31');

      await service.getAuditLogs({ dateFrom, dateTo });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: dateFrom, lte: dateTo },
          }),
        }),
      );
    });
  });

  describe('getStats', () => {
    it('should return audit statistics', async () => {
      (prisma.auditLog.count as jest.Mock)
        .mockResolvedValueOnce(100) // totalLogs
        .mockResolvedValueOnce(5); // todayCount

      (prisma.auditLog.groupBy as jest.Mock)
        .mockResolvedValueOnce([
          { adminAction: 'update_user', _count: 50 },
          { adminAction: 'create_machine', _count: 30 },
        ]) // byAction
        .mockResolvedValueOnce([
          { resource: 'user', _count: 60 },
          { resource: 'machine', _count: 40 },
        ]); // byResource

      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([mockLog]);

      const stats = await service.getStats();

      expect(stats.totalLogs).toBe(100);
      expect(stats.todayCount).toBe(5);
      expect(stats.byAction['update_user']).toBe(50);
      expect(stats.byResource['user']).toBe(60);
      expect(stats.recentActions).toHaveLength(1);
    });
  });

  describe('getResourceHistory', () => {
    it('should return history for specific resource', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([mockLog]);

      const history = await service.getResourceHistory('user', 'user-1');

      expect(history).toHaveLength(1);
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { resource: 'user', resourceId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });
  });
});
