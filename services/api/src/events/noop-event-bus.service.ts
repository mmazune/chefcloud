import { Injectable } from '@nestjs/common';
import { Observable, EMPTY } from 'rxjs';
import { EventTopic, StreamEvent } from './event-bus.service';

/**
 * No-op Event Bus for E2E tests
 * Prevents real event publishing during test execution
 */
@Injectable()
export class NoopEventBusService {
  subscribe(_topic: EventTopic, _deviceId?: string): Observable<StreamEvent> {
    // Return empty observable - no events emitted
    return EMPTY;
  }

  publish(_topic: EventTopic, _data: any, _deviceId?: string): void {
    // no-op - events are silently discarded in tests
  }

  incrementClientCount(): void {
    // no-op
  }

  decrementClientCount(): void {
    // no-op
  }

  getClientCount(): number {
    return 0;
  }
}

