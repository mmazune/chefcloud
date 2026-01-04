/**
 * M10.7: Payroll GL Stub Service
 * 
 * DEFERRED: Full GL posting for employer contributions and tax liabilities.
 * 
 * Current M10.6 GL Posting:
 * - On POSTED: Dr Labor Expense (6000) / Cr Wages Payable (2105)
 * - On PAID: Dr Wages Payable (2105) / Cr Cash (1000)
 * 
 * Required for Full Implementation (DEFERRED to M10.8+):
 * 1. GL accounts for employer tax expense (e.g., 6010)
 * 2. GL accounts for employer tax payable (e.g., 2110)
 * 3. GL accounts for tax withholding payable (e.g., 2115)
 * 4. Configuration UI for org-level account mapping
 * 5. Jurisdiction-specific posting rules
 * 
 * Acceptance Criteria for Future Implementation:
 * - [ ] Employer contrib accrual: Dr Employer Taxes Expense / Cr Employer Taxes Payable
 * - [ ] Taxes withheld posting: Dr Wages Payable / Cr Taxes Payable (or allocate within payroll posting)
 * - [ ] Configurable GL account mapping per org
 * - [ ] Journal entries linked to payroll run
 * - [ ] Reversal support for voided payroll runs
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Stub account codes for future implementation
const STUB_ACCOUNTS = {
  EMPLOYER_TAX_EXPENSE: '6010',  // Expense account for employer taxes
  EMPLOYER_TAX_PAYABLE: '2110',  // Liability for employer taxes owed
  TAX_WITHHOLDING_PAYABLE: '2115', // Liability for withheld employee taxes
};

@Injectable()
export class PayrollGlStubService {
  private readonly logger = new Logger(PayrollGlStubService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * STUB: Post employer contributions to GL
   * 
   * Future implementation will:
   * 1. Create journal entry: Dr Employer Taxes Expense / Cr Employer Taxes Payable
   * 2. Link journal to payroll run
   * 3. Update payroll run with journal reference
   */
  async postEmployerContributions(
    _orgId: string,
    _payrollRunId: string,
    _userId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.warn('postEmployerContributions is a STUB - GL posting deferred to M10.8+');
    
    return {
      success: false,
      message: 'DEFERRED: Employer contribution GL posting requires account configuration (see M10.7_PARITY_REAUDIT.md)',
    };
  }

  /**
   * STUB: Post tax withholding liability to GL
   * 
   * Future implementation will:
   * 1. Create journal entry: Dr Wages Payable / Cr Taxes Payable
   * 2. Link journal to payroll run
   * 3. Update payroll run with journal reference
   */
  async postTaxWithholding(
    _orgId: string,
    _payrollRunId: string,
    _userId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.warn('postTaxWithholding is a STUB - GL posting deferred to M10.8+');
    
    return {
      success: false,
      message: 'DEFERRED: Tax withholding GL posting requires account configuration (see M10.7_PARITY_REAUDIT.md)',
    };
  }

  /**
   * Get stub account information for documentation
   */
  getStubAccountInfo(): typeof STUB_ACCOUNTS {
    return { ...STUB_ACCOUNTS };
  }

  /**
   * Check if enhanced GL posting is configured for org
   * Always returns false until M10.8+ implementation
   */
  async isEnhancedGlEnabled(_orgId: string): Promise<boolean> {
    return false;
  }
}
