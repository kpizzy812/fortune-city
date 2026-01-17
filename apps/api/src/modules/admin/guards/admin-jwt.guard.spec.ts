import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AdminJwtGuard } from './admin-jwt.guard';
import {
  AdminAuthService,
  AdminJwtPayload,
} from '../admin-auth/admin-auth.service';

describe('AdminJwtGuard', () => {
  let guard: AdminJwtGuard;
  let adminAuthService: jest.Mocked<AdminAuthService>;

  const mockAdminPayload: AdminJwtPayload = {
    sub: 'admin',
    username: 'admin',
    isAdmin: true,
  };

  const createMockExecutionContext = (
    authHeader?: string,
  ): ExecutionContext => {
    const mockRequest = {
      headers: {
        authorization: authHeader,
      },
      adminUser: undefined as AdminJwtPayload | undefined,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminJwtGuard,
        {
          provide: AdminAuthService,
          useValue: {
            validateJwt: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<AdminJwtGuard>(AdminJwtGuard);
    adminAuthService = module.get(AdminAuthService);

    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should return true and set adminUser for valid token', () => {
      adminAuthService.validateJwt.mockReturnValue(mockAdminPayload);

      const context = createMockExecutionContext('Bearer valid-token');
      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(adminAuthService.validateJwt).toHaveBeenCalledWith('valid-token');

      // Check that adminUser was set on request
      const request = context.switchToHttp().getRequest();
      expect(request.adminUser).toEqual(mockAdminPayload);
    });

    it('should throw UnauthorizedException when no authorization header', () => {
      const context = createMockExecutionContext(undefined);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow(
        'No admin token provided',
      );
    });

    it('should throw UnauthorizedException when authorization header is empty', () => {
      const context = createMockExecutionContext('');

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when token type is not Bearer', () => {
      const context = createMockExecutionContext('Basic some-token');

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow(
        'No admin token provided',
      );
    });

    it('should throw UnauthorizedException when only "Bearer" without token', () => {
      const context = createMockExecutionContext('Bearer ');

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when token validation fails', () => {
      adminAuthService.validateJwt.mockImplementation(() => {
        throw new UnauthorizedException('Invalid token');
      });

      const context = createMockExecutionContext('Bearer invalid-token');

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Invalid admin token');
    });

    it('should throw UnauthorizedException for expired token', () => {
      adminAuthService.validateJwt.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      const context = createMockExecutionContext('Bearer expired-token');

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for malformed token', () => {
      adminAuthService.validateJwt.mockImplementation(() => {
        throw new Error('jwt malformed');
      });

      const context = createMockExecutionContext('Bearer malformed.token');

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should handle token with multiple spaces in header', () => {
      // "Bearer  token" should not work - should only extract on first space
      const context = createMockExecutionContext('Bearer  extra-space-token');

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should extract token correctly with standard Bearer format', () => {
      adminAuthService.validateJwt.mockReturnValue(mockAdminPayload);

      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature';
      const context = createMockExecutionContext(`Bearer ${token}`);

      guard.canActivate(context);

      expect(adminAuthService.validateJwt).toHaveBeenCalledWith(token);
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should return undefined for missing authorization header', () => {
      adminAuthService.validateJwt.mockReturnValue(mockAdminPayload);

      const mockRequest = {
        headers: {},
        adminUser: undefined,
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should handle lowercase bearer', () => {
      // Standard says it should be case-insensitive, but our implementation
      // expects exact 'Bearer' match
      const context = createMockExecutionContext('bearer token');

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });
});
