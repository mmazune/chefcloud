import { Module } from '@nestjs/common';
import { PurchasingController } from './purchasing.controller';
import { PurchasingService } from './purchasing.service';
import { PrismaService } from '../prisma.service';
import { CacheModule } from '../common/cache.module';

@Module({
  imports: [CacheModule],
  controllers: [PurchasingController],
  providers: [PurchasingService, PrismaService],
  exports: [PurchasingService],
})
export class PurchasingModule {}
