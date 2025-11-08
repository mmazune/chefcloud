import './_injector-patch';
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { PosModule } from '../../src/pos/pos.module';

describe('PosModule isolation test', () => {
  it('should compile PosModule to show exact failing provider', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PosModule],
    }).compile();
    await moduleRef.init();
    await moduleRef.close();
  });
});
