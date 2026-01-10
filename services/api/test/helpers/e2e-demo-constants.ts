/**
 * E2E Demo Constants
 *
 * Single source of truth for demo org slugs and IDs used in E2E tests.
 * Re-exports stable constants from the prisma demo seeding module.
 *
 * @see services/api/prisma/demo/constants.ts (canonical source)
 */

// Re-export from canonical source
export {
  // Organization IDs
  ORG_TAPAS_ID,
  ORG_CAFESSERIE_ID,
  // Branch IDs
  BRANCH_TAPAS_MAIN_ID,
  BRANCH_CAFE_VILLAGE_MALL_ID,
  BRANCH_CAFE_ACACIA_MALL_ID,
  BRANCH_CAFE_ARENA_MALL_ID,
  BRANCH_CAFE_MOMBASA_ID,
  // Location IDs
  LOC_TAPAS_MAIN_ID,
  LOC_TAPAS_KITCHEN_ID,
  LOC_TAPAS_BAR_ID,
  LOC_CAFE_VM_MAIN_ID,
  LOC_CAFE_AM_MAIN_ID,
  LOC_CAFE_ARM_MAIN_ID,
  LOC_CAFE_MOM_MAIN_ID,
  // Org definitions
  TAPAS_ORG,
  CAFESSERIE_ORG,
  // Demo password
  DEMO_PASSWORD,
} from '../../prisma/demo/constants';

// ===== Convenience exports =====

/** Tapas demo org slug (canonical: 'tapas-demo') */
export const TAPAS_ORG_SLUG = 'tapas-demo';

/** Cafesserie demo org slug (canonical: 'cafesserie-demo') */
export const CAFESSERIE_ORG_SLUG = 'cafesserie-demo';
