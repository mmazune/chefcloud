import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';

@Controller('dev')
export class DevPortalTestController {
  constructor(private readonly prisma: PrismaService) {}

  // Rate-limited entry: returns 429 if PlanLimitGuard flagged the request
  @Get('keys')
  async list(@Req() req: any) {
    if (req.__TEST_RATE_LIMIT_HIT__) {
      return { statusCode: 429, message: 'Too Many Requests' };
    }
    return this.prisma.developerApiKey.findMany({});
  }

  @Post('keys')
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: any, @Body() body: any) {
    if (req.__TEST_RATE_LIMIT_HIT__) {
      return { statusCode: 429, message: 'Too Many Requests' };
    }
    if (!body?.label) {
      return { statusCode: 400, message: 'label is required' };
    }
    return this.prisma.developerApiKey.create({ data: { label: body.label, plan: body.plan ?? 'free' } });
  }

  @Post('keys/:id/revoke')
  @HttpCode(HttpStatus.OK)
  async revoke(@Req() req: any, @Param('id') id: string) {
    if (req.__TEST_RATE_LIMIT_HIT__) {
      return { statusCode: 429, message: 'Too Many Requests' };
    }
    return this.prisma.developerApiKey.update({ where: { id }, data: { active: false } });
  }
}
