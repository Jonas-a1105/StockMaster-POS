import { Injectable, UnauthorizedException, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto, LoginDto, OfflineLoginDto } from './auth.dto';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

type StoredUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  pin?: string | null;
  password?: string;
  disabled?: boolean;
  verifiedAt?: Date | null;
  verificationToken?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  pin: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class AuthService {
  private readonly refreshTokenExpiry = 7 * 24 * 60 * 60 * 1000;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private mailService: MailService
  ) {}

  /**
   * Filtra los campos sensibles antes de devolver un usuario al cliente.
   * - `password` y `verificationToken` NUNCA deben salir del servidor.
   * - `disabled` / `verifiedAt` no los consume el cliente.
   * - `pin` se conserva: es el hash bcrypt, y el cliente lo necesita
   *   para validar el login offline (ver client/src/db/auth.ts).
   */
  private toPublicUser(user: StoredUser): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      pin: user.pin ?? null,
      createdAt: user.createdAt!,
      updatedAt: user.updatedAt!,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getTokenExp(token: string): Date | null {
    try {
      const payload = jwt.decode(token) as { exp?: number } | null;
      if (!payload?.exp) return null;
      return new Date(payload.exp * 1000);
    } catch {
      return null;
    }
  }

  // ── Blacklist persistente (reemplaza Set<string> en memoria) ──────────
  async blacklistToken(token: string, reason: string = 'LOGOUT'): Promise<void> {
    const tokenHash = this.hashToken(token);
    const exp = this.getTokenExp(token) ?? new Date(Date.now() + 15 * 60 * 1000);
    if (exp.getTime() <= Date.now()) return;

    try {
      await this.prisma.tokenBlacklist.upsert({
        where: { tokenHash },
        create: { tokenHash, reason, expiresAt: exp },
        update: {},
      });
    } catch {
      // Silenciar errores para no romper el logout
    }
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);
    const entry = await this.prisma.tokenBlacklist.findUnique({
      where: { tokenHash },
    });
    return !!entry;
  }

  /** Job: limpiar blacklist expirada (ejecutar periódicamente). */
  async cleanupExpiredBlacklist(): Promise<{ deleted: number }> {
    const result = await this.prisma.tokenBlacklist.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return { deleted: result.count };
  }

  // ── Lockout persistente (reemplaza Map<string, LockoutInfo>) ──────────
  private async checkLockout(email: string): Promise<void> {
    const key = email.toLowerCase().trim();
    const since = new Date(Date.now() - ATTEMPT_WINDOW_MS);

    const recentFails = await this.prisma.loginAttempt.findMany({
      where: { email: key, success: false, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    });

    const activeLockout = recentFails.find(
      (a) => a.lockoutUntil && a.lockoutUntil > new Date()
    );
    if (activeLockout?.lockoutUntil) {
      const waitMinutes = Math.ceil(
        (activeLockout.lockoutUntil.getTime() - Date.now()) / 60000
      );
      throw new UnauthorizedException(
        `Cuenta bloqueada temporalmente. Intente de nuevo en ${waitMinutes} minutos.`
      );
    }

    if (recentFails.length >= LOCKOUT_THRESHOLD) {
      const lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      await this.prisma.loginAttempt.updateMany({
        where: { email: key, success: false, createdAt: { gte: since } },
        data: { lockoutUntil },
      });
      throw new UnauthorizedException(
        'Cuenta bloqueada temporalmente por 15 minutos debido a demasiados intentos fallidos.'
      );
    }
  }

  private async recordFailedAttempt(
    email: string,
    user: any | null,
    ipAddress: string,
    userAgent: string,
    actionPrefix: string
  ): Promise<never> {
    const key = email.toLowerCase().trim();

    const recentFails = await this.prisma.loginAttempt.count({
      where: {
        email: key,
        success: false,
        createdAt: { gte: new Date(Date.now() - ATTEMPT_WINDOW_MS) },
      },
    });

    const failureCount = recentFails + 1;
    const lockoutUntil =
      failureCount >= LOCKOUT_THRESHOLD
        ? new Date(Date.now() + LOCKOUT_DURATION_MS)
        : null;

    await this.prisma.loginAttempt.create({
      data: {
        email: key,
        ipAddress,
        userAgent,
        success: false,
        failureCount,
        lockoutUntil,
      },
    });

    if (lockoutUntil) {
      await this.prisma.auditLog.create({
        data: {
          userId: user ? user.id : null,
          action: `${actionPrefix}_BLOQUEADO_TEMPORAL`,
          details: JSON.stringify({ email: key, reason: 'Exceso de intentos.' }),
          ipAddress,
          userAgent,
        },
      });
      throw new UnauthorizedException(
        'Cuenta bloqueada temporalmente por 15 minutos debido a demasiados intentos fallidos.'
      );
    }

    await this.prisma.auditLog.create({
      data: {
        userId: user ? user.id : null,
        action: `${actionPrefix}_FALLIDO`,
        details: JSON.stringify({ email: key, attempt: failureCount }),
        ipAddress,
        userAgent,
      },
    });
    throw new UnauthorizedException('Credenciales de acceso inválidas.');
  }

  async logLogout(userId: string, ipAddress: string, userAgent: string) {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'USUARIO_LOGOUT',
        details: JSON.stringify({ message: 'Sesión cerrada exitosamente.' }),
        ipAddress,
        userAgent,
      },
    });
  }

  async register(dto: RegisterDto, ipAddress = 'unknown', userAgent = 'Unknown') {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
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
        pin: hashedPin,
        verificationToken: randomBytes(32).toString('hex'),
      },
    });

    this.mailService.sendVerificationEmail(user.email, user.name, user.verificationToken!);

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USUARIO_REGISTRO',
        details: JSON.stringify({ name: user.name, role: user.role }),
        ipAddress,
        userAgent,
      },
    });

    const { password: _password, pin: _pin, verificationToken: _vt, disabled: _d, verifiedAt: _v, ...safe } = user;
    return this.toPublicUser(safe);
  }

  async validateUser(dto: LoginDto, ipAddress = 'unknown', userAgent = 'Unknown') {
    await this.checkLockout(dto.email);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      await this.recordFailedAttempt(dto.email, null, ipAddress, userAgent, 'USUARIO_LOGIN');
    }

    const isPasswordMatching = await bcrypt.compare(dto.password, user!.password);
    if (!isPasswordMatching) {
      await this.recordFailedAttempt(dto.email, user, ipAddress, userAgent, 'USUARIO_LOGIN');
    }

    await this.prisma.loginAttempt.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        ipAddress,
        userAgent,
        success: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user!.id,
        action: 'USUARIO_LOGIN',
        details: JSON.stringify({ email: user!.email, name: user!.name }),
        ipAddress,
        userAgent,
      },
    });

    const { password: _password, verificationToken: _vt, disabled: _d, verifiedAt: _v, ...safe } = user!;
    return this.toPublicUser(safe);
  }

  async validateOfflineUser(dto: OfflineLoginDto, ipAddress = 'unknown', userAgent = 'Unknown') {
    await this.checkLockout(dto.email);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.pin) {
      await this.recordFailedAttempt(dto.email, user || null, ipAddress, userAgent, 'USUARIO_LOGIN_OFFLINE');
    }

    const isPinMatching = await bcrypt.compare(dto.pin, user!.pin!);
    if (!isPinMatching) {
      await this.recordFailedAttempt(dto.email, user, ipAddress, userAgent, 'USUARIO_LOGIN_OFFLINE');
    }

    await this.prisma.loginAttempt.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        ipAddress,
        userAgent,
        success: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user!.id,
        action: 'USUARIO_LOGIN_OFFLINE',
        details: JSON.stringify({ email: user!.email, name: user!.name }),
        ipAddress,
        userAgent,
      },
    });

    const { password: _password, verificationToken: _vt, disabled: _d, verifiedAt: _v, ...safe } = user!;
    return this.toPublicUser(safe);
  }

  async generateToken(user: PublicUser) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
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
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: 900,
      user,
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
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

    // Borrado atómico: si count === 0, otro request concurrente ya rotó
    // este token (race condition entre timers / pestañas). Devolvemos 401
    // en vez del 500 que Prisma lanzaba con P2025 al usar `delete()`.
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: { id: matchedToken.id },
    });
    if (count === 0) {
      throw new UnauthorizedException('Refresh token inválido o expirado.');
    }

    const { password: _password, verificationToken: _vt, disabled: _d, verifiedAt: _v, ...safe } = matchedToken.user;
    return this.generateToken(this.toPublicUser(safe));
  }

  async revokeRefreshTokens(userId: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  async updateUserRole(userId: string, newRole: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Usuario no encontrado.');

    await this.prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'USUARIO_ROL_CAMBIADO',
        details: JSON.stringify({ targetUserId: userId, oldRole: user.role, newRole }),
        ipAddress: 'admin',
        userAgent: 'UserAdmin UI',
      },
    });

    return { success: true, message: `Rol actualizado a ${newRole}` };
  }

  async disableUser(userId: string, adminId: string) {
    const user: any = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Usuario no encontrado.');

    const newState = !user.disabled;
    await this.prisma.user.update({
      where: { id: userId },
      data: { disabled: newState } as any,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: newState ? 'USUARIO_DESACTIVADO' : 'USUARIO_ACTIVADO',
        details: JSON.stringify({ targetUserId: userId, name: user.name, email: user.email }),
        ipAddress: 'admin',
        userAgent: 'UserAdmin UI',
      },
    });

    return { success: true, message: newState ? 'Usuario desactivado' : 'Usuario activado' };
  }

  async sendVerification(userId: string): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Usuario no encontrado.');
    if (user.verifiedAt) return { success: true, message: 'El correo ya está verificado.' };

    const token = randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: userId },
      data: { verificationToken: token },
    });

    const sent = await this.mailService.sendVerificationEmail(user.email, user.name, token);
    if (!sent) return { success: false, message: 'SMTP no configurado. No se pudo enviar el email.' };
    return { success: true, message: 'Correo de verificación enviado.' };
  }

  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findFirst({ where: { verificationToken: token } });
    if (!user) throw new BadRequestException('Token de verificación inválido o expirado.');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { verifiedAt: new Date(), verificationToken: null },
    });

    return { success: true, message: 'Correo verificado exitosamente.' };
  }
}
