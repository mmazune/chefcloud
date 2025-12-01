// apps/web/src/types/deviceRole.ts
// M29-PWA-S2: Device role binding for per-device configuration

export type DeviceRole = 'POS' | 'KDS' | 'BACKOFFICE';

export const DEVICE_ROLE_STORAGE_KEY = 'chefcloud_device_role_v1';
export const DEVICE_ROLE_DEFAULT: DeviceRole = 'POS';

export const DEVICE_ROLE_LABELS: Record<DeviceRole, string> = {
  POS: 'Point of Sale',
  KDS: 'Kitchen Display',
  BACKOFFICE: 'Backoffice',
};

export const DEVICE_ROLE_ROUTE: Record<DeviceRole, string> = {
  POS: '/pos',
  KDS: '/kds',
  BACKOFFICE: '/dashboard', // ChefCloud backoffice home
};
