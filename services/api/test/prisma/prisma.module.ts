import { Module } from '@nestjs/common';
import { PrismaStub } from './prisma.stub';

// Token/class path must match your real PrismaService import token.
export class PrismaService extends PrismaStub {}

@Module({
  providers: [{ provide: PrismaService, useClass: PrismaService }],
  exports: [PrismaService],
})
export class PrismaTestModule {}
