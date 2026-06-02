import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuditoriaModule, AuthModule],
  controllers: [PayrollController],
  providers: [PayrollService],
  exports: [PayrollService]
})
export class PayrollModule {}
