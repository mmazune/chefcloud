// apps/web/src/types/kds.ts
// M28-KDS-S4: KDS Settings & Local Preferences
// Defines frontend-only preferences for per-device KDS configuration

export interface KdsPrioritySettings {
  dueSoonMinutes: number;   // e.g. 8
  lateMinutes: number;      // e.g. 15
}

export interface KdsDisplaySettings {
  hideServed: boolean;          // default true
  dimReadyAfterMinutes: number; // e.g. 10
}

export interface KdsSoundSettings {
  enableNewTicketSound: boolean;
  enableLateTicketSound: boolean;
}

export interface KdsPreferences {
  priority: KdsPrioritySettings;
  display: KdsDisplaySettings;
  sounds: KdsSoundSettings;
}

export const KDS_PREFERENCES_STORAGE_KEY = 'chefcloud_kds_preferences_v1';

export const defaultKdsPreferences: KdsPreferences = {
  priority: {
    dueSoonMinutes: 8,
    lateMinutes: 15,
  },
  display: {
    hideServed: true,
    dimReadyAfterMinutes: 10,
  },
  sounds: {
    enableNewTicketSound: false,
    enableLateTicketSound: false,
  },
};

/**
 * M28-KDS-S7: Sanitize and validate KDS preferences
 * 
 * Ensures preferences are always in a safe, valid state:
 * - Clamps numeric values to reasonable ranges
 * - Ensures lateMinutes > dueSoonMinutes
 * - Falls back to defaults for missing/invalid values
 * - Self-healing for corrupted localStorage
 */
export function sanitizeKdsPreferences(
  input: Partial<KdsPreferences> | null | undefined
): KdsPreferences {
  const src = input ?? {};

  const clamp = (value: number, min: number, max: number): number => {
    if (!Number.isFinite(value)) {
      // Handle NaN, Infinity, -Infinity
      return value === Infinity ? max : min;
    }
    if (value < min) return min;
    if (value > max) return max;
    return value;
  };

  // Priority
  let dueSoon = src.priority?.dueSoonMinutes ?? defaultKdsPreferences.priority.dueSoonMinutes;
  let late = src.priority?.lateMinutes ?? defaultKdsPreferences.priority.lateMinutes;

  // Clamp to reasonable ranges
  // e.g. 1–60 min for due soon, 2–240 min for late
  dueSoon = clamp(dueSoon, 1, 60);
  late = clamp(late, 2, 240);

  // Ensure late > dueSoon
  if (late <= dueSoon) {
    late = clamp(dueSoon + 1, dueSoon + 1, 240);
  }

  // Display
  let dimReadyAfter = src.display?.dimReadyAfterMinutes ?? defaultKdsPreferences.display.dimReadyAfterMinutes;
  // Allow 0 (no dimming) up to 240 min
  dimReadyAfter = clamp(dimReadyAfter, 0, 240);

  const hideServed =
    src.display?.hideServed ?? defaultKdsPreferences.display.hideServed;

  // Sounds
  const enableNewTicketSound =
    src.sounds?.enableNewTicketSound ?? defaultKdsPreferences.sounds.enableNewTicketSound;
  const enableLateTicketSound =
    src.sounds?.enableLateTicketSound ?? defaultKdsPreferences.sounds.enableLateTicketSound;

  return {
    priority: {
      dueSoonMinutes: dueSoon,
      lateMinutes: late,
    },
    display: {
      hideServed,
      dimReadyAfterMinutes: dimReadyAfter,
    },
    sounds: {
      enableNewTicketSound,
      enableLateTicketSound,
    },
  };
}
