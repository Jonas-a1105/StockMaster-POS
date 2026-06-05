import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto, OfflineLoginDto } from './auth.dto';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';

interface LockoutInfo {
  failedAttempts: number;
  lockoutUntil: Date | null;
}

@Injectable()
export class AuthService {
  private readonly refreshTokenExpiry = 7 * 24 * 60 * 60 * 1000; // 7 días
  private readonly lockouts = new Map<string, LockoutInfo>();
  private readonly blacklistedTokens = new Set<string>();

  constructor(
    private prisma: PrismaService,
    private config: ConfigService
  ) {}

  private getLockoutInfo(email: string): LockoutInfo {
    const key = email.toLowerCase().trim();
    if (!this.lockouts.has(key)) {
      this.lockouts.set(key, { failedAttempts: 0, lockoutUntil: null });
    }
    return this.lockouts.get(key)!;
  }

  private checkLockout(email: string) {
    const lockoutInfo = this.getLockoutInfo(email);
    if (lockoutInfo.lockoutUntil && lockoutInfo.lockoutUntil > new Date()) {
      const waitMinutes = Math.ceil((lockoutInfo.lockoutUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(`Cuenta bloqueada temporalmente. Intente de nuevo en ${waitMinutes} minutos.`);
    }
  }

  private async handleFailedAttempt(
    email: string,
    user: any | null,
    ipAddress: string,
    userAgent: string,
    actionPrefix: string,
    errorMessage: string
  ): Promise<never> {
    const key = email.toLowerCase().trim();
    const lockoutInfo = this.getLockoutInfo(key);
    lockoutInfo.failedAttempts += 1;

    if (lockoutInfo.failedAttempts >= 5) {
      lockoutInfo.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000);
      this.lockouts.set(key, lockoutInfo);

      await this.prisma.auditLog.create({
        data: {
          userId: user ? user.id : null,
          action: `${actionPrefix}_BLOQUEADO_TEMPORAL`,
          details: JSON.stringify({ email: key, reason: 'Exceso de intentos de inicio de sesión.' }),
          ipAddress,
          userAgent
        }
      });

      throw new UnauthorizedException('Cuenta bloqueada temporalmente por 15 minutos debido a demasiados intentos fallidos.');
    } else {
      this.lockouts.set(key, lockoutInfo);

      await this.prisma.auditLog.create({
        data: {
          userId: user ? user.id : null,
          action: `${actionPrefix}_FALLIDO`,
          details: JSON.stringify({ email: key, attempt: lockoutInfo.failedAttempts }),
          ipAddress,
          userAgent
        }
      });

      throw new UnauthorizedException(errorMessage);
    }
  }

  private resetLockoutInfo(email: string) {
    const key = email.toLowerCase().trim();
    this.lockouts.set(key, { failedAttempts: 0, lockoutUntil: null });
  }

  blacklistToken(token: string) {
    this.blacklistedTokens.add(token);
    // Eliminar después de 15 minutos para evitar fugas de memoria
    setTimeout(() => {
      this.blacklistedTokens.delete(token);
    }, 15 * 60 * 1000);
  }

  isTokenBlacklisted(token: string): boolean {
    return this.blacklistedTokens.has(token);
  }

  async logLogout(userId: string, ipAddress: string, userAgent: string) {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'USUARIO_LOGOUT',
        details: JSON.stringify({ message: 'Sesión cerrada exitosamente.' }),
        ipAddress,
        userAgent
      }
    });
  }

  async register(dto: RegisterDto, ipAddress = 'unknown', userAgent = 'Unknown') {
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
        ipAddress,
        userAgent
      }
    });

    const { password, pin, ...result } = user;
    return result;
  }

  async validateUser(dto: LoginDto, ipAddress = 'unknown', userAgent = 'Unknown') {
    this.checkLockout(dto.email);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email }
    });

    if (!user) {
      await this.handleFailedAttempt(dto.email, null, ipAddress, userAgent, 'USUARIO_LOGIN', 'Credenciales de acceso inválidas.');
    }

    const isPasswordMatching = await bcrypt.compare(dto.password, user!.password);
    if (!isPasswordMatching) {
      await this.handleFailedAttempt(dto.email, user, ipAddress, userAgent, 'USUARIO_LOGIN', 'Credenciales de acceso inválidas.');
    }

    this.resetLockoutInfo(dto.email);

    await this.prisma.auditLog.create({
      data: {
        userId: user!.id,
        action: 'USUARIO_LOGIN',
        details: JSON.stringify({ email: user!.email, name: user!.name }),
        ipAddress,
        userAgent
      }
    });

    const { password, ...result } = user!;
    return result;
  }

  async validateOfflineUser(dto: OfflineLoginDto, ipAddress = 'unknown', userAgent = 'Unknown') {
    this.checkLockout(dto.email);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email }
    });

    if (!user || !user.pin) {
      await this.handleFailedAttempt(dto.email, user || null, ipAddress, userAgent, 'USUARIO_LOGIN_OFFLINE', 'Credenciales offline o PIN inválidos.');
    }

    const isPinMatching = await bcrypt.compare(dto.pin, user!.pin!);
    if (!isPinMatching) {
      await this.handleFailedAttempt(dto.email, user, ipAddress, userAgent, 'USUARIO_LOGIN_OFFLINE', 'Credenciales offline o PIN inválidos.');
    }

    this.resetLockoutInfo(dto.email);

    await this.prisma.auditLog.create({
      data: {
        userId: user!.id,
        action: 'USUARIO_LOGIN_OFFLINE',
        details: JSON.stringify({ email: user!.email, name: user!.name }),
        ipAddress,
        userAgent
      }
    });

    const { password, ...result } = user!;
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

    const { password, ...user } = matchedToken.user;
    return this.generateToken(user);
  }

  async revokeRefreshTokens(userId: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { userId }
    });
  }
}
