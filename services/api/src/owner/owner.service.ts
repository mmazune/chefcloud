/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class OwnerService {
  private readonly logger = new Logger(OwnerService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // Initialize SMTP transport
    const smtpHost = this.configService.get<string>('SMTP_HOST', 'localhost');
    const smtpPort = this.configService.get<number>('SMTP_PORT', 1025);
    const smtpUser = this.configService.get<string>('SMTP_USER', '');
    const smtpPass = this.configService.get<string>('SMTP_PASS', '');
    const smtpSecure = this.configService.get<string>('SMTP_SECURE', 'false') === 'true';

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: smtpUser
        ? {
            user: smtpUser,
            pass: smtpPass,
          }
        : undefined,
    });

    this.logger.log(`[SMTP] Configured: ${smtpHost}:${smtpPort} (secure=${smtpSecure})`);
  }

  async getOverview(orgId: string): Promise<any> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get branches for org
    const branches = await this.prisma.branch.findMany({
      where: { orgId },
      select: { id: true },
    });
    const branchIds = branches.map((b) => b.id);

    // Sales today
    const salesToday = await this.prisma.payment.aggregate({
      where: {
        order: { branchId: { in: branchIds } },
        createdAt: { gte: startOfToday },
      },
      _sum: { amount: true },
    });

    // Sales 7 days
    const sales7d = await this.prisma.payment.aggregate({
      where: {
        order: { branchId: { in: branchIds } },
        createdAt: { gte: sevenDaysAgo },
      },
      _sum: { amount: true },
    });

    // Sales last 7 days (daily breakdown for chart)
    const sales7dArray: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(startOfToday);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const daySales = await this.prisma.payment.aggregate({
        where: {
          order: { branchId: { in: branchIds } },
          createdAt: { gte: dayStart, lt: dayEnd },
        },
        _sum: { amount: true },
      });
      sales7dArray.push(parseFloat(daySales._sum?.amount?.toString() || '0'));
    }

    // Top 5 items by quantity ordered in last 7 days
    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        order: {
          branchId: { in: branchIds },
          createdAt: { gte: sevenDaysAgo },
          status: 'CLOSED',
        },
      },
      include: {
        menuItem: { select: { name: true } },
      },
    });

    const itemCounts: Record<string, { name: string; qty: number; revenue: number }> = {};
    orderItems.forEach((oi) => {
      const key = oi.menuItemId;
      if (!itemCounts[key]) {
        itemCounts[key] = { name: oi.menuItem.name, qty: 0, revenue: 0 };
      }
      itemCounts[key].qty += oi.quantity;
      itemCounts[key].revenue += parseFloat(oi.subtotal.toString());
    });

    const topItems = Object.values(itemCounts)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
      .map((item, idx) => ({
        rank: idx + 1,
        name: item.name,
        qty: item.qty,
        revenue: item.revenue,
      }));

    // Discounts today
    const discountsToday = await this.prisma.discount.aggregate({
      where: {
        order: { branchId: { in: branchIds } },
        createdAt: { gte: startOfToday },
      },
      _sum: { value: true },
      _count: true,
    });

    // Voids today (from anomaly events)
    const voidsToday = await this.prisma.anomalyEvent.count({
      where: {
        branchId: { in: branchIds },
        type: 'LATE_VOID',
        occurredAt: { gte: startOfToday },
      },
    });

    // Anomalies today
    const anomaliesToday = await this.prisma.anomalyEvent.count({
      where: {
        branchId: { in: branchIds },
        occurredAt: { gte: startOfToday },
      },
    });

    // MOMO vs CASH breakdown (last 7 days) - group by method on orders
    const payments = await this.prisma.payment.groupBy({
      by: ['method'],
      where: {
        order: { branchId: { in: branchIds } },
        createdAt: { gte: sevenDaysAgo },
      },
      _sum: { amount: true },
    });

    const paymentBreakdown: Record<string, string> = {};
    const momoAmount = payments.find((p) => p.method === 'MOMO')?._sum?.amount?.toString() || '0';
    const cashAmount = payments.find((p) => p.method === 'CASH')?._sum?.amount?.toString() || '0';
    payments.forEach((p) => {
      paymentBreakdown[p.method] = p._sum?.amount?.toString() || '0';
    });

    // Branch comparisons (sales last 7 days)
    const branchSales: Record<string, number> = {};
    for (const branchId of branchIds) {
      const branchPayments = await this.prisma.payment.aggregate({
        where: {
          order: { branchId },
          createdAt: { gte: sevenDaysAgo },
        },
        _sum: { amount: true },
      });
      branchSales[branchId] = parseFloat(branchPayments._sum?.amount?.toString() || '0');
    }

    const branchData = await this.prisma.branch.findMany({
      where: { id: { in: branchIds } },
      select: { id: true, name: true },
    });

    const branchComparisons = branchData.map((b) => ({
      branchId: b.id,
      branchName: b.name,
      sales7d: branchSales[b.id]?.toString() || '0',
    }));

    return {
      salesToday: salesToday._sum?.amount?.toString() || '0',
      sales7d: sales7d._sum?.amount?.toString() || '0',
      sales7dArray,
      topItems,
      discountsToday: {
        count: discountsToday._count,
        amount: discountsToday._sum?.value?.toString() || '0',
      },
      voidsToday,
      anomaliesToday,
      paymentBreakdown,
      paymentSplit: {
        momo: momoAmount,
        cash: cashAmount,
      },
      branchComparisons,
    };
  }

  async createDigest(
    orgId: string,
    name: string,
    cron: string,
    recipients: string[],
    sendOnShiftClose?: boolean,
  ): Promise<any> {
    return this.prisma.ownerDigest.create({
      data: {
        orgId,
        name,
        cron,
        recipients,
        sendOnShiftClose: sendOnShiftClose || false,
      },
    });
  }

  async updateDigest(
    id: string,
    updates: {
      name?: string;
      cron?: string;
      recipients?: string[];
      sendOnShiftClose?: boolean;
    },
  ): Promise<any> {
    return this.prisma.ownerDigest.update({
      where: { id },
      data: updates,
    });
  }

  async getDigest(id: string): Promise<any> {
    return this.prisma.ownerDigest.findUnique({ where: { id } });
  }

  async updateDigestLastRun(id: string, timestamp: Date): Promise<any> {
    return this.prisma.ownerDigest.update({
      where: { id },
      data: { lastRunAt: timestamp },
    });
  }

  // CSV builders
  buildTopItemsCSV(items: any[]): string {
    let csv = 'name,qty,revenue\n';
    items.forEach((item) => {
      csv += `"${item.name}",${item.qty},${item.revenue.toFixed(2)}\n`;
    });
    return csv;
  }

  buildDiscountsCSV(discounts: any[]): string {
    let csv = 'user,count,total\n';
    discounts.forEach((d) => {
      csv += `"${d.user}",${d.count},${d.total.toFixed(2)}\n`;
    });
    return csv;
  }

  buildVoidsCSV(voids: any[]): string {
    let csv = 'user,count,total\n';
    voids.forEach((v) => {
      csv += `"${v.user}",${v.count},${v.total.toFixed(2)}\n`;
    });
    return csv;
  }

  // PDF builder with charts
  async buildDigestPDF(overview: any, orgName: string): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    // Title
    doc.fontSize(20).text(`Owner Digest - ${orgName}`, { align: 'center' });
    doc.fontSize(10).text(new Date().toISOString().split('T')[0], { align: 'center' });
    doc.moveDown(2);

    // Sales Summary
    doc.fontSize(14).text('Sales Summary', { underline: true });
    doc.fontSize(10).text(`Today: $${overview.salesToday}`);
    doc.text(`Last 7 Days: $${overview.sales7d}`);
    doc.moveDown();

    // Sales 7d Sparkline Chart
    if (overview.sales7dArray && overview.sales7dArray.length > 0) {
      doc.fontSize(12).text('Sales Last 7 Days (Sparkline)', { underline: true });
      const chartX = 100;
      const chartY = doc.y + 10;
      const chartWidth = 400;
      const chartHeight = 60;
      const maxSales = Math.max(...overview.sales7dArray, 1);

      // Draw axes
      doc.strokeColor('#cccccc').lineWidth(1);
      doc
        .moveTo(chartX, chartY)
        .lineTo(chartX, chartY + chartHeight)
        .stroke();
      doc
        .moveTo(chartX, chartY + chartHeight)
        .lineTo(chartX + chartWidth, chartY + chartHeight)
        .stroke();

      // Draw sparkline
      doc.strokeColor('#0033FF').lineWidth(2);
      const stepX = chartWidth / (overview.sales7dArray.length - 1 || 1);
      overview.sales7dArray.forEach((val: number, idx: number) => {
        const x = chartX + idx * stepX;
        const y = chartY + chartHeight - (val / maxSales) * chartHeight;
        if (idx === 0) {
          doc.moveTo(x, y);
        } else {
          doc.lineTo(x, y);
        }
      });
      doc.stroke();
      doc.moveDown(5);
    }

    // Payment Split Bar Chart
    if (overview.paymentSplit) {
      doc.fontSize(12).text('Payment Split (MOMO vs CASH)', { underline: true });
      const momoAmt = parseFloat(overview.paymentSplit.momo);
      const cashAmt = parseFloat(overview.paymentSplit.cash);
      const total = momoAmt + cashAmt;

      if (total > 0) {
        const barX = 100;
        const barY = doc.y + 10;
        const barWidth = 400;
        const barHeight = 30;
        const momoWidth = (momoAmt / total) * barWidth;

        // MOMO bar (blue)
        doc.fillColor('#0033FF').rect(barX, barY, momoWidth, barHeight).fill();

        // CASH bar (green)
        doc
          .fillColor('#28a745')
          .rect(barX + momoWidth, barY, barWidth - momoWidth, barHeight)
          .fill();

        // Labels
        doc.fillColor('#000000').fontSize(10);
        doc.text(
          `MOMO: $${momoAmt.toFixed(2)} (${((momoAmt / total) * 100).toFixed(1)}%)`,
          barX,
          barY + barHeight + 5,
        );
        doc.text(
          `CASH: $${cashAmt.toFixed(2)} (${((cashAmt / total) * 100).toFixed(1)}%)`,
          barX + 200,
          barY + barHeight + 5,
        );
      }
      doc.moveDown(4);
    }

    // Anomalies
    doc.fontSize(12).text(`Anomalies Today: ${overview.anomaliesToday}`);
    doc.moveDown();

    // Footer
    doc.fontSize(8).text(`Generated at ${new Date().toISOString()}`, { align: 'center' });

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * Send owner digest email via SMTP with PDF and CSV attachments
   */
  async sendDigestEmail(recipients: string[], orgName: string, overview: any): Promise<void> {
    const fromEmail = this.configService.get<string>(
      'DIGEST_FROM_EMAIL',
      'noreply@chefcloud.local',
    );
    const subject = `Owner Digest - ${orgName} - ${new Date().toISOString().split('T')[0]}`;

    // Build attachments
    const pdfBuffer = await this.buildDigestPDF(overview, orgName);
    const topItemsCSV = this.buildTopItemsCSV(overview.topItems || []);

    // Mock discount/void data for CSVs
    const discountsCSV = this.buildDiscountsCSV([]);
    const voidsCSV = this.buildVoidsCSV([]);

    const mailOptions = {
      from: fromEmail,
      to: recipients.join(', '),
      subject,
      text: `Please find attached your ChefCloud owner digest for ${orgName}.\n\nSales Today: $${overview.salesToday}\nSales Last 7 Days: $${overview.sales7d}\nAnomalies Today: ${overview.anomaliesToday}`,
      html: `
        <h2>Owner Digest - ${orgName}</h2>
        <p><strong>Date:</strong> ${new Date().toISOString().split('T')[0]}</p>
        <h3>Sales Summary</h3>
        <ul>
          <li>Today: $${overview.salesToday}</li>
          <li>Last 7 Days: $${overview.sales7d}</li>
        </ul>
        <h3>Alerts</h3>
        <ul>
          <li>Anomalies Today: ${overview.anomaliesToday}</li>
          <li>Voids Today: ${overview.voidsToday}</li>
        </ul>
        <p>Please see attached PDF and CSVs for detailed reports.</p>
      `,
      attachments: [
        {
          filename: `digest-${new Date().toISOString().split('T')[0]}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
        {
          filename: 'top-items.csv',
          content: topItemsCSV,
          contentType: 'text/csv',
        },
        {
          filename: 'discounts.csv',
          content: discountsCSV,
          contentType: 'text/csv',
        },
        {
          filename: 'voids.csv',
          content: voidsCSV,
          contentType: 'text/csv',
        },
      ],
    };

    await this.transporter.sendMail(mailOptions);

    this.logger.log(`[SMTP] sent -> to: ${recipients.join(', ')}, subject: ${subject}`);
  }
}
