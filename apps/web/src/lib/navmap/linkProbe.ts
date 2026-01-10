/**
 * Phase I3.1: Link Probe Module
 * 
 * Programmatically navigates to sidebar links and records outcomes.
 * Enabled with NEXT_PUBLIC_NAVMAP_MODE=1 and NEXT_PUBLIC_NAVMAP_PROBE=1
 * 
 * Outcomes:
 * - ok: Navigation succeeded, landed on expected route
 * - redirected: Navigation was redirected (e.g., auth redirect)
 * - forbidden: Access denied (403 or redirect to login/unauthorized)
 * - error: Navigation failed with error
 */

import type { NavmapProbeResult, NavmapSidebarLink, ProbeOutcome as _ProbeOutcome } from './types';

// Probe state
let probeEnabled = false;
let probeResults: NavmapProbeResult[] = [];
let isProbing = false;

/**
 * Initialize probe mode
 */
export function initLinkProbe(): void {
  if (typeof window === 'undefined') return;
  
  probeEnabled = 
    process.env.NEXT_PUBLIC_NAVMAP_MODE === '1' && 
    process.env.NEXT_PUBLIC_NAVMAP_PROBE === '1';
  
  if (probeEnabled) {
    console.log('[Navmap Probe] Probe mode enabled');
  }
}

/**
 * Check if probe mode is enabled
 */
export function isProbeEnabled(): boolean {
  return probeEnabled;
}

/**
 * Check if currently probing
 */
export function isCurrentlyProbing(): boolean {
  return isProbing;
}

/**
 * Probe a single link and determine outcome
 */
export async function probeLink(
  link: NavmapSidebarLink,
  router: { push: (url: string) => Promise<boolean>; asPath: string; pathname: string }
): Promise<NavmapProbeResult> {
  const result: NavmapProbeResult = {
    href: link.href,
    label: link.label,
    navGroup: link.navGroup,
    outcome: 'pending',
    apiCalls: [],
  };
  
  try {
    const startPath = router.asPath;
    
    // Navigate to the link
    await router.push(link.href);
    
    // Wait for navigation to settle
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const endPath = router.asPath;
    
    // Determine outcome
    if (endPath === link.href || endPath.startsWith(link.href)) {
      // Landed on expected route
      result.outcome = 'ok';
    } else if (endPath.includes('/login') || endPath.includes('/unauthorized')) {
      // Redirected to auth pages
      result.outcome = 'forbidden';
      result.redirectedTo = endPath;
    } else if (endPath !== startPath && endPath !== link.href) {
      // Redirected elsewhere
      result.outcome = 'redirected';
      result.redirectedTo = endPath;
    } else {
      result.outcome = 'ok';
    }
  } catch (err) {
    result.outcome = 'error';
    result.error = err instanceof Error ? err.message : String(err);
  }
  
  return result;
}

/**
 * Probe all sidebar links
 */
export async function probeAllLinks(
  links: NavmapSidebarLink[],
  router: { push: (url: string) => Promise<boolean>; asPath: string; pathname: string },
  onProgress?: (current: number, total: number, result: NavmapProbeResult) => void
): Promise<NavmapProbeResult[]> {
  isProbing = true;
  probeResults = [];
  
  const uniqueLinks = links.filter((link, idx, arr) => 
    arr.findIndex(l => l.href === link.href) === idx
  );
  
  for (let i = 0; i < uniqueLinks.length; i++) {
    const link = uniqueLinks[i];
    console.log(`[Navmap Probe] Probing ${i + 1}/${uniqueLinks.length}: ${link.href}`);
    
    const result = await probeLink(link, router);
    probeResults.push(result);
    
    if (onProgress) {
      onProgress(i + 1, uniqueLinks.length, result);
    }
    
    // Small delay between probes
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  isProbing = false;
  return probeResults;
}

/**
 * Get current probe results
 */
export function getProbeResults(): NavmapProbeResult[] {
  return [...probeResults];
}

/**
 * Clear probe results
 */
export function clearProbeResults(): void {
  probeResults = [];
}

/**
 * Generate probe summary
 */
export function getProbeSummary(): { total: number; ok: number; forbidden: number; redirected: number; error: number } {
  const summary = { total: probeResults.length, ok: 0, forbidden: 0, redirected: 0, error: 0 };
  
  for (const result of probeResults) {
    switch (result.outcome) {
      case 'ok': summary.ok++; break;
      case 'forbidden': summary.forbidden++; break;
      case 'redirected': summary.redirected++; break;
      case 'error': summary.error++; break;
    }
  }
  
  return summary;
}

/**
 * Export probe results as JSON
 */
export function exportProbeJSON(role: string): string {
  return JSON.stringify({
    role,
    probedAt: new Date().toISOString(),
    summary: getProbeSummary(),
    results: probeResults,
  }, null, 2);
}

/**
 * Export probe results as Markdown
 */
export function exportProbeMarkdown(role: string): string {
  const summary = getProbeSummary();
  const lines: string[] = [
    `# Link Probe Results: ${role}`,
    '',
    `> Probed: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `| Metric | Count |`,
    `|--------|-------|`,
    `| Total Links | ${summary.total} |`,
    `| ✅ OK | ${summary.ok} |`,
    `| 🚫 Forbidden | ${summary.forbidden} |`,
    `| ↪️ Redirected | ${summary.redirected} |`,
    `| ❌ Error | ${summary.error} |`,
    '',
    '## Results',
    '',
    '| Nav Group | Label | Href | Outcome | Notes |',
    '|-----------|-------|------|---------|-------|',
  ];
  
  for (const r of probeResults) {
    const outcomeEmoji = {
      ok: '✅',
      forbidden: '🚫',
      redirected: '↪️',
      error: '❌',
      pending: '⏳',
    }[r.outcome];
    
    const notes = r.redirectedTo 
      ? `→ ${r.redirectedTo}` 
      : r.error 
        ? r.error 
        : '';
    
    lines.push(`| ${r.navGroup} | ${r.label} | \`${r.href}\` | ${outcomeEmoji} ${r.outcome} | ${notes} |`);
  }
  
  return lines.join('\n');
}
