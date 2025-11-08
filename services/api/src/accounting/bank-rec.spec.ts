import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BankRecService } from './bank-rec.service';
import { PrismaService } from '../prisma.service';
import { parseBankCSV } from './csv-parser';

jest.mock('./csv-parser');

describe('Bank Reconciliation', () => {
  let service: BankRecService;

  const mockPrisma = {
    client: {
      bankAccount: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      bankTxn: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      reconcileMatch: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      payment: { findFirst: jest.fn() },
      refund: { findFirst: jest.fn() },
      $transaction: jest.fn((arr) => Promise.all(arr)),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankRecService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BankRecService>(BankRecService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('upsertBankAccount', () => {
    it('should create new account if not exists', async () => {
      mockPrisma.client.bankAccount.findFirst.mockResolvedValue(null);
      mockPrisma.client.bankAccount.create.mockResolvedValue({ id: '1', name: 'Stanbic', orgId: 'org1' });

      const result = await service.upsertBankAccount('org1', 'Stanbic', 'UGX', '1234');
      expect(result.id).toBe('1');
      expect(mockPrisma.client.bankAccount.create).toHaveBeenCalled();
    });

    it('should update existing account', async () => {
      mockPrisma.client.bankAccount.findFirst.mockResolvedValue({ id: '1', name: 'Stanbic' });
      mockPrisma.client.bankAccount.update.mockResolvedValue({ id: '1', name: 'Stanbic', lastFour: '5678' });

      await service.upsertBankAccount('org1', 'Stanbic', 'UGX', '5678');
      expect(mockPrisma.client.bankAccount.update).toHaveBeenCalled();
    });
  });

  describe('importCSV', () => {
    it('should import transactions from CSV', async () => {
      mockPrisma.client.bankAccount.findUnique.mockResolvedValue({ id: 'acc1', name: 'Stanbic' });
      (parseBankCSV as jest.Mock).mockReturnValue([
        { date: new Date('2025-01-15'), amount: 50000, description: 'Payment', ref: 'TXN123' },
      ]);
      mockPrisma.client.$transaction.mockResolvedValue([{ id: 'txn1' }]);

      const result = await service.importCSV('acc1', 'Date,Amount\n2025-01-15,50000');
      expect(result.imported).toBe(1);
      expect(parseBankCSV).toHaveBeenCalled();
    });

    it('should throw NotFoundException if account not found', async () => {
      mockPrisma.client.bankAccount.findUnique.mockResolvedValue(null);

      await expect(service.importCSV('acc1', 'Date,Amount\n2025-01-15,50000'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if CSV is empty', async () => {
      mockPrisma.client.bankAccount.findUnique.mockResolvedValue({ id: 'acc1' });
      (parseBankCSV as jest.Mock).mockReturnValue([]);

      await expect(service.importCSV('acc1', 'Date,Amount'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('matchTransaction', () => {
    it('should match bank transaction to payment', async () => {
      mockPrisma.client.bankTxn.findUnique.mockResolvedValue({ id: 'txn1', reconciled: false });
      mockPrisma.client.reconcileMatch.create.mockResolvedValue({ id: 'match1', bankTxnId: 'txn1', source: 'PAYMENT' });

      const result = await service.matchTransaction('txn1', 'PAYMENT', 'pay1', 'user1');
      expect(result.source).toBe('PAYMENT');
      expect(mockPrisma.client.bankTxn.update).toHaveBeenCalledWith({
        where: { id: 'txn1' },
        data: { reconciled: true },
      });
    });

    it('should throw if already reconciled', async () => {
      mockPrisma.client.bankTxn.findUnique.mockResolvedValue({ id: 'txn1', reconciled: true });

      await expect(service.matchTransaction('txn1', 'PAYMENT', 'pay1', 'user1'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('autoMatch', () => {
    it('should auto-match payment within ±3 days', async () => {
      mockPrisma.client.bankAccount.findUnique.mockResolvedValue({ id: 'acc1' });
      mockPrisma.client.bankTxn.findMany.mockResolvedValue([
        { id: 'txn1', amount: 50000, postedAt: new Date('2025-01-15'), reconciled: false },
      ]);
      mockPrisma.client.payment.findFirst.mockResolvedValue({ id: 'pay1', amount: 50000 });
      mockPrisma.client.reconcileMatch.findFirst.mockResolvedValue(null);

      const result = await service.autoMatch('acc1');
      expect(result.matched).toBeGreaterThan(0);
    });
  });

  describe('getUnreconciled', () => {
    it('should return unreconciled transactions', async () => {
      mockPrisma.client.bankTxn.findMany.mockResolvedValue([
        { id: 'txn1', reconciled: false, bankAccount: { name: 'Stanbic' } },
      ]);

      const result = await service.getUnreconciled('acc1');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].reconciled).toBe(false);
    });
  });
});
