import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Hace que el módulo de Prisma sea global para inyectarse sin importar repetidamente
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
