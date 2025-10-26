// ESC/POS Printer utilities
// Placeholder for printer command generation

export interface PrintJob {
  type: 'receipt' | 'kitchen' | 'report';
  content: string;
  printer?: string;
}

export class EscPosBuilder {
  private commands: Buffer[] = [];

  text(content: string): this {
    this.commands.push(Buffer.from(content, 'utf-8'));
    return this;
  }

  cut(): this {
    // ESC i - Full cut
    this.commands.push(Buffer.from([0x1b, 0x69]));
    return this;
  }

  build(): Buffer {
    return Buffer.concat(this.commands);
  }
}

export const createReceipt = (data: { orderNumber: string; total: number }): Buffer => {
  const builder = new EscPosBuilder();
  return builder
    .text(`Order #${data.orderNumber}\n`)
    .text(`Total: ${data.total}\n`)
    .text('Thank you!\n')
    .cut()
    .build();
};
