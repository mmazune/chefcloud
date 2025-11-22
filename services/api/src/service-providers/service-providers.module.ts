import { Module } from '@nestjs/common';
// TODO M12: Re-enable after fixing decorator issues
// import { ServiceProvidersController } from './service-providers.controller';
// import { RemindersController } from './reminders.controller';
import { ServiceProvidersService } from './service-providers.service';
import { RemindersService } from './reminders.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [], // TODO M12: Add back controllers after fixing decorator issues
  providers: [ServiceProvidersService, RemindersService, PrismaService],
  exports: [ServiceProvidersService, RemindersService],
})
export class ServiceProvidersModule {}
