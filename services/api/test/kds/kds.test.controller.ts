import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';

@Controller('kds-test')
export class KdsTestController {
  constructor(private readonly prisma: PrismaService) {}

  // List tickets (optionally by station)
  @Get('tickets')
  async list(@Req() req: any) {
    if (req.__TEST_RATE_LIMIT_HIT__) return { statusCode: 429, message: 'Too Many Requests' };
    return this.prisma.kdsTicket.findMany({});
  }

  // Get single ticket
  @Get('tickets/:id')
  async getOne(@Req() req: any, @Param('id') id: string) {
    if (req.__TEST_RATE_LIMIT_HIT__) return { statusCode: 429, message: 'Too Many Requests' };
    const t = await this.prisma.kdsTicket.findUnique({ where: { id } });
    if (!t) return { statusCode: 404, message: 'Not Found' };
    return t;
  }

  // Ack / Bump / Expo transitions
  @Post('tickets/:id/ack')
  @HttpCode(200)
  async ack(@Req() req: any, @Param('id') id: string) {
    if (req.__TEST_RATE_LIMIT_HIT__) return { statusCode: 429, message: 'Too Many Requests' };
    return this.prisma.kdsTicket.update({ where: { id }, data: { status: 'ACK' } });
  }

  @Post('tickets/:id/bump')
  @HttpCode(200)
  async bump(@Req() req: any, @Param('id') id: string) {
    if (req.__TEST_RATE_LIMIT_HIT__) return { statusCode: 429, message: 'Too Many Requests' };
    return this.prisma.kdsTicket.update({ where: { id }, data: { status: 'BUMPED' } });
  }

  @Post('tickets/:id/expo')
  @HttpCode(200)
  async expo(@Req() req: any, @Param('id') id: string) {
    if (req.__TEST_RATE_LIMIT_HIT__) return { statusCode: 429, message: 'Too Many Requests' };
    return this.prisma.kdsTicket.update({ where: { id }, data: { status: 'EXPO' } });
  }

  // Screen register/heartbeat
  @Post('screens/:id/heartbeat')
  @HttpCode(200)
  async heartbeat(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    if (req.__TEST_RATE_LIMIT_HIT__) return { statusCode: 429, message: 'Too Many Requests' };
    const station = body?.station ?? 'GRILL';
    return this.prisma.kdsScreen.upsert({ where: { id }, create: { station }, update: { station } });
  }
}
