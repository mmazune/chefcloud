import './_injector-patch';
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { createE2ETestingModule, createE2ETestingModuleBuilder } from '../helpers/e2e-bootstrap';
import { PosModule } from '../../src/pos/pos.module';
import { cleanup } from '../helpers/cleanup';

describe('PosModule isolation test', () => {
  it('should compile PosModule to show exact failing provider', async () => {
    const moduleRef = await createE2ETestingModule({
      imports: [PosModule],
    });
    await moduleRef.init();
    await moduleRef.close();
  });
});
