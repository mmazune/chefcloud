/**
 * M28-KDS-S3: WebSocket Gateway for Real-Time KDS Updates
 * 
 * Provides real-time push updates for Kitchen Display System.
 * - Connects clients via /kds namespace
 * - Sends initial orders on connection
 * - Broadcasts updates when ticket status changes
 */

import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { KdsService } from './kds.service';
import { KdsTicketDto } from './dto/kds-ticket.dto';

@WebSocketGateway({
  namespace: '/kds',
  cors: {
    origin: '*', // Tighten this in production to your domains
  },
})
@Injectable()
export class KdsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(KdsGateway.name);

  constructor(private readonly kdsService: KdsService) {}

  async handleConnection(client: Socket): Promise<void> {
    this.logger.debug(`KDS client connected: ${client.id}`);
    try {
      // Send initial orders from all stations
      // TODO: Consider station-specific rooms if needed
      const orders: KdsTicketDto[] = await this.kdsService.getQueue('ALL');
      client.emit('kds:ordersUpdated', orders);
    } catch (err) {
      this.logger.error('Failed to send initial KDS orders', err as any);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`KDS client disconnected: ${client.id}`);
  }

  /**
   * Broadcast updated KDS orders to all connected clients.
   * Called by KdsService after ticket status changes.
   */
  async broadcastOrdersUpdated(station: string = 'ALL'): Promise<void> {
    if (!this.server) return;
    try {
      const orders: KdsTicketDto[] = await this.kdsService.getQueue(station);
      this.server.emit('kds:ordersUpdated', orders);
      this.logger.debug(`Broadcasted ${orders.length} KDS orders to all clients`);
    } catch (err) {
      this.logger.error('Failed to broadcast KDS orders update', err as any);
    }
  }
}
