import './_injector-patch';
import 'reflect-metadata';
import { createE2ETestingModule } from '../helpers/e2e-bootstrap';
import { InventoryModule } from '../../src/inventory/inventory.module';
import { KpisModule } from '../../src/kpis/kpis.module';
import { CacheModule } from '../../src/common/cache.module';
import { cleanup } from '../helpers/cleanup';
import { withTimeout } from '../helpers/with-timeout';

describe('InventoryModule + KpisModule test', () => {
  it('should compile these modules together', async () => {
    const moduleRef = await withTimeout(
      createE2ETestingModule({
        imports: [CacheModule, InventoryModule, KpisModule],
      }),
      { label: 'Inventory+KPIs module compilation', ms: 30000 }
    );
    await moduleRef.init();
    await moduleRef.close();
  });
});
