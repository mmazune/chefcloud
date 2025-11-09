import './_injector-patch';
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { Module as _Module } from '@nestjs/common';

// Pull out AppModule.imports at runtime
const appModuleImports = (AppModule as any).__imports;

if (!appModuleImports || !Array.isArray(appModuleImports)) {
  throw new Error('AppModule.imports not accessible; in AppModule, add: public static __imports = [ ...imports ]');
}

async function tryImports(imports: any[]) {
  const moduleRef = await Test.createTestingModule({
    imports,
  }).compile();
  await moduleRef.init();
  await moduleRef.close();
}

describe('AppModule bisect', () => {
  it('bisects imports to find the first failing module', async () => {
    let low = 0;
    let high = appModuleImports.length;
    // quick sanity: if even the first import fails, we'll see it
    // always log indices to aid fixes
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const slice = appModuleImports.slice(0, mid + 1);
      try {
        await tryImports(slice);
        // first mid+1 succeed; move right
        low = mid + 1;
      } catch (e) {
        console.error(`❌ Failed at index ${mid} =>`, appModuleImports[mid]?.name || appModuleImports[mid]);
        high = mid; // shrink to left side
      }
    }
    console.log(`🟢 All imports up to index ${low - 1} OK; failing module at index ${low}`);
    // compile only the failing module alone to force a precise provider error
    try {
      await tryImports([appModuleImports[low]]);
    } catch (e) {
      // injector patch will print "🚨 Provider failed: <name> in <host>"
      // that's the exact offender to fix.
    }
  });
});
