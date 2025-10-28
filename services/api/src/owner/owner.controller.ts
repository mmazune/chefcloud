/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OwnerService } from './owner.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

class CreateDigestDto {
  name!: string;
  cron!: string;
  recipients!: string[];
  sendOnShiftClose?: boolean;
}

class UpdateDigestDto {
  name?: string;
  cron?: string;
  recipients?: string[];
  sendOnShiftClose?: boolean;
}

@Controller('owner')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class OwnerController {
  constructor(private ownerService: OwnerService) {}

  @Get('overview')
  @Roles('L5')
  async getOverview(@Req() req: any): Promise<any> {
    return this.ownerService.getOverview(req.user.orgId);
  }

  @Post('digest')
  @Roles('L5')
  async createDigest(@Req() req: any, @Body() dto: CreateDigestDto): Promise<any> {
    return this.ownerService.createDigest(
      req.user.orgId,
      dto.name,
      dto.cron,
      dto.recipients,
      dto.sendOnShiftClose,
    );
  }

  @Patch('digest/:id')
  @Roles('L5')
  async updateDigest(@Param('id') id: string, @Body() dto: UpdateDigestDto): Promise<any> {
    return this.ownerService.updateDigest(id, dto);
  }

  @Post('digest/run-now/:id')
  @Roles('L5')
  async runDigestNow(@Param('id') id: string): Promise<any> {
    const digest = await this.ownerService.getDigest(id);
    if (!digest) {
      return { error: 'Digest not found' };
    }

    // Enqueue digest job (will be implemented in worker)
    const { Queue } = await import('bullmq');
    const connection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    };
    const digestQueue = new Queue('digest', { connection });

    await digestQueue.add('owner-digest-run', {
      type: 'owner-digest-run',
      digestId: id,
    });

    return { success: true, message: `Digest job enqueued for ${digest.name}` };
  }
}
