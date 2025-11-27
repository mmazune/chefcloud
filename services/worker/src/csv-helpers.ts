/**
 * M4: CSV Generation Helpers for Worker
 *
 * Generates CSV exports for shift-end reports.
 * Matches the CsvGeneratorService from the API.
 */

import { ShiftEndReport } from './types/report-types';

/**
 * Generate CSV export for a shift-end report
 */
export function generateShiftEndCSV(report: ShiftEndReport): string {
  const sections: string[] = [];

  // Header
  sections.push('Shift-End Report');
  sections.push(`Shift ID: ${report.shiftId}`);
  sections.push(`Branch: ${report.branchName}`);
  sections.push(`Opened: ${report.openedAt.toISOString()}`);
  sections.push(`Closed: ${report.closedAt.toISOString()}`);
  sections.push(`Opened By: ${report.openedBy}`);
  sections.push(`Closed By: ${report.closedBy || 'N/A'}`);
  sections.push('');

  // Sales Report
  sections.push('SALES REPORT');
  sections.push('');
  sections.push(`Total Sales,${report.sales.totalSales}`);
  sections.push(`Total Orders,${report.sales.totalOrders}`);
  sections.push(`Average Order Value,${report.sales.avgOrderValue.toFixed(2)}`);
  sections.push(`Tips,${report.sales.tips}`);
  sections.push('');

  sections.push('Sales by Category');
  sections.push('Category,Quantity,Revenue');
  for (const cat of report.sales.byCategory) {
    sections.push(`${cat.name},${cat.quantity},${cat.revenue.toFixed(2)}`);
  }
  sections.push('');

  sections.push('Top Items');
  sections.push('Item,Quantity,Revenue');
  const topItems = report.sales.byItem.sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  for (const item of topItems) {
    sections.push(`${item.name},${item.quantity},${item.revenue.toFixed(2)}`);
  }
  sections.push('');

  sections.push('Payment Methods');
  sections.push('Method,Count,Amount');
  for (const pm of report.sales.byPaymentMethod) {
    sections.push(`${pm.method},${pm.count},${pm.amount.toFixed(2)}`);
  }
  sections.push('');

  // Service Report
  sections.push('SERVICE REPORT');
  sections.push('');
  sections.push(
    'Waiter,Orders,Total Sales,Avg Order,Voids,Void Value,Discounts,Discount Value,No-Drinks',
  );
  for (const waiter of report.service.waiters) {
    sections.push(
      `${waiter.waiterName},${waiter.ordersServed},${waiter.totalSales.toFixed(2)},${waiter.avgOrderValue.toFixed(2)},${waiter.voidCount},${waiter.voidValue.toFixed(2)},${waiter.discountCount},${waiter.discountValue.toFixed(2)},${waiter.noDrinksCount}`,
    );
  }
  sections.push('');

  // Stock Report
  sections.push('STOCK REPORT');
  sections.push('');
  sections.push(`Total Usage Value,${report.stock.totalUsageValue.toFixed(2)}`);
  sections.push(`Total Variance Value,${report.stock.totalVarianceValue.toFixed(2)}`);
  sections.push(`Total Wastage Value,${report.stock.totalWastageValue.toFixed(2)}`);
  sections.push('');

  if (report.stock.lowStockItems.length > 0) {
    sections.push('Low Stock Items');
    sections.push('Item,Current Stock,Reorder Level');
    for (const item of report.stock.lowStockItems) {
      sections.push(`${item.itemName},${item.currentStock},${item.reorderLevel}`);
    }
    sections.push('');
  }

  // KDS Report
  sections.push('KDS METRICS');
  sections.push('');
  sections.push(`Total Tickets,${report.kdsMetrics.totalTickets}`);
  sections.push(`Green SLA,${report.kdsMetrics.slaMetrics.greenPct.toFixed(1)}%`);
  sections.push(`Orange SLA,${report.kdsMetrics.slaMetrics.orangePct.toFixed(1)}%`);
  sections.push(`Red SLA,${report.kdsMetrics.slaMetrics.redPct.toFixed(1)}%`);
  sections.push('');

  sections.push('By Station');
  sections.push('Station,Green,Orange,Red');
  for (const station of report.kdsMetrics.byStation) {
    sections.push(`${station.station},${station.green},${station.orange},${station.red}`);
  }
  sections.push('');

  // Staff Performance
  sections.push('STAFF PERFORMANCE');
  sections.push('');
  sections.push('Top Performers');
  sections.push('Name,Metric,Value');
  for (const perf of report.staff.topPerformers) {
    sections.push(`${perf.userName},${perf.metric},${perf.value.toFixed(2)}`);
  }
  sections.push('');

  if (report.staff.needsImprovement.length > 0) {
    sections.push('Needs Improvement');
    sections.push('Name,Issue,Count');
    for (const ni of report.staff.needsImprovement) {
      sections.push(`${ni.userName},${ni.issue},${ni.count}`);
    }
    sections.push('');
  }

  // Anomalies
  if (report.anomalies.length > 0) {
    sections.push('ANOMALIES');
    sections.push('');
    sections.push('Order ID,Type,Description,Severity,User,Timestamp');
    for (const anomaly of report.anomalies) {
      sections.push(
        `${anomaly.orderId},${anomaly.type},${anomaly.description},${anomaly.severity},${anomaly.userId},${anomaly.timestamp.toISOString()}`,
      );
    }
  }

  return sections.join('\n');
}
