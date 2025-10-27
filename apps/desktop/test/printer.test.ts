import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadPrinterConfig } from '../src/lib/printer';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

describe('loadPrinterConfig', () => {
  const configDir = join(homedir(), '.chefcloud');
  const configPath = join(configDir, 'printer.json');
  
  beforeEach(() => {
    // Clear environment variables
    delete process.env.PRINTER_HOST;
    delete process.env.PRINTER_PORT;
    delete process.env.PRINTER_SIMULATE;
    
    // Remove config file if exists
    if (existsSync(configPath)) {
      rmSync(configPath);
    }
  });

  afterEach(() => {
    // Cleanup
    delete process.env.PRINTER_HOST;
    delete process.env.PRINTER_PORT;
    delete process.env.PRINTER_SIMULATE;
    
    if (existsSync(configPath)) {
      rmSync(configPath);
    }
  });

  it('should return defaults when no config exists', () => {
    const config = loadPrinterConfig();
    expect(config).toEqual({
      host: '127.0.0.1',
      port: 9100,
      simulate: true,
    });
  });

  it('should prioritize environment variables', () => {
    process.env.PRINTER_HOST = '192.168.1.100';
    process.env.PRINTER_PORT = '9200';
    process.env.PRINTER_SIMULATE = 'false';

    const config = loadPrinterConfig();
    expect(config).toEqual({
      host: '192.168.1.100',
      port: 9200,
      simulate: false,
    });
  });

  it('should load from config file when env vars not set', () => {
    // Create config directory if it doesn't exist
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    // Write config file
    writeFileSync(
      configPath,
      JSON.stringify({
        host: '10.0.0.50',
        port: 9999,
        simulate: false,
      })
    );

    const config = loadPrinterConfig();
    expect(config).toEqual({
      host: '10.0.0.50',
      port: 9999,
      simulate: false,
    });
  });

  it('should use defaults for missing fields in config file', () => {
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    writeFileSync(
      configPath,
      JSON.stringify({
        host: '192.168.1.1',
        // port and simulate missing
      })
    );

    const config = loadPrinterConfig();
    expect(config.host).toBe('192.168.1.1');
    expect(config.port).toBe(9100);
    expect(config.simulate).toBe(true);
  });

  it('should handle invalid JSON in config file gracefully', () => {
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    writeFileSync(configPath, 'invalid json{');

    const config = loadPrinterConfig();
    expect(config).toEqual({
      host: '127.0.0.1',
      port: 9100,
      simulate: true,
    });
  });

  it('should handle simulate=true from env', () => {
    process.env.PRINTER_SIMULATE = 'true';

    const config = loadPrinterConfig();
    expect(config.simulate).toBe(true);
  });

  it('should handle partial env vars with defaults', () => {
    process.env.PRINTER_SIMULATE = 'false';
    process.env.PRINTER_HOST = '172.16.0.1';
    // PRINTER_PORT not set

    const config = loadPrinterConfig();
    expect(config.host).toBe('172.16.0.1');
    expect(config.port).toBe(9100);
    expect(config.simulate).toBe(false);
  });
});
