import { Controller, Post, Body, BadRequestException, Req, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterSchema, LoginSchema, OfflineLoginSchema, RefreshTokenSchema } from './auth.dto';
import { AuthGuard } from './auth.guard';
import type { FastifyRequest } from 'fastify';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
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
      this.authService.blacklistToken(token);
    }
    const ip = req.ip || 'unknown';
    const ua = (req.headers['user-agent'] as string) || 'Unknown';
    await this.authService.revokeRefreshTokens(user.sub);
    await this.authService.logLogout(user.sub, ip, ua);
    return { success: true, message: 'Sesión cerrada exitosamente.' };
  }
}
