import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminAuthService, AdminJwtPayload } from '../admin-auth/admin-auth.service';

// Расширяем Request для типизации adminUser
declare module 'express' {
  interface Request {
    adminUser?: AdminJwtPayload;
  }
}

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No admin token provided');
    }

    try {
      const payload = this.adminAuthService.validateJwt(token);
      request.adminUser = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid admin token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) return undefined;

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
