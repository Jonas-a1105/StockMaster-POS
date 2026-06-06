import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

const SOCKET_PATH = '/ws';

function parseOrigins(raw: string | undefined): string[] {
  const fallback = ['http://localhost:5173', 'http://localhost:3000'];
  if (!raw) return fallback;
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
}

@WebSocketGateway({
  path: SOCKET_PATH,
  cors: {
    origin: parseOrigins(process.env.CORS_ORIGINS),
    credentials: true,
  },
})
export class SyncGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private connectedClients = new Set<string>();

  handleConnection(client: Socket) {
    this.connectedClients.add(client.id);
    console.log(`[WS] Cliente conectado: ${client.id} (total: ${this.connectedClients.size})`);
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
    console.log(`[WS] Cliente desconectado: ${client.id} (total: ${this.connectedClients.size})`);
  }

  emitSync(collection: string) {
    if (this.server) {
      this.server.emit('sync', { collection, timestamp: new Date().toISOString() });
    }
  }

  getClientCount(): number {
    return this.connectedClients.size;
  }
}
