import { Controller, Post, Body, BadRequestException, Req, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterSchema, LoginSchema, OfflineLoginSchema, RefreshTokenSchema } from './auth.dto';
import { AuthGuard } from './auth.guard';
import type { FastifyRequest } from 'fastify';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() body: unknown) {
    const result = RegisterSchema.safeParse(body);
    if (!result.success) {
      const errorMessages = result.error.issues.map(err => err.message).join(' | ');
      throw new BadRequestException(errorMessages);
    }
    return this.authService.register(result.data);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: unknown) {
    const result = LoginSchema.safeParse(body);
    if (!result.success) {
      const errorMessages = result.error.issues.map(err => err.message).join(' | ');
      throw new BadRequestException(errorMessages);
    }
    const user = await this.authService.validateUser(result.data);
    return this.authService.generateToken(user);
  }

  @Post('login-offline')
  @HttpCode(HttpStatus.OK)
  async loginOffline(@Body() body: unknown) {
    const result = OfflineLoginSchema.safeParse(body);
    if (!result.success) {
      const errorMessages = result.error.issues.map(err => err.message).join(' | ');
      throw new BadRequestException(errorMessages);
    }
    const user = await this.authService.validateOfflineUser(result.data);
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
    await this.authService['prisma'].refreshToken.deleteMany({
      where: { userId: user.sub }
    });
    return { success: true, message: 'Sesión cerrada exitosamente.' };
  }
}
