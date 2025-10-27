import { invoke } from '@tauri-apps/api/tauri';

export async function printReceipt(data: Buffer): Promise<string> {
  const base64Data = data.toString('base64');
  return invoke<string>('print_receipt', { base64Data });
}

export async function testPrint(): Promise<void> {
  // Create a simple test receipt
  const testData = Buffer.from([
    // ESC @ - Initialize printer
    0x1b,
    0x40,

    // Center alignment
    0x1b,
    0x61,
    0x01,

    // Bold on
    0x1b,
    0x45,
    0x01,

    // Large text
    0x1d,
    0x21,
    0x11,

    ...Buffer.from('CHEFCLOUD\n'),

    // Normal text
    0x1d,
    0x21,
    0x00,
    0x1b,
    0x45,
    0x00,

    ...Buffer.from('Test Print\n'),
    ...Buffer.from('======================\n'),

    // Left alignment
    0x1b,
    0x61,
    0x00,

    ...Buffer.from('This is a test receipt\n'),
    ...Buffer.from('from the ChefCloud POS\n'),
    ...Buffer.from('desktop application.\n\n'),

    // Center alignment
    0x1b,
    0x61,
    0x01,
    ...Buffer.from('Thank you!\n\n\n'),

    // Cut paper
    0x1d,
    0x56,
    0x00,
  ]);

  try {
    const result = await printReceipt(testData);
    console.log('Print result:', result);
    alert(`Print successful: ${result}`);
  } catch (error) {
    console.error('Print failed:', error);
    alert(`Print failed: ${error}`);
  }
}
