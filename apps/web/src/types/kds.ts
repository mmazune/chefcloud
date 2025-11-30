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
