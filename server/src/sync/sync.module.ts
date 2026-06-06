import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { SyncGateway } from './sync.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuditoriaModule, AuthModule],
  controllers: [SyncController],
  providers: [SyncService, SyncGateway],
  exports: [SyncService]
})
export class SyncModule {}
