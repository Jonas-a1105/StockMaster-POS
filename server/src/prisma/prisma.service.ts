import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // Se conecta a la base de datos SQLite al iniciar el módulo
  async onModuleInit() {
    await this.$connect();
    console.log('🔌 Conectado con éxito a la Base de Datos SQLite local.');
  }

  // Cierra la conexión de forma segura al destruir el módulo
  async onModuleDestroy() {
    await this.$disconnect();
    console.log('🔌 Conexión a la Base de Datos SQLite cerrada de forma segura.');
  }
}
