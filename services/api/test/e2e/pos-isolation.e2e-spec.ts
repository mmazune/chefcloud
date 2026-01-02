import './_injector-patch';
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { createE2ETestingModule, createE2ETestingModuleBuilder } from '../helpers/e2e-bootstrap';
import { PosModule } from '../../src/pos/pos.module';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '../../src/common/cache.module';
import { cleanup } from '../helpers/cleanup';
import { withTimeout } from '../helpers/with-timeout';

describe('PosModule isolation test', () => {
  it('should compile PosModule to show exact failing provider', async () => {
    const moduleRef = await withTimeout(
      createE2ETestingModule({
        imports: [
          ConfigModule.forRoot({ isGlobal: true }),
          CacheModule,
          PosModule,
        ],
      }),
      { label: 'PosModule compilation', ms: 30000 }
    );
    await moduleRef.init();
    await cleanup(moduleRef);
  });
});

