import { Controller, Post, Body, BadRequestException, UseGuards, Req } from '@nestjs/common';
import { LicensesService } from './licenses.service';
import { ValidateLicenseSchema, SignLicenseSchema } from './licenses.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { FastifyRequest } from 'fastify';

@Controller('licenses')
export class LicensesController {
  constructor(private licensesService: LicensesService) {}

  @Post('validate')
  async validateLicense(@Body() body: unknown) {
    const result = ValidateLicenseSchema.safeParse(body);
    if (!result.success) {
      const errorMessages = result.error.issues.map(err => err.message).join(' | ');
      throw new BadRequestException(errorMessages);
    }
    return this.licensesService.validateLicenseKey(result.data.key);
  }

  /**
   * Firma una licencia (uso interno / CLI).
   * En producción, este endpoint debe estar restringido a ADMIN o removido.
   */
  @Post('sign')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async signLicense(@Body() body: unknown, @Req() req: FastifyRequest) {
    const result = SignLicenseSchema.safeParse(body);
    if (!result.success) {
      const errorMessages = result.error.issues.map(err => err.message).join(' | ');
      throw new BadRequestException(errorMessages);
    }
    return {
      key: this.licensesService.signLicense(result.data.plan, result.data.rif, result.data.expiry),
    };
  }
}
