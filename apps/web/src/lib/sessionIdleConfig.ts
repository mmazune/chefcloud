/**
 * M32-SEC-S1: Session idle timeout configuration
 * Centralizes idle timeout settings from environment variables
 */

const MIN_IDLE_MINUTES = 5;
const MAX_IDLE_MINUTES = 480; // 8h cap for safety

export interface SessionIdleConfig {
  enabled: boolean;
  idleMs: number;
  warningMs: number;
}

function clampMinutes(value: number, min: number, max: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

export function getSessionIdleConfig(): SessionIdleConfig {
  const enabledEnv = process.env.NEXT_PUBLIC_ENABLE_IDLE_TIMEOUT;
  const enabled =
    enabledEnv === '0'
      ? false
      : true; // default enabled

  const idleMinutesEnv = process.env.NEXT_PUBLIC_SESSION_IDLE_MINUTES;
  const warningMinutesEnv =
    process.env.NEXT_PUBLIC_SESSION_IDLE_WARNING_MINUTES;

  const idleMinutesRaw = idleMinutesEnv
    ? parseInt(idleMinutesEnv, 10)
    : 30;
  const warningMinutesRaw = warningMinutesEnv
    ? parseInt(warningMinutesEnv, 10)
    : 5;

  const idleMinutes = clampMinutes(
    idleMinutesRaw,
    MIN_IDLE_MINUTES,
    MAX_IDLE_MINUTES,
  );

  // Warning must be > 0 and < idle
  let warningMinutes = clampMinutes(
    warningMinutesRaw,
    1,
    idleMinutes - 1,
  );
  if (warningMinutes >= idleMinutes) {
    warningMinutes = Math.max(1, idleMinutes - 1);
  }

  return {
    enabled,
    idleMs: idleMinutes * 60 * 1000,
    warningMs: warningMinutes * 60 * 1000,
  };
}
