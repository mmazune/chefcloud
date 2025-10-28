import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { filter, throttleTime } from 'rxjs/operators';

export type EventTopic = 'spout' | 'kds';

export interface StreamEvent {
  topic: EventTopic;
  data: any;
  timestamp: number;
  deviceId?: string; // For throttling
}

@Injectable()
export class EventBusService {
  private eventSubject = new Subject<StreamEvent>();
  private readonly MAX_CLIENTS = parseInt(process.env.STREAM_MAX_CLIENTS || '200', 10);
  private clientCount = 0;

  /**
   * Subscribe to events for a specific topic with optional throttling.
   * Throttles events per deviceId to max 1 per second.
   */
  subscribe(topic: EventTopic, deviceId?: string) {
    let stream = this.eventSubject.pipe(filter((event) => event.topic === topic));

    // Apply per-device throttling for spout events (1 event/sec per device)
    if (topic === 'spout' && deviceId) {
      stream = stream.pipe(
        filter((event) => event.deviceId === deviceId),
        throttleTime(1000), // 1 second throttle
      );
    }

    return stream;
  }

  /**
   * Publish an event to a topic.
   */
  publish(topic: EventTopic, data: any, deviceId?: string) {
    if (this.clientCount > this.MAX_CLIENTS) {
      console.warn(`EventBus: Max clients (${this.MAX_CLIENTS}) exceeded, dropping event`);
      return;
    }

    const event: StreamEvent = {
      topic,
      data,
      timestamp: Date.now(),
      deviceId,
    };

    this.eventSubject.next(event);
  }

  incrementClientCount() {
    this.clientCount++;
  }

  decrementClientCount() {
    this.clientCount--;
  }

  getClientCount(): number {
    return this.clientCount;
  }
}
