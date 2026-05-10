import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.ADMIN_TOKEN;
    if (!expected) {
      throw new UnauthorizedException('Admin access disabled');
    }

    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const expectedBuf = Buffer.from(expected, 'utf8');
    const tokenBuf = Buffer.from(token, 'utf8');

    if (expectedBuf.length !== tokenBuf.length) {
      throw new UnauthorizedException('Invalid token');
    }

    if (!timingSafeEqual(expectedBuf, tokenBuf)) {
      throw new UnauthorizedException('Invalid token');
    }

    return true;
  }
}
