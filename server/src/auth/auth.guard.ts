import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private config: ConfigService,
    private authService: AuthService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Falta token de autorización.');
    }

    const token = authHeader.split(' ')[1];
    if (this.authService.isTokenBlacklisted(token)) {
      throw new UnauthorizedException('Token inválido o expirado.');
    }

    const secret = this.config.get<string>('JWT_SECRET')!;

    try {
      const decoded = jwt.verify(token, secret);
      request.user = decoded;
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado.');
    }
  }
}
