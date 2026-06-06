import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ExecutionContext } from '@nestjs/common';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.sub;
    if (userId) return `user:${userId}`;
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    return `ip:${ip}`;
  }
}
