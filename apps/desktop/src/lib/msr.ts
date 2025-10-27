/**
 * MSR Keyboard Wedge Listener
 * Detects rapid keystrokes (within 300ms gaps) and collects until Enter/LineFeed.
 */

let buffer = '';
let timeout: NodeJS.Timeout | null = null;
let callback: ((raw: string) => void) | null = null;
let isListening = false;

const MSR_GAP_MS = 300; // Max gap between keystrokes for MSR swipe

function handleKeyPress(event: KeyboardEvent) {
  if (!isListening || !callback) return;

  // Enter or LineFeed signals end of swipe
  if (event.key === 'Enter' || event.keyCode === 10) {
    if (buffer.length > 0) {
      const captured = buffer;
      buffer = '';
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      callback(captured);
    }
    return;
  }

  // Collect printable characters
  if (event.key.length === 1) {
    buffer += event.key;

    // Reset timeout on each keystroke
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      // Gap exceeded - reset buffer (not an MSR swipe)
      buffer = '';
      timeout = null;
    }, MSR_GAP_MS);
  }
}

export function startMsrListener(cb: (raw: string) => void): void {
  if (isListening) {
    stopMsrListener();
  }

  callback = cb;
  isListening = true;
  buffer = '';

  window.addEventListener('keydown', handleKeyPress, true);
}

export function stopMsrListener(): void {
  isListening = false;
  callback = null;
  buffer = '';

  if (timeout) {
    clearTimeout(timeout);
    timeout = null;
  }

  window.removeEventListener('keydown', handleKeyPress, true);
}

export function isListeningMsr(): boolean {
  return isListening;
}
