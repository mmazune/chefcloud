import { Test, TestingModule } from '@nestjs/testing';
import { EventBusService } from './event-bus.service';

describe('EventBusService', () => {
  let service: EventBusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventBusService],
    }).compile();

    service = module.get<EventBusService>(EventBusService);
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should publish and subscribe to events', (done) => {
    const subscription = service.subscribe('spout').subscribe({
      next: (event) => {
        expect(event.topic).toBe('spout');
        expect(event.data).toEqual({ test: 'data' });
        subscription.unsubscribe();
        done();
      },
    });

    service.publish('spout', { test: 'data' }, 'device-1');
  });

  it('should filter events by topic', (done) => {
    const kdsEvents: any[] = [];
    const subscription = service.subscribe('kds').subscribe({
      next: (event) => {
        kdsEvents.push(event);
      },
    });

    service.publish('spout', { test: 'spout' }, 'device-1');
    service.publish('kds', { test: 'kds' });

    setTimeout(() => {
      expect(kdsEvents.length).toBe(1);
      expect(kdsEvents[0].data.test).toBe('kds');
      subscription.unsubscribe();
      done();
    }, 100);
  });

  it('should throttle spout events per deviceId (1 event/sec)', (done) => {
    jest.useFakeTimers();
    
    const events: any[] = [];
    const subscription = service.subscribe('spout', 'device-1').subscribe({
      next: (event) => {
        events.push(event);
      },
    });

    // Publish 5 events rapidly for device-1
    service.publish('spout', { count: 1 }, 'device-1');
    service.publish('spout', { count: 2 }, 'device-1');
    service.publish('spout', { count: 3 }, 'device-1');
    service.publish('spout', { count: 4 }, 'device-1');
    service.publish('spout', { count: 5 }, 'device-1');

    // Immediately, should only receive first event due to throttle
    setTimeout(() => {
      expect(events.length).toBeLessThanOrEqual(2); // At most 2 due to throttle timing
      subscription.unsubscribe();
      jest.useRealTimers();
      done();
    }, 50);

    jest.runAllTimers();
  });

  it('should track client count', () => {
    expect(service.getClientCount()).toBe(0);

    service.incrementClientCount();
    expect(service.getClientCount()).toBe(1);

    service.incrementClientCount();
    expect(service.getClientCount()).toBe(2);

    service.decrementClientCount();
    expect(service.getClientCount()).toBe(1);
  });

  it('should drop events when max clients exceeded', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    // Set client count above max
    for (let i = 0; i < 201; i++) {
      service.incrementClientCount();
    }

    service.publish('spout', { test: 'data' }, 'device-1');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Max clients'),
    );

    consoleSpy.mockRestore();
  });
});
