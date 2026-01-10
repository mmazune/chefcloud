/**
 * Phase I3: useNavmapCapture Hook
 * 
 * React hook that scans the DOM for actionable elements with data-testid
 * after render, and records them to the navmap collector.
 * 
 * Only active when NEXT_PUBLIC_NAVMAP_MODE=1
 */

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { isNavmapEnabled, recordAction, recordRoute } from './collector';

/**
 * Selectors for actionable elements we want to capture
 */
const ACTION_SELECTORS = [
  'button[data-testid]',
  'a[data-testid]',
  '[role="button"][data-testid]',
  '[role="menuitem"][data-testid]',
  '[role="link"][data-testid]',
].join(', ');

/**
 * Extract visible label text from an element (best-effort)
 */
function getElementLabel(el: Element): string {
  // Check aria-label first
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;
  
  // Check innerText
  const innerText = (el as HTMLElement).innerText?.trim();
  if (innerText && innerText.length < 100) return innerText;
  
  // Check title
  const title = el.getAttribute('title');
  if (title) return title;
  
  // Check aria-labelledby
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl) return labelEl.innerText?.trim() || '';
  }
  
  // Fallback: use testId as label indicator
  return el.getAttribute('data-testid') || '';
}

/**
 * Scan the current page for actionable elements and record them
 */
function scanAndRecordActions(route: string): void {
  if (!isNavmapEnabled()) return;
  
  const elements = document.querySelectorAll(ACTION_SELECTORS);
  
  elements.forEach(el => {
    const testId = el.getAttribute('data-testid');
    if (!testId) return;
    
    const elementType = el.tagName.toLowerCase();
    const label = getElementLabel(el);
    
    recordAction({
      elementType,
      testId,
      label,
    }, route);
  });
}

/**
 * Hook to capture navigation map data on route changes
 * 
 * Usage:
 * ```tsx
 * function MyApp({ Component, pageProps }) {
 *   useNavmapCapture();
 *   return <Component {...pageProps} />;
 * }
 * ```
 */
export function useNavmapCapture(): void {
  const router = useRouter();
  
  useEffect(() => {
    if (!isNavmapEnabled()) return;
    
    // Record current route
    const route = router.pathname;
    recordRoute(route);
    
    // Scan for actions after a short delay to allow render to complete
    const timeoutId = setTimeout(() => {
      scanAndRecordActions(route);
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [router.pathname]);
  
  // Also scan on significant DOM changes
  useEffect(() => {
    if (!isNavmapEnabled()) return;
    if (typeof MutationObserver === 'undefined') return;
    
    const observer = new MutationObserver(() => {
      // Debounce: only scan after mutations settle
      const route = router.pathname;
      setTimeout(() => scanAndRecordActions(route), 200);
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    
    return () => observer.disconnect();
  }, [router.pathname]);
}

/**
 * Manually trigger a scan (useful after async content loads)
 */
export function triggerNavmapScan(route: string): void {
  if (!isNavmapEnabled()) return;
  scanAndRecordActions(route);
}
