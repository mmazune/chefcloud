// apps/web/src/lib/kdsAudio.ts
// M28-KDS-S5: Audio alerts for new and late tickets
// Simple audio helper with graceful fallback for autoplay restrictions

let newTicketAudio: HTMLAudioElement | null = null;
let lateTicketAudio: HTMLAudioElement | null = null;

function ensureNewTicketAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!newTicketAudio) {
    // Place your audio file under public/sounds/kds-new.mp3
    newTicketAudio = new Audio('/sounds/kds-new.mp3');
  }
  return newTicketAudio;
}

function ensureLateTicketAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!lateTicketAudio) {
    // Place your audio file under public/sounds/kds-late.mp3
    lateTicketAudio = new Audio('/sounds/kds-late.mp3');
  }
  return lateTicketAudio;
}

export async function playNewTicketSound(): Promise<void> {
  const audio = ensureNewTicketAudio();
  if (!audio) return;
  try {
    // Reset to start for rapid consecutive plays
    audio.currentTime = 0;
    await audio.play();
  } catch {
    // Ignore autoplay / user gesture errors
  }
}

export async function playLateTicketSound(): Promise<void> {
  const audio = ensureLateTicketAudio();
  if (!audio) return;
  try {
    audio.currentTime = 0;
    await audio.play();
  } catch {
    // Ignore autoplay / user gesture errors
  }
}
