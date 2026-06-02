import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto, OfflineLoginDto } from './auth.dto';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  private readonly refreshTokenExpiry = 7 * 24 * 60 * 60 * 1000; // 7 días

  constructor(
    private prisma: PrismaService,
    private config: ConfigService
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email }
    });

    if (existingUser) {
      throw new ConflictException('El correo electrónico ya se encuentra registrado.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    
    let hashedPin: string | null = null;
    if (dto.pin) {
      hashedPin = await bcrypt.hash(dto.pin, 10);
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        role: dto.role,
        pin: hashedPin
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USUARIO_REGISTRO',
        details: JSON.stringify({ name: user.name, role: user.role }),
        ipAddress: '127.0.0.1',
        userAgent: 'StockMasterPro Central Server'
      }
    });

    const { password, pin, ...result } = user;
    return result;
  }

  async validateUser(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email }
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales de acceso inválidas.');
    }

    const isPasswordMatching = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordMatching) {
      throw new UnauthorizedException('Credenciales de acceso inválidas.');
    }

    const { password, pin, ...result } = user;
    return result;
  }

  async validateOfflineUser(dto: OfflineLoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email }
    });

    if (!user || !user.pin) {
      throw new UnauthorizedException('Credenciales offline o PIN inválidos.');
    }

    const isPinMatching = await bcrypt.compare(dto.pin, user.pin);
    if (!isPinMatching) {
      throw new UnauthorizedException('Credenciales offline o PIN inválidos.');
    }

    const { password, pin, ...result } = user;
    return result;
  }

  async generateToken(user: { id: string; email: string; role: string; name: string }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    };

    const secret = this.config.get<string>('JWT_SECRET')!;
    const accessToken = jwt.sign(payload, secret, { expiresIn: '15m' });

    const rawRefreshToken = randomBytes(40).toString('hex');
    const hashedRefreshToken = await bcrypt.hash(rawRefreshToken, 10);

    await this.prisma.refreshToken.create({
      data: {
        token: hashedRefreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + this.refreshTokenExpiry),
      }
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: 900,
      user
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        expiresAt: { gt: new Date() },
      },
      include: { user: true }
    });

    let matchedToken = null;
    for (const t of tokens) {
      const isValid = await bcrypt.compare(refreshToken, t.token);
      if (isValid) {
        matchedToken = t;
        break;
      }
    }

    if (!matchedToken) {
      throw new UnauthorizedException('Refresh token inválido o expirado.');
    }

    await this.prisma.refreshToken.delete({ where: { id: matchedToken.id } });

    const { password, pin, ...user } = matchedToken.user;
    return this.generateToken(user);
  }
}
