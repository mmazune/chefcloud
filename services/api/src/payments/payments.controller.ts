import {
  Controller,
  Post,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreateIntentDto } from './dto/create-intent.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('intents')
  async createIntent(
    @Body() dto: CreateIntentDto,
    @Req() req: any,
  ) {
    // Extract from JWT or defaults for testing
    const orgId = req.user?.orgId || 'org-1';
    const branchId = req.user?.branchId || 'branch-1';
    return this.paymentsService.createIntent(dto, orgId, branchId);
  }

  @Post('intents/:intentId/cancel')
  async cancelIntent(@Param('intentId') intentId: string) {
    return this.paymentsService.cancelIntent(intentId);
  }
}
