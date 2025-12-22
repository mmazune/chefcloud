# Inventory Movements Seeded Data Reference

## Quick Stats

### Tapas Bar & Restaurant (90 days)
- **Goods Receipts**: 13 weekly purchases
- **Stock Batches**: 372 individual batches
- **Stock Movements**: 433 total (372 purchases + 61 wastage)
- **Wastage Events**: 61 (3 monthly cycles)

### Cafesserie (180 days, 4 branches)
- **Goods Receipts**: 104 (26 per branch)
- **Stock Batches**: 2,371 
- **Stock Movements**: 2,371 (purchases only)
- **Branches**: Village Mall, Acacia Mall, Arena Mall, Mombasa

## Suppliers

### Tapas Suppliers
1. **Wines Direct** - Wines, spirits, champagne
2. **Lakeside Produce** - Vegetables, fruits, herbs
3. **Meat Market** - Meats, seafood
4. **Dairy Co-op** - Dairy products
5. **Bar Distributors** - Beer, soft drinks, bar supplies

### Cafesserie Suppliers
1. **Coffee Roasters** - Coffee beans, tea
2. **Bakery Supply** - Baked goods, pastries
3. **Fresh Farms** - Produce, dairy
4. **Beverage Hub** - Soft drinks, juices
5. **Cafesserie HQ** - Central supply chain

## Purchase Patterns

### Fast Movers (Weekly Purchases)
- Beer, soft drinks
- Coffee, milk
- Vegetables, bread
- High-volume items

### Slow Movers (Monthly Purchases)
- Premium spirits
- Specialty ingredients
- Low-volume items

## Wastage Rates

### Perishables (2-6% monthly)
- Meats
- Dairy
- Produce
- Bakery items

### Non-Perishables (0.5-1.5% monthly)
- Bar spillage
- Breakage
- Damaged packaging

## Batch Numbering

Format: `SEED-{YYYYMMDD}-{SKU}-{SEQ}`

Example: `SEED-20241115-BEEF-FILLET-001`

## GRN Numbering

Format: `GRN-{BRANCH}-{DATE}-{SEQ}`

Example: `GRN-TAPAS-20241115-001`

## Cost Model

- **Base Costs**: Defined in `inventoryMovements.ts`
- **Inflation**: 0-3% linear increase over 180 days
- **FIFO**: First In First Out batch consumption

## Re-seed Command

```bash
cd /workspaces/chefcloud/services/api
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chefcloud?schema=public"
SEED_DEMO_DATA=true npx tsx prisma/seed.ts
```

## Deterministic Seed

**RNG Seed**: `"chefcloud-demo-v2-m4"`

Running the seed multiple times with the same RNG seed produces identical data.
