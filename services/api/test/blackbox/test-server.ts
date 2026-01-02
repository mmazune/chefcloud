import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import { withTimeout } from '../helpers/with-timeout';

export async function waitFor(path: string, timeoutMs = 15000): Promise<void> {
  let lastError: Error | null = null;
  let attempts = 0;

  const pollOperation = async () => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      attempts++;
      try {
        await new Promise<void>((resolve, reject) => {
          const req = http.get(path, (res) => {
            if (res.statusCode && res.statusCode < 500) resolve();
            else reject(new Error(`HTTP ${res.statusCode}`));
          });
          req.on('error', reject);
        });
        return;
      } catch (error) {
        lastError = error as Error;
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    throw new Error(`Timeout waiting for ${path} after ${attempts} attempts`);
  };

  return withTimeout(pollOperation(), {
    label: `waitFor(${path})`,
    ms: timeoutMs,
    onTimeoutInfo: () => ({
      path,
      attempts,
      lastError: lastError?.message,
    }),
  });
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
