/**
 * M10.7: Payroll Calculation Service
 * 
 * Gross-to-net computation with deterministic rounding.
 * Follows component ordering: EARNING → DEDUCTION_PRE → TAX → DEDUCTION_POST
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@chefcloud/db';
import { CompensationService, CompensationComponentType, CalcMethod, RoundingRule } from './compensation.service';

const Decimal = Prisma.Decimal;

// Component processing order for correct gross-to-net calculation
const COMPONENT_ORDER: Record<CompensationComponentType, number> = {
  EARNING: 1,
  DEDUCTION_PRE: 2,
  TAX: 3,
  DEDUCTION_POST: 4,
  EMPLOYER_CONTRIB: 5,
};

export interface GrossToNetResult {
  grossEarnings: Prisma.Decimal;
  preTaxDeductions: Prisma.Decimal;
  taxableWages: Prisma.Decimal;
  taxesWithheld: Prisma.Decimal;
  postTaxDeductions: Prisma.Decimal;
  netPay: Prisma.Decimal;
  employerContribTotal: Prisma.Decimal;
  totalEmployerCost: Prisma.Decimal;
  breakdown: Array<{
    componentId: string;
    componentCode: string;
    componentName: string;
    type: CompensationComponentType;
    amount: Prisma.Decimal;
  }>;
}

export interface LineCalculationInput {
  userId: string;
  paidHours: number;
  hourlyRate?: number;
}

@Injectable()
export class PayrollCalculationService {
  private readonly logger = new Logger(PayrollCalculationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly compensationService: CompensationService,
  ) {}

  /**
   * Calculate gross-to-net for a single employee line
   */
  async calculateGrossToNet(
    orgId: string,
    userId: string,
    paidHours: number,
    effectiveDate: Date,
    branchId?: string,
    baseHourlyRate?: number,
  ): Promise<GrossToNetResult> {
    // Get effective components for user
    const effectiveComponents = await this.compensationService.getEffectiveComponents(
      orgId,
      userId,
      effectiveDate,
      branchId,
    );

    // Sort by component order
    const sortedComponents = effectiveComponents.sort((a, b) => {
      const orderA = COMPONENT_ORDER[a.component.type as CompensationComponentType] ?? 99;
      const orderB = COMPONENT_ORDER[b.component.type as CompensationComponentType] ?? 99;
      return orderA - orderB;
    });

    // Initialize accumulators
    let grossEarnings = new Decimal(0);
    let preTaxDeductions = new Decimal(0);
    let taxesWithheld = new Decimal(0);
    let postTaxDeductions = new Decimal(0);
    let employerContribTotal = new Decimal(0);

    const breakdown: GrossToNetResult['breakdown'] = [];

    // First pass: Calculate all earnings
    for (const { component, overrideRate, overrideAmount } of sortedComponents) {
      if (component.type !== 'EARNING') continue;

      const amount = this.calculateComponentAmount(
        component,
        paidHours,
        grossEarnings, // Will be 0 for first earnings, but that's fine
        null,
        overrideRate,
        overrideAmount,
        baseHourlyRate,
      );

      grossEarnings = grossEarnings.add(amount);

      breakdown.push({
        componentId: component.id,
        componentCode: component.code,
        componentName: component.name,
        type: component.type,
        amount,
      });
    }

    // Second pass: Pre-tax deductions (reduces taxable wages)
    for (const { component, overrideRate, overrideAmount } of sortedComponents) {
      if (component.type !== 'DEDUCTION_PRE') continue;

      const amount = this.calculateComponentAmount(
        component,
        paidHours,
        grossEarnings,
        this.getEarningsAmount(breakdown, component.earningsCode),
        overrideRate,
        overrideAmount,
      );

      preTaxDeductions = preTaxDeductions.add(amount);

      breakdown.push({
        componentId: component.id,
        componentCode: component.code,
        componentName: component.name,
        type: component.type,
        amount,
      });
    }

    // Calculate taxable wages
    const taxableWages = grossEarnings.sub(preTaxDeductions);

    // Third pass: Taxes (calculated on taxable wages)
    for (const { component, overrideRate, overrideAmount } of sortedComponents) {
      if (component.type !== 'TAX') continue;

      const amount = this.calculateComponentAmount(
        component,
        paidHours,
        taxableWages, // Use taxable wages for tax calculations
        null,
        overrideRate,
        overrideAmount,
      );

      taxesWithheld = taxesWithheld.add(amount);

      breakdown.push({
        componentId: component.id,
        componentCode: component.code,
        componentName: component.name,
        type: component.type,
        amount,
      });
    }

    // Fourth pass: Post-tax deductions
    for (const { component, overrideRate, overrideAmount } of sortedComponents) {
      if (component.type !== 'DEDUCTION_POST') continue;

      const amount = this.calculateComponentAmount(
        component,
        paidHours,
        grossEarnings,
        this.getEarningsAmount(breakdown, component.earningsCode),
        overrideRate,
        overrideAmount,
      );

      postTaxDeductions = postTaxDeductions.add(amount);

      breakdown.push({
        componentId: component.id,
        componentCode: component.code,
        componentName: component.name,
        type: component.type,
        amount,
      });
    }

    // Fifth pass: Employer contributions (cost only, no net impact)
    for (const { component, overrideRate, overrideAmount } of sortedComponents) {
      if (component.type !== 'EMPLOYER_CONTRIB') continue;

      const amount = this.calculateComponentAmount(
        component,
        paidHours,
        grossEarnings,
        null,
        overrideRate,
        overrideAmount,
      );

      employerContribTotal = employerContribTotal.add(amount);

      breakdown.push({
        componentId: component.id,
        componentCode: component.code,
        componentName: component.name,
        type: component.type,
        amount,
      });
    }

    // Calculate net pay: gross - preTax - taxes - postTax
    const netPay = grossEarnings
      .sub(preTaxDeductions)
      .sub(taxesWithheld)
      .sub(postTaxDeductions);

    // Total employer cost: gross + employer contributions
    const totalEmployerCost = grossEarnings.add(employerContribTotal);

    // Final rounding (to cents)
    return {
      grossEarnings: this.roundToCents(grossEarnings),
      preTaxDeductions: this.roundToCents(preTaxDeductions),
      taxableWages: this.roundToCents(taxableWages),
      taxesWithheld: this.roundToCents(taxesWithheld),
      postTaxDeductions: this.roundToCents(postTaxDeductions),
      netPay: this.roundToCents(netPay),
      employerContribTotal: this.roundToCents(employerContribTotal),
      totalEmployerCost: this.roundToCents(totalEmployerCost),
      breakdown,
    };
  }

  /**
   * Calculate amount for a single component
   */
  private calculateComponentAmount(
    component: any,
    paidHours: number,
    grossOrTaxable: Prisma.Decimal,
    specificEarningsAmount: Prisma.Decimal | null,
    overrideRate?: number,
    overrideAmount?: number,
    baseHourlyRate?: number,
  ): Prisma.Decimal {
    const rate = overrideRate ?? component.rate?.toNumber() ?? 0;
    const amount = overrideAmount ?? component.amount?.toNumber() ?? 0;
    const calcMethod = component.calcMethod as CalcMethod;
    const roundingRule = component.roundingRule as RoundingRule;

    let result: Prisma.Decimal;

    switch (calcMethod) {
      case 'FIXED':
        result = new Decimal(amount);
        break;

      case 'PERCENT_OF_GROSS':
        // rate is a percentage (e.g., 18 for 18%)
        result = grossOrTaxable.mul(new Decimal(rate).div(100));
        break;

      case 'PERCENT_OF_EARNINGS_CODE':
        if (specificEarningsAmount) {
          result = specificEarningsAmount.mul(new Decimal(rate).div(100));
        } else {
          result = new Decimal(0);
        }
        break;

      case 'PER_HOUR': {
        // rate is per-hour rate, or use baseHourlyRate if provided
        const hourlyRate = rate > 0 ? rate : (baseHourlyRate ?? 0);
        result = new Decimal(hourlyRate).mul(paidHours);
        break;
      }

      default:
        result = new Decimal(0);
    }

    // Apply caps
    result = this.applyCaps(result, component.capMin, component.capMax);

    // Apply rounding
    result = this.applyRounding(result, roundingRule);

    return result;
  }

  /**
   * Get earnings amount for a specific earnings code
   */
  private getEarningsAmount(
    breakdown: GrossToNetResult['breakdown'],
    earningsCode?: string,
  ): Prisma.Decimal | null {
    if (!earningsCode) return null;

    const earning = breakdown.find(
      b => b.type === 'EARNING' && b.componentCode === earningsCode,
    );

    return earning?.amount ?? null;
  }

  /**
   * Apply min/max caps to amount
   */
  private applyCaps(
    amount: Prisma.Decimal,
    capMin?: any,
    capMax?: any,
  ): Prisma.Decimal {
    let result = amount;

    if (capMin != null) {
      const min = new Decimal(capMin.toString());
      if (result.lt(min)) {
        result = min;
      }
    }

    if (capMax != null) {
      const max = new Decimal(capMax.toString());
      if (result.gt(max)) {
        result = max;
      }
    }

    return result;
  }

  /**
   * Apply rounding rule
   */
  private applyRounding(amount: Prisma.Decimal, rule: RoundingRule): Prisma.Decimal {
    switch (rule) {
      case 'HALF_UP_UNIT':
        // Round to whole unit
        return amount.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

      case 'HALF_UP_CENTS':
      default:
        // Round to cents (2 decimal places)
        return amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }
  }

  /**
   * Round to cents (2 decimal places)
   */
  private roundToCents(amount: Prisma.Decimal): Prisma.Decimal {
    return amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  /**
   * Validate gross-to-net invariant: netPay = gross - preTax - taxes - postTax
   */
  validateInvariant(result: GrossToNetResult): boolean {
    const expected = result.grossEarnings
      .sub(result.preTaxDeductions)
      .sub(result.taxesWithheld)
      .sub(result.postTaxDeductions);

    const expectedRounded = this.roundToCents(expected);
    return expectedRounded.eq(result.netPay);
  }
}
