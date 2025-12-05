import { spawn, ChildProcess } from 'child_process';
import http from 'http';

export async function waitFor(path: string, timeoutMs = 15000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(path, (res) => {
          if (res.statusCode && res.statusCode < 500) resolve();
          else reject(new Error(`HTTP ${res.statusCode}`));
        });
        req.on('error', reject);
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error(`Timeout waiting for ${path}`);
}

export function startServer(bin: string, env: Record<string, string>): ChildProcess {
  const child = spawn('node', [bin], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  return child;
}

export function stopServer(child?: ChildProcess) {
  if (!child) return;
  child.kill('SIGTERM');
}
