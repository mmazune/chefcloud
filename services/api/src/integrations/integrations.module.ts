/**
 * M9.5/M9.6: Integrations Module
 *
 * Contains webhook, notification, and calendar integration services.
 * M9.6 adds hardening (circuit breaker, replay) and ops monitoring.
 */
import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { WebhookService } from './webhook.service';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import { WebhookHardeningService } from './webhook-hardening.service';
import { IcsService } from './ics.service';
import { TemplateRenderService } from './template-render.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationHardeningService } from './notification-hardening.service';
import { IntegrationsController } from './integrations.controller';
import { PublicCalendarController } from './public-calendar.controller';
import { ReservationsModule } from '../reservations/reservations.module';

@Module({
  imports: [PrismaModule, forwardRef(() => ReservationsModule)],
  controllers: [IntegrationsController, PublicCalendarController],
  providers: [
    WebhookService,
    WebhookDispatcherService,
    WebhookHardeningService,
    IcsService,
    TemplateRenderService,
    NotificationDispatcherService,
    NotificationHardeningService,
  ],
  exports: [
    WebhookService,
    WebhookDispatcherService,
    WebhookHardeningService,
    IcsService,
    TemplateRenderService,
    NotificationDispatcherService,
    NotificationHardeningService,
  ],
})
export class IntegrationsModule {}
