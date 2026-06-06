import { Controller, Post, Body, Patch, Param, BadRequestException, Req, HttpCode, HttpStatus, UseGuards, Get, Query } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterSchema, LoginSchema, OfflineLoginSchema, RefreshTokenSchema } from './auth.dto';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import type { FastifyRequest } from 'fastify';

// Throttler estricto para login: 5 intentos / minuto por IP+email
const LOGIN_THROTTLE = { default: { limit: 5, ttl: 60_000 } };
// Refresh: 30 / minuto (es legítimo rotar varias veces)
const REFRESH_THROTTLE = { default: { limit: 30, ttl: 60_000 } };

@Controller('auth')
@SkipThrottle({ default: true }) // throttler solo donde lo sobreescribimos
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async register(@Req() req: FastifyRequest, @Body() body: unknown) {
    const result = RegisterSchema.safeParse(body);
    if (!result.success) {
      const errorMessages = result.error.issues.map(err => err.message).join(' | ');
      throw new BadRequestException(errorMessages);
    }
    const ip = req.ip || 'unknown';
    const ua = (req.headers['user-agent'] as string) || 'Unknown';
    return this.authService.register(result.data, ip, ua);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(LOGIN_THROTTLE)
  async login(@Req() req: FastifyRequest, @Body() body: unknown) {
    const result = LoginSchema.safeParse(body);
    if (!result.success) {
      const errorMessages = result.error.issues.map(err => err.message).join(' | ');
      throw new BadRequestException(errorMessages);
    }
    const ip = req.ip || 'unknown';
    const ua = (req.headers['user-agent'] as string) || 'Unknown';
    const user = await this.authService.validateUser(result.data, ip, ua);
    return this.authService.generateToken(user);
  }

  @Post('login-offline')
  @HttpCode(HttpStatus.OK)
  @Throttle(LOGIN_THROTTLE)
  async loginOffline(@Req() req: FastifyRequest, @Body() body: unknown) {
    const result = OfflineLoginSchema.safeParse(body);
    if (!result.success) {
      const errorMessages = result.error.issues.map(err => err.message).join(' | ');
      throw new BadRequestException(errorMessages);
    }
    const ip = req.ip || 'unknown';
    const ua = (req.headers['user-agent'] as string) || 'Unknown';
    const user = await this.authService.validateOfflineUser(result.data, ip, ua);
    return this.authService.generateToken(user);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle(REFRESH_THROTTLE)
  async refresh(@Body() body: unknown) {
    const result = RefreshTokenSchema.safeParse(body);
    if (!result.success) {
      const errorMessages = result.error.issues.map(err => err.message).join(' | ');
      throw new BadRequestException(errorMessages);
    }
    return this.authService.refreshAccessToken(result.data.refreshToken);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: FastifyRequest) {
    const user = (req as any).user;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      await this.authService.blacklistToken(token, 'LOGOUT');
    }
    const ip = req.ip || 'unknown';
    const ua = (req.headers['user-agent'] as string) || 'Unknown';
    await this.authService.revokeRefreshTokens(user.sub);
    await this.authService.logLogout(user.sub, ip, ua);
    return { success: true, message: 'Sesión cerrada exitosamente.' };
  }

  @Patch('users/:id/role')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateUserRole(@Param('id') id: string, @Body('role') role: string, @Req() req: FastifyRequest) {
    if (!role || !['ADMIN', 'AUDITOR', 'CASHIER'].includes(role)) {
      throw new BadRequestException('Rol inválido. Debe ser ADMIN, AUDITOR o CASHIER.');
    }
    const adminUser = (req as any).user;
    return this.authService.updateUserRole(id, role, adminUser.sub);
  }

  @Patch('users/:id/disable')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async disableUser(@Param('id') id: string, @Req() req: FastifyRequest) {
    const adminUser = (req as any).user;
    if (id === adminUser.sub) {
      throw new BadRequestException('No puedes desactivarte a ti mismo.');
    }
    return this.authService.disableUser(id, adminUser.sub);
  }

  @Post('send-verification')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async sendVerification(@Req() req: FastifyRequest) {
    const user = (req as any).user;
    return this.authService.sendVerification(user.sub);
  }

  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Query('token') token: string) {
    if (!token) throw new BadRequestException('Token requerido.');
    return this.authService.verifyEmail(token);
  }
}
