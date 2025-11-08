export interface BankTxnRow { date: Date; amount: number; description?: string; ref?: string; }

export function parseBankCSV(csvText: string): BankTxnRow[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV must have header and data');

  const header = lines[0].toLowerCase().split(',').map(h => h.trim());
  const dateIdx = header.findIndex(h => h.includes('date') || h.includes('posted'));
  const amountIdx = header.findIndex(h => h.includes('amount') || h.includes('debit') || h.includes('credit'));
  const descIdx = header.findIndex(h => h.includes('description') || h.includes('memo'));
  const refIdx = header.findIndex(h => h.includes('ref') || h.includes('transaction'));

  if (dateIdx === -1 || amountIdx === -1) throw new Error('CSV must have date and amount columns');

  const rows: BankTxnRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].trim().split(',').map(c => c.trim());
    if (!cols[dateIdx]) continue;

    const date = parseDate(cols[dateIdx]);
    if (!date) throw new Error(`Invalid date at row ${i + 1}`);

    const amount = parseAmount(cols[amountIdx]);
    if (isNaN(amount)) throw new Error(`Invalid amount at row ${i + 1}`);

    rows.push({ date, amount, description: descIdx !== -1 ? cols[descIdx] : undefined, ref: refIdx !== -1 ? cols[refIdx] : undefined });
  }
  return rows;
}

function parseDate(s: string): Date | null {
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}

function parseAmount(s: string): number {
  let cleaned = s.replace(/UGX|USh|,|\s/gi, '');
  const isNeg = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNeg) cleaned = cleaned.slice(1, -1);
  const amt = parseFloat(cleaned);
  return isNeg ? -amt : amt;
}
