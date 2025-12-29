import './_injector-patch';
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { createE2ETestingModule, createE2ETestingModuleBuilder } from '../helpers/e2e-bootstrap';
import { EventsModule } from '../../src/events/events.module';
import { cleanup } from '../helpers/cleanup';

describe('EventsModule isolation test', () => {
  it('should compile EventsModule', async () => {
    console.log('EventsModule:', EventsModule);
    console.log('EventsModule is constructor:', typeof EventsModule === 'function');
    const moduleRef = await createE2ETestingModule({
      imports: [EventsModule],
    });
    await moduleRef.init();
    await moduleRef.close();
  });
});
