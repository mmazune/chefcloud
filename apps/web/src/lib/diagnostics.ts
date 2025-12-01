// apps/web/src/lib/diagnostics.ts

export function formatBytes(value: number | null | undefined): string {
  if (!value || value <= 0) return '0 KB';
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

export function formatAgeMs(ageMs: number | null | undefined): string {
  if (!ageMs || ageMs <= 0) return '0 min';
  const totalMinutes = Math.floor(ageMs / 60000);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
