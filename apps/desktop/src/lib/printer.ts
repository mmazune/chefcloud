import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface PrinterConfig {
  host: string;
  port: number;
  simulate: boolean;
}

const DEFAULT_CONFIG: PrinterConfig = {
  host: '127.0.0.1',
  port: 9100,
  simulate: true,
};

export function loadPrinterConfig(): PrinterConfig {
  // Priority 1: Environment variables
  if (process.env.PRINTER_SIMULATE !== undefined) {
    return {
      host: process.env.PRINTER_HOST || DEFAULT_CONFIG.host,
      port: parseInt(process.env.PRINTER_PORT || String(DEFAULT_CONFIG.port), 10),
      simulate: process.env.PRINTER_SIMULATE === 'true',
    };
  }

  // Priority 2: Config file ~/.chefcloud/printer.json
  const configPath = join(homedir(), '.chefcloud', 'printer.json');
  if (existsSync(configPath)) {
    try {
      const fileContent = readFileSync(configPath, 'utf-8');
      const fileConfig = JSON.parse(fileContent);
      return {
        host: fileConfig.host || DEFAULT_CONFIG.host,
        port: fileConfig.port || DEFAULT_CONFIG.port,
        simulate: fileConfig.simulate !== undefined ? fileConfig.simulate : DEFAULT_CONFIG.simulate,
      };
    } catch (error) {
      console.warn('Failed to load printer config from file, using defaults:', error);
    }
  }

  // Priority 3: Defaults
  return DEFAULT_CONFIG;
}
