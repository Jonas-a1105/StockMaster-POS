import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { UserThrottlerGuard } from './common/throttler.guard';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { SyncModule } from './sync/sync.module';
import { PayrollModule } from './payroll/payroll.module';
import { ReportsModule } from './reports/reports.module';
import { HealthModule } from './common/health.module';
import { LicensesModule } from './licenses/licenses.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [{
        ttl: config.get('THROTTLE_TTL', 60000),
        limit: config.get('THROTTLE_LIMIT', 120),
      }],
    }),
    PrismaModule,
    AuthModule,
    AuditoriaModule,
    SyncModule,
    PayrollModule,
    ReportsModule,
    HealthModule,
    LicensesModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
  ],
})
export class AppModule {}
