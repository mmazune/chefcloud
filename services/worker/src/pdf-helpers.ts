/**
 * M4: PDF Generation Helpers for Worker
 *
 * Generates professional PDF reports for shift-end reports.
 */

import PDFDocument from 'pdfkit';
import { ShiftEndReport } from './types/report-types';
import { createWriteStream } from 'fs';

/**
 * Generate a comprehensive PDF report
 */
export async function generateShiftEndPDF(
  report: ShiftEndReport,
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = createWriteStream(outputPath);

    stream.on('finish', resolve);
    stream.on('error', reject);

    doc.pipe(stream);

    // Header
    doc.fontSize(20).text('Shift-End Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(new Date().toISOString(), { align: 'center' });
    doc.moveDown(1);

    // Shift Info
    doc.fontSize(12);
    doc.text(`Branch: ${report.branchName}`, { continued: false });
    doc.text(`Shift ID: ${report.shiftId}`);
    doc.text(`Opened: ${report.openedAt.toLocaleString()} by ${report.openedBy}`);
    doc.text(`Closed: ${report.closedAt.toLocaleString()} by ${report.closedBy || 'N/A'}`);
    doc.moveDown(1);

    // Sales Report
    doc.fontSize(14).text('Sales Report', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(`Total Sales: ${report.sales.totalSales.toFixed(2)} UGX`);
    doc.text(`Total Orders: ${report.sales.totalOrders}`);
    doc.text(`Average Order Value: ${report.sales.avgOrderValue.toFixed(2)} UGX`);
    doc.text(`Tips: ${report.sales.tips.toFixed(2)} UGX`);
    doc.moveDown(0.5);

    // Sales by Category
    if (report.sales.byCategory.length > 0) {
      doc.fontSize(12).text('Sales by Category', { underline: true });
      doc.fontSize(10);
      for (const cat of report.sales.byCategory.slice(0, 5)) {
        doc.text(`  ${cat.name}: ${cat.quantity} units, ${cat.revenue.toFixed(2)} UGX`);
      }
      doc.moveDown(0.5);
    }

    // Top Items
    if (report.sales.byItem.length > 0) {
      doc.fontSize(12).text('Top Items', { underline: true });
      doc.fontSize(10);
      const topItems = report.sales.byItem.sort((a, b) => b.revenue - a.revenue).slice(0, 5);
      for (const item of topItems) {
        doc.text(`  ${item.name}: ${item.quantity} sold, ${item.revenue.toFixed(2)} UGX`);
      }
      doc.moveDown(0.5);
    }

    // Payment Methods
    if (report.sales.byPaymentMethod.length > 0) {
      doc.fontSize(12).text('Payment Methods', { underline: true });
      doc.fontSize(10);
      for (const pm of report.sales.byPaymentMethod) {
        doc.text(`  ${pm.method}: ${pm.count} txns, ${pm.amount.toFixed(2)} UGX`);
      }
      doc.moveDown(1);
    }

    // Service Report
    doc.fontSize(14).text('Service Report', { underline: true });
    doc.moveDown(0.5);
    if (report.service.waiters.length > 0) {
      doc.fontSize(10);
      for (const waiter of report.service.waiters.slice(0, 5)) {
        doc.text(`${waiter.waiterName}:`);
        doc.text(`  Orders: ${waiter.ordersServed}, Sales: ${waiter.totalSales.toFixed(2)} UGX`);
        doc.text(`  Voids: ${waiter.voidCount} (${waiter.voidValue.toFixed(2)} UGX)`);
        doc.text(`  Discounts: ${waiter.discountCount} (${waiter.discountValue.toFixed(2)} UGX)`);
        doc.text(`  No-Drinks Orders: ${waiter.noDrinksCount}`);
        doc.moveDown(0.3);
      }
    } else {
      doc.fontSize(10).text('No waiter data available');
    }
    doc.moveDown(1);

    // Stock Report
    doc.fontSize(14).text('Stock Report', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(`Total Usage Value: ${report.stock.totalUsageValue.toFixed(2)} UGX`);
    doc.text(`Total Variance Value: ${report.stock.totalVarianceValue.toFixed(2)} UGX`);
    doc.text(`Total Wastage Value: ${report.stock.totalWastageValue.toFixed(2)} UGX`);
    doc.moveDown(0.5);

    if (report.stock.lowStockItems.length > 0) {
      doc.fontSize(12).text('Low Stock Items', { underline: true });
      doc.fontSize(10);
      for (const item of report.stock.lowStockItems.slice(0, 5)) {
        doc.text(`  ${item.itemName}: ${item.currentStock} (reorder at ${item.reorderLevel})`);
      }
      doc.moveDown(1);
    }

    // KDS Metrics
    doc.fontSize(14).text('Kitchen/Bar Performance', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(`Total Tickets: ${report.kdsMetrics.totalTickets}`);
    doc.text(`SLA Green: ${report.kdsMetrics.slaMetrics.greenPct.toFixed(1)}%`);
    doc.text(`SLA Orange: ${report.kdsMetrics.slaMetrics.orangePct.toFixed(1)}%`);
    doc.text(`SLA Red: ${report.kdsMetrics.slaMetrics.redPct.toFixed(1)}%`);
    doc.moveDown(0.5);

    if (report.kdsMetrics.byStation.length > 0) {
      doc.fontSize(12).text('By Station', { underline: true });
      doc.fontSize(10);
      for (const station of report.kdsMetrics.byStation) {
        doc.text(
          `  ${station.station}: Green ${station.green}, Orange ${station.orange}, Red ${station.red}`,
        );
      }
      doc.moveDown(1);
    }

    // Staff Performance
    doc.fontSize(14).text('Staff Performance', { underline: true });
    doc.moveDown(0.5);
    if (report.staff.topPerformers.length > 0) {
      doc.fontSize(12).text('Top Performers', { underline: true });
      doc.fontSize(10);
      for (const perf of report.staff.topPerformers) {
        doc.text(`  ${perf.userName}: ${perf.metric} = ${perf.value.toFixed(2)}`);
      }
      doc.moveDown(0.5);
    }

    if (report.staff.needsImprovement.length > 0) {
      doc.fontSize(12).text('Needs Improvement', { underline: true });
      doc.fontSize(10);
      for (const ni of report.staff.needsImprovement) {
        doc.text(`  ${ni.userName}: ${ni.issue} (${ni.count} occurrences)`);
      }
      doc.moveDown(1);
    }

    // Anomalies
    if (report.anomalies.length > 0) {
      doc.fontSize(14).text('Anomalies Detected', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      for (const anomaly of report.anomalies.slice(0, 10)) {
        doc.text(`  [${anomaly.severity}] ${anomaly.type}: ${anomaly.description}`);
        doc.text(`    Order: ${anomaly.orderId}, User: ${anomaly.userId}`);
        doc.moveDown(0.2);
      }
    }

    // Footer
    doc.moveDown(1);
    doc.fontSize(8).text(`Generated: ${new Date().toISOString()}`, { align: 'center' });

    doc.end();
  });
}
