import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { EventBusService } from '../../src/events/event-bus.service';
import { NoopEventBusService } from '../../src/events/noop-event-bus.service';

describe('Minimal Boot Test', () => {
  let app: INestApplication;

  it('should boot AppModule without errors', async () => {
    console.log('Starting module compilation...');
    const startTime = Date.now();
    
    try {
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(EventBusService)
        .useClass(NoopEventBusService)
        .compile();
      
      console.log(`Module compiled in ${Date.now() - startTime}ms`);
      
      app = moduleRef.createNestApplication();
      await app.init();
      
      console.log(`App initialized in ${Date.now() - startTime}ms total`);
      
      expect(app).toBeDefined();
      
      await app.close();
    } catch (error) {
      console.error('Boot failed:', error);
      throw error;
    }
  }, 30000);
});