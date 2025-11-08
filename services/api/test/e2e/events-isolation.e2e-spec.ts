import './_injector-patch';
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { EventsModule } from '../../src/events/events.module';

describe('EventsModule isolation test', () => {
  it('should compile EventsModule', async () => {
    console.log('EventsModule:', EventsModule);
    console.log('EventsModule is constructor:', typeof EventsModule === 'function');
    const moduleRef = await Test.createTestingModule({
      imports: [EventsModule],
    }).compile();
    await moduleRef.init();
    await moduleRef.close();
  });
});
