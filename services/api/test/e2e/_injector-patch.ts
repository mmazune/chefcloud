/* Must be imported BEFORE Nest testing bootstraps */
import 'reflect-metadata';
import { Injector } from '@nestjs/core/injector/injector';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';

const orig = (Injector as any).prototype.instantiateClass;

(Injector as any).prototype.instantiateClass = function(
  metatype: any,
  host: InstanceWrapper,
  ...rest: any[]
) {
  // Log what we're trying to instantiate BEFORE the error
  const metaName = metatype?.name || String(metatype);
  const hostName = (host && (host.name || host?.metatype?.name)) || 'unknown-host';
  
  // Get the design:paramtypes metadata
  const paramTypes = Reflect.getMetadata('design:paramtypes', metatype);
  
  if (typeof metatype !== 'function') {
    console.error(`🚨 Provider failed (NOT A CONSTRUCTOR): ${metaName} in ${hostName}`);
    console.error(`   Type of metatype:`, typeof metatype);
    console.error(`   Metatype value:`, metatype);
    console.error(`   design:paramtypes:`, paramTypes);
    console.error(`   Host:`, host);
  }
  
  try {
    return orig.apply(this, [metatype, host, ...rest]);
  } catch (err) {
    console.error(`🚨 Provider failed: ${metaName} in ${hostName}`);
    throw err;
  }
};
