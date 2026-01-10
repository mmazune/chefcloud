/**
 * Phase I3: Navigation Map Module
 * 
 * Runtime navigation and action capture system.
 * Enable with NEXT_PUBLIC_NAVMAP_MODE=1
 */

export * from './types';
export * from './collector';
export { useNavmapCapture, triggerNavmapScan } from './useNavmapCapture';
