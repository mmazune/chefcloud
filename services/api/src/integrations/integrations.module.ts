/**
 * M9.5: Integrations Module
 *
 * Contains webhook, notification, and calendar integration services.
 */
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { WebhookService } from './webhook.service';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import { IcsService } from './ics.service';
import { TemplateRenderService } from './template-render.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { IntegrationsController } from './integrations.controller';
import { PublicCalendarController } from './public-calendar.controller';

@Module({
  imports: [PrismaModule],
  controllers: [IntegrationsController, PublicCalendarController],
  providers: [
    WebhookService,
    WebhookDispatcherService,
    IcsService,
    TemplateRenderService,
    NotificationDispatcherService,
  ],
  exports: [
    WebhookService,
    WebhookDispatcherService,
    IcsService,
    TemplateRenderService,
    NotificationDispatcherService,
  ],
})
export class IntegrationsModule {}
