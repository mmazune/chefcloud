import request from 'supertest';
import {
  Controller,
  Get,
  Module,
  Post,
  Body,
  INestApplication,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GlobalExceptionFilter } from './global-exception.filter';

class CreateDto {
  name!: string; // Keep simple; we simulate bad request without class-validator to avoid extra deps.
}

@Controller()
class TestErrController {
  @Get('/_boom')
  boom() {
    throw new Error('boom');
  }

  @Get('/_bad')
  bad() {
    throw new BadRequestException({ message: 'Invalid payload' });
  }

  @Get('/_nf')
  nf() {
    throw new NotFoundException('Nope');
  }

  @Post('/_validate')
  validate(@Body() _dto: CreateDto) {
    // Simulate typical ValidationPipe rejection by throwing BadRequestException with structured message
    throw new BadRequestException({
      message: [
        {
          property: 'name',
          constraints: { isNotEmpty: 'name should not be empty' },
        },
      ],
    });
  }
}

@Module({ controllers: [TestErrController] })
class TestErrModule {}

describe('GlobalExceptionFilter', () => {
  let app: INestApplication;
  const prev = process.env.ERROR_INCLUDE_STACKS;

  beforeAll(async () => {
    process.env.ERROR_INCLUDE_STACKS = '0';
    const mod = await Test.createTestingModule({
      imports: [TestErrModule],
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    process.env.ERROR_INCLUDE_STACKS = prev;
    await app.close();
  });

  it('maps 404 to NOT_FOUND with standard body (unknown route)', async () => {
    const res = await request(app.getHttpServer())
      .get('/definitely-not-here')
      .set('X-Request-Id', 'RID-404');
    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
    expect(res.body.code).toBe('NOT_FOUND');
    expect(res.body.requestId).toBe('RID-404');
  });

  it('maps BadRequest to BAD_REQUEST with message', async () => {
    const res = await request(app.getHttpServer())
      .get('/_bad')
      .set('X-Request-Id', 'RID-400');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
    expect(res.body.message).toMatch(/Invalid/);
    expect(res.body.requestId).toBe('RID-400');
  });

  it('maps generic error to INTERNAL_SERVER_ERROR without stack by default', async () => {
    const res = await request(app.getHttpServer()).get('/_boom');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_SERVER_ERROR');
    expect(res.body.details?.stack).toBeUndefined();
  });

  it('normalizes validation errors into details.validation', async () => {
    const res = await request(app.getHttpServer())
      .post('/_validate')
      .send({})
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
    expect(Array.isArray(res.body.details?.validation)).toBe(true);
    expect(res.body.details.validation[0].property).toBe('name');
  });
});
