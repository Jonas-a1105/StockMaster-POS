import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // Se conecta a la base de datos SQLite al iniciar el módulo
  async onModuleInit() {
    await this.$connect();
    console.log('🔌 Conectado con éxito a la Base de Datos SQLite local.');

    // Enforce immutable audit logs via SQLite triggers
    try {
      await this.$executeRawUnsafe(`
        CREATE TRIGGER IF NOT EXISTS prevent_audit_log_update
        BEFORE UPDATE ON "AuditLog"
        BEGIN
          SELECT raise(ABORT, 'Audit log records are immutable and cannot be updated.');
        END;
      `);
      await this.$executeRawUnsafe(`
        CREATE TRIGGER IF NOT EXISTS prevent_audit_log_delete
        BEFORE DELETE ON "AuditLog"
        BEGIN
          SELECT raise(ABORT, 'Audit log records are immutable and cannot be deleted.');
        END;
      `);
      console.log('🛡️ Triggers de inmutabilidad de Bitácora activos y verificados.');
    } catch (triggerErr) {
      console.error('⚠️ No se pudieron registrar los triggers de inmutabilidad en SQLite:', triggerErr);
    }
  }

  // Cierra la conexión de forma segura al destruir el módulo
  async onModuleDestroy() {
    await this.$disconnect();
    console.log('🔌 Conexión a la Base de Datos SQLite cerrada de forma segura.');
  }
}
