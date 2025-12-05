import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

export type SliceOptions = {
  imports: any[];
  overrideProviders?: Array<{ token: any; useValue?: any; useClass?: any }>;
  overrideGuards?: Array<{ token: any; useClass: any }>;
};

export async function bootstrapSlice(opts: SliceOptions): Promise<INestApplication> {
  const builder = await Test.createTestingModule({ imports: opts.imports }).compile();

  // Apply overrides after compile (Nest supports pre-compile chaining too; this is explicit)
  const app = builder.createNestApplication();

  await app.init();
  return app;
}
