// ESC/POS Printer utilities
// Placeholder for printer command generation

export interface PrintJob {
  type: 'receipt' | 'kitchen' | 'report';
  content: string;
  printer?: string;
}

export interface ReceiptData {
  restaurantName: string;
  branchName: string;
  orderNumber: string;
  tableNumber?: string;
  serviceType: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    subtotal: number;
  }>;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: string;
  footer?: string;
  timestamp: Date;
}

export interface KitchenTicketData {
  orderNumber: string;
  tableNumber?: string;
  station: string;
  items: Array<{
    name: string;
    quantity: number;
    modifiers?: string[];
    notes?: string;
  }>;
  timestamp: Date;
}

export interface ReportData {
  type: 'X_REPORT' | 'Z_REPORT';
  shift: {
    openedAt: Date;
    closedAt?: Date;
    openedBy: string;
    closedBy?: string;
    openingFloat: number;
    declaredCash?: number;
    overShort?: number;
  };
  summary: {
    orderCount: number;
    totalSales: number;
    totalDiscount: number;
    paymentsByMethod?: Record<string, number>;
  };
  generatedAt: Date;
}

export class EscPosBuilder {
  private commands: Buffer[] = [];

  // ESC/POS control codes
  private ESC = 0x1b;
  private GS = 0x1d;
  private LF = 0x0a;

  text(content: string): this {
    this.commands.push(Buffer.from(content, 'utf-8'));
    return this;
  }

  newline(): this {
    this.commands.push(Buffer.from([this.LF]));
    return this;
  }

  bold(enable = true): this {
    // ESC E n - Enable/disable bold
    this.commands.push(Buffer.from([this.ESC, 0x45, enable ? 1 : 0]));
    return this;
  }

  align(alignment: 'left' | 'center' | 'right'): this {
    // ESC a n - Select justification
    const alignCode = alignment === 'left' ? 0 : alignment === 'center' ? 1 : 2;
    this.commands.push(Buffer.from([this.ESC, 0x61, alignCode]));
    return this;
  }

  fontSize(size: 'normal' | 'large'): this {
    // GS ! n - Set character size
    const sizeCode = size === 'large' ? 0x11 : 0x00;
    this.commands.push(Buffer.from([this.GS, 0x21, sizeCode]));
    return this;
  }

  cut(): this {
    // GS V m - Paper cut
    this.commands.push(Buffer.from([this.GS, 0x56, 0x00]));
    return this;
  }

  separator(char = '-', length = 32): this {
    this.text(char.repeat(length)).newline();
    return this;
  }

  build(): Buffer {
    return Buffer.concat(this.commands);
  }
}

export const createReceipt = (data: ReceiptData): Buffer => {
  const builder = new EscPosBuilder();

  // Header
  builder
    .align('center')
    .bold(true)
    .fontSize('large')
    .text(data.restaurantName)
    .newline()
    .fontSize('normal')
    .text(data.branchName)
    .newline()
    .bold(false)
    .separator('=', 32)
    .align('left')
    .newline();

  // Order info
  builder
    .text(`Order: ${data.orderNumber}`)
    .newline()
    .text(`Date: ${data.timestamp.toLocaleString()}`)
    .newline();

  if (data.tableNumber) {
    builder.text(`Table: ${data.tableNumber}`).newline();
  }

  builder
    .text(`Type: ${data.serviceType}`)
    .newline()
    .separator('-', 32);

  // Items
  data.items.forEach((item) => {
    builder
      .text(`${item.quantity}x ${item.name}`)
      .newline()
      .text(`   ${item.price.toFixed(2)} x ${item.quantity} = ${item.subtotal.toFixed(2)}`)
      .newline();
  });

  builder.separator('-', 32);

  // Totals
  builder
    .text(`Subtotal: ${data.subtotal.toFixed(2)}`)
    .newline()
    .text(`Tax:      ${data.tax.toFixed(2)}`)
    .newline();

  if (data.discount > 0) {
    builder.text(`Discount: -${data.discount.toFixed(2)}`).newline();
  }

  builder
    .bold(true)
    .text(`TOTAL:    ${data.total.toFixed(2)}`)
    .newline()
    .bold(false)
    .text(`Payment:  ${data.paymentMethod}`)
    .newline()
    .separator('=', 32);

  // Footer
  if (data.footer) {
    builder.align('center').text(data.footer).newline();
  }

  builder
    .align('center')
    .text('Thank you for your visit!')
    .newline()
    .newline()
    .newline()
    .cut();

  return builder.build();
};

export const createKitchenTicket = (data: KitchenTicketData): Buffer => {
  const builder = new EscPosBuilder();

  // Header
  builder
    .align('center')
    .bold(true)
    .fontSize('large')
    .text(data.station)
    .newline()
    .fontSize('normal')
    .bold(false)
    .separator('=', 32)
    .align('left');

  // Order info
  builder
    .bold(true)
    .text(`Order: ${data.orderNumber}`)
    .newline()
    .bold(false)
    .text(`Time: ${data.timestamp.toLocaleTimeString()}`)
    .newline();

  if (data.tableNumber) {
    builder.bold(true).text(`Table: ${data.tableNumber}`).newline().bold(false);
  }

  builder.separator('-', 32);

  // Items
  data.items.forEach((item) => {
    builder
      .bold(true)
      .fontSize('large')
      .text(`${item.quantity}x ${item.name}`)
      .newline()
      .fontSize('normal')
      .bold(false);

    if (item.modifiers && item.modifiers.length > 0) {
      item.modifiers.forEach((mod) => {
        builder.text(`  + ${mod}`).newline();
      });
    }

    if (item.notes) {
      builder.text(`  NOTE: ${item.notes}`).newline();
    }

    builder.newline();
  });

  builder.separator('=', 32).newline().newline().cut();

  return builder.build();
};

export const createReport = (data: ReportData): Buffer => {
  const builder = new EscPosBuilder();

  // Header
  builder
    .align('center')
    .bold(true)
    .fontSize('large')
    .text(data.type === 'X_REPORT' ? 'X REPORT' : 'Z REPORT')
    .newline()
    .fontSize('normal')
    .bold(false)
    .text(`Generated: ${data.generatedAt.toLocaleString()}`)
    .newline()
    .separator('=', 32)
    .align('left');

  // Shift info
  builder
    .text(`Opened: ${data.shift.openedAt.toLocaleString()}`)
    .newline()
    .text(`By: ${data.shift.openedBy}`)
    .newline();

  if (data.shift.closedAt) {
    builder
      .text(`Closed: ${data.shift.closedAt.toLocaleString()}`)
      .newline()
      .text(`By: ${data.shift.closedBy}`)
      .newline();
  }

  builder
    .text(`Opening Float: ${data.shift.openingFloat.toFixed(2)}`)
    .newline()
    .separator('-', 32);

  // Summary
  builder
    .text(`Orders: ${data.summary.orderCount}`)
    .newline()
    .text(`Sales: ${data.summary.totalSales.toFixed(2)}`)
    .newline()
    .text(`Discount: ${data.summary.totalDiscount.toFixed(2)}`)
    .newline();

  if (data.summary.paymentsByMethod) {
    builder.separator('-', 32).text('Payments by Method:').newline();
    Object.entries(data.summary.paymentsByMethod).forEach(([method, amount]) => {
      builder.text(`  ${method}: ${amount.toFixed(2)}`).newline();
    });
  }

  if (data.shift.declaredCash !== undefined) {
    builder
      .separator('-', 32)
      .text(`Declared Cash: ${data.shift.declaredCash.toFixed(2)}`)
      .newline();

    if (data.shift.overShort !== undefined) {
      const status = data.shift.overShort >= 0 ? 'Over' : 'Short';
      builder
        .text(`Over/Short: ${status} ${Math.abs(data.shift.overShort).toFixed(2)}`)
        .newline();
    }
  }

  builder.separator('=', 32).newline().newline().cut();

  return builder.build();
};
