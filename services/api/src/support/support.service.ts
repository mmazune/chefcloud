import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { randomBytes } from 'crypto';
import { logger } from '../logger';

export interface SupportEvent {
  timestamp: Date;
  type: string;
  data: any;
}

// In-memory storage for support session events
class SupportEventsStore {
  private events: Map<string, SupportEvent[]> = new Map();
  private maxEventsPerSession = 100;

  addEvent(sessionId: string, event: SupportEvent) {
    if (!this.events.has(sessionId)) {
      this.events.set(sessionId, []);
    }

    const sessionEvents = this.events.get(sessionId)!;
    sessionEvents.push(event);

    // Keep only last N events
    if (sessionEvents.length > this.maxEventsPerSession) {
      sessionEvents.shift();
    }

    logger.info({ sessionId, eventType: event.type }, 'Support event ingested');
  }

  getEvents(sessionId: string): SupportEvent[] {
    return this.events.get(sessionId) || [];
  }

  clearSession(sessionId: string) {
    this.events.delete(sessionId);
  }
}

export const supportEventsStore = new SupportEventsStore();

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  async createSession(userId: string, orgId: string) {
    const maxSessionMinutes = parseInt(process.env.SUPPORT_MAX_SESSION_MIN || '30');
    const sessionMinutes = Math.min(15, maxSessionMinutes);
    const expiresAt = new Date(Date.now() + sessionMinutes * 60 * 1000);
    const token = randomBytes(32).toString('hex');

    const session = await this.prisma.supportSession.create({
      data: {
        orgId,
        createdById: userId,
        token,
        expiresAt,
        isActive: true,
      },
    });

    logger.info({ sessionId: session.id, orgId, expiresAt }, 'Support session created');

    return session;
  }

  async validateToken(token: string) {
    const session = await this.prisma.supportSession.findUnique({
      where: { token },
    });

    if (!session) {
      return null;
    }

    if (!session.isActive || session.expiresAt < new Date()) {
      return null;
    }

    return session;
  }

  async ingestEvent(token: string, eventType: string, data: any) {
    const session = await this.validateToken(token);

    if (!session) {
      throw new Error('Invalid or expired session token');
    }

    const event: SupportEvent = {
      timestamp: new Date(),
      type: eventType,
      data,
    };

    supportEventsStore.addEvent(session.id, event);

    return { success: true, sessionId: session.id };
  }

  async getSessionEvents(sessionId: string) {
    return supportEventsStore.getEvents(sessionId);
  }

  async deactivateSession(sessionId: string) {
    await this.prisma.supportSession.update({
      where: { id: sessionId },
      data: { isActive: false },
    });

    supportEventsStore.clearSession(sessionId);

    logger.info({ sessionId }, 'Support session deactivated');
  }
}
