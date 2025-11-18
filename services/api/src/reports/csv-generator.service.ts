import { Injectable } from '@nestjs/common';
import { ShiftEndReport, PeriodDigest, FranchiseDigest } from './dto/report-content.dto';

/**
 * M4: CSV Generation Service
 * Generates CSV files from report data for machine-readable exports
 */
@Injectable()
export class CsvGeneratorService {

  /**
   * Generate sales CSV from shift-end report
   */
  generateSalesCSV(report: ShiftEndReport): string {
    const lines: string[] = [];
    
    // Header
    lines.push('Category,Item,Quantity,Revenue,Percentage');
    
    // Sales by item
    report.sales.byItem.forEach((item) => {
      // Note: Category lookup would need item-category mapping from DB
      const category = 'N/A';
      
      lines.push(`${this.escapeCSV(category)},${this.escapeCSV(item.itemName)},${item.quantity},${item.revenue},${((item.revenue / report.sales.totals.revenue) * 100).toFixed(2)}`);
    });
    
    // Summary row
    lines.push('');
    lines.push(`TOTAL,,${report.sales.totals.orders},${report.sales.totals.revenue},100.00`);
    
    return lines.join('\n');
  }

  /**
   * Generate service (waiter) CSV from shift-end report
   */
  generateServiceCSV(report: ShiftEndReport): string {
    const lines: string[] = [];
    
    // Header
    lines.push('Waiter,Orders,Revenue,Avg Check,Voids,Void Amount,Discounts,Discount Amount,No-Drinks Rate');
    
    // Per waiter
    report.service.byWaiter.forEach((waiter) => {
      lines.push(
        `${this.escapeCSV(waiter.userName)},` +
        `${waiter.orders},` +
        `${waiter.revenue.toFixed(2)},` +
        `${waiter.averageCheck.toFixed(2)},` +
        `${waiter.voidCount},` +
        `${waiter.voidAmount.toFixed(2)},` +
        `${waiter.discountCount},` +
        `${waiter.discountAmount.toFixed(2)},` +
        `${(waiter.noDrinksRate * 100).toFixed(2)}%`
      );
    });
    
    // Summary row
    lines.push('');
    lines.push(
      `TOTAL,` +
      `${report.service.byWaiter.reduce((s, w) => s + w.orders, 0)},` +
      `${report.service.byWaiter.reduce((s, w) => s + w.revenue, 0).toFixed(2)},` +
      `,` +
      `${report.service.totals.totalVoids},` +
      `${report.service.totals.totalVoidAmount.toFixed(2)},` +
      `${report.service.totals.totalDiscounts},` +
      `${report.service.totals.totalDiscountAmount.toFixed(2)},`
    );
    
    return lines.join('\n');
  }

  /**
   * Generate stock/wastage CSV from shift-end report
   */
  generateStockCSV(report: ShiftEndReport): string {
    const lines: string[] = [];
    
    // Header
    lines.push('Item,Usage (units),Usage Cost,Wastage (units),Wastage Cost,Reason');
    
    // Create a map of items with both usage and wastage
    const itemMap = new Map<string, { name: string; usageQty: number; usageCost: number; wastageQty: number; wastageCost: number; reason: string }>();
    
    report.stock.usage.forEach((u) => {
      itemMap.set(u.itemId, {
        name: u.itemName,
        usageQty: u.unitUsed,
        usageCost: u.costUsed,
        wastageQty: 0,
        wastageCost: 0,
        reason: '',
      });
    });
    
    report.stock.wastage.forEach((w) => {
      const existing = itemMap.get(w.itemId);
      if (existing) {
        existing.wastageQty = w.quantity;
        existing.wastageCost = w.cost;
        existing.reason = w.reason;
      } else {
        itemMap.set(w.itemId, {
          name: w.itemName,
          usageQty: 0,
          usageCost: 0,
          wastageQty: w.quantity,
          wastageCost: w.cost,
          reason: w.reason,
        });
      }
    });
    
    // Output rows
    itemMap.forEach((item) => {
      lines.push(
        `${this.escapeCSV(item.name)},` +
        `${item.usageQty.toFixed(2)},` +
        `${item.usageCost.toFixed(2)},` +
        `${item.wastageQty.toFixed(2)},` +
        `${item.wastageCost.toFixed(2)},` +
        `${this.escapeCSV(item.reason)}`
      );
    });
    
    // Summary
    lines.push('');
    lines.push(
      `TOTAL,` +
      `,` +
      `${report.stock.totals.totalUsageCost.toFixed(2)},` +
      `,` +
      `${report.stock.totals.totalWastageCost.toFixed(2)},` +
      ``
    );
    
    return lines.join('\n');
  }

  /**
   * Generate KDS performance CSV from shift-end report
   */
  generateKdsCSV(report: ShiftEndReport): string {
    const lines: string[] = [];
    
    // Header
    lines.push('Station,Tickets,Avg Minutes,Green,Orange,Red,SLA %');
    
    // Per station
    report.kds.byStation.forEach((station) => {
      lines.push(
        `${station.station},` +
        `${station.ticketsCompleted},` +
        `${station.averageCompletionMinutes.toFixed(2)},` +
        `${station.slaBreaches.green},` +
        `${station.slaBreaches.orange},` +
        `${station.slaBreaches.red},` +
        `${station.slaPercentage.toFixed(2)}%`
      );
    });
    
    // Summary
    lines.push('');
    lines.push(
      `TOTAL,` +
      `${report.kds.totals.totalTickets},` +
      `${report.kds.totals.averageCompletionMinutes.toFixed(2)},` +
      `,,,` +
      `${report.kds.totals.overallSlaPercentage.toFixed(2)}%`
    );
    
    return lines.join('\n');
  }

  /**
   * Generate complete shift-end report CSV (summary + details)
   */
  generateShiftEndCSV(report: ShiftEndReport): string {
    const sections: string[] = [];
    
    // Report header
    sections.push('ChefCloud Shift-End Report');
    sections.push(`Report ID: ${report.reportId}`);
    sections.push(`Shift ID: ${report.shiftId}`);
    sections.push(`Generated: ${report.generatedAt.toISOString()}`);
    sections.push(`Period: ${report.period.startedAt.toISOString()} to ${report.period.closedAt.toISOString()}`);
    sections.push('');
    
    // Sales section
    sections.push('=== SALES ===');
    sections.push(this.generateSalesCSV(report));
    sections.push('');
    
    // Service section
    sections.push('=== SERVICE (WAITERS) ===');
    sections.push(this.generateServiceCSV(report));
    sections.push('');
    
    // Stock section
    sections.push('=== STOCK & WASTAGE ===');
    sections.push(this.generateStockCSV(report));
    sections.push('');
    
    // KDS section
    sections.push('=== KDS PERFORMANCE ===');
    sections.push(this.generateKdsCSV(report));
    sections.push('');
    
    return sections.join('\n');
  }

  /**
   * Generate period digest CSV
   * TODO: Implement once PeriodDigest DTO matches implementation
   */
  generatePeriodDigestCSV(_digest: PeriodDigest): string {
    return 'Period digest CSV generation not yet implemented';
  }

  /**
   * Generate franchise digest CSV
   * TODO: Implement once FranchiseDigest DTO matches implementation
   */
  generateFranchiseDigestCSV(_digest: FranchiseDigest): string {
    return 'Franchise digest CSV generation not yet implemented';
  }

  /**
   * Escape CSV field (handle commas, quotes, newlines)
   */
  private escapeCSV(field: string): string {
    if (!field) return '';
    
    // If field contains comma, quote, or newline, wrap in quotes and escape quotes
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    
    return field;
  }
}
