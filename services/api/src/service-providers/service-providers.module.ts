import { Module } from '@nestjs/common';
import { ServiceProvidersController } from './service-providers.controller';
import { RemindersController } from './reminders.controller';
import { ServiceProvidersService } from './service-providers.service';
import { RemindersService } from './reminders.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ServiceProvidersController, RemindersController],
  providers: [ServiceProvidersService, RemindersService, PrismaService],
  exports: [ServiceProvidersService, RemindersService],
})
export class ServiceProvidersModule {}
