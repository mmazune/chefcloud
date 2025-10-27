/**
 * MSR Badge Parser
 * Validates CLOUDBADGE format and rejects PAN-like data.
 */

export type ParsedBadge =
  | { type: 'badge'; code: string }
  | { type: 'rejected'; reason: string };

/**
 * Detect PAN-like track data (payment card).
 */
function isPanLike(data: string): boolean {
  const track1Pattern = /^%B\d{12,19}\^/;
  const track2Pattern = /^;?\d{12,19}=/;
  
  return track1Pattern.test(data) || track2Pattern.test(data);
}

/**
 * Parse and validate MSR swipe data.
 */
export function parseMsrSwipe(raw: string): ParsedBadge {
  const trimmed = raw.trim();

  // Reject payment card data
  if (isPanLike(trimmed)) {
    return { type: 'rejected', reason: 'Payment card data not allowed' };
  }

  // Parse CLOUDBADGE format
  const match = trimmed.match(/^CLOUDBADGE:([A-Za-z0-9_-]+)$/);
  if (match) {
    return { type: 'badge', code: match[1] };
  }

  // Unknown format
  return { type: 'rejected', reason: 'Invalid badge format. Expected: CLOUDBADGE:<CODE>' };
}
