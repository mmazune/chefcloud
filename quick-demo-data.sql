-- Quick demo data for ChefCloud
-- This adds basic data so pages display content

-- Add some menu categories
INSERT INTO categories (id, "branchId", name, "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'branch_default_001', 'Appetizers', 1, true, NOW(), NOW()),
  (gen_random_uuid(), 'branch_default_001', 'Main Course', 2, true, NOW(), NOW()),
  (gen_random_uuid(), 'branch_default_001', 'Beverages', 3, true, NOW(), NOW()),
  (gen_random_uuid(), 'branch_default_001', 'Desserts', 4, true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Get category IDs for menu items
DO $$
DECLARE
  cat_appetizers_id TEXT;
  cat_mains_id TEXT;
  cat_beverages_id TEXT;
  cat_desserts_id TEXT;
BEGIN
  SELECT id INTO cat_appetizers_id FROM categories WHERE name = 'Appetizers' AND "branchId" = 'branch_default_001' LIMIT 1;
  SELECT id INTO cat_mains_id FROM categories WHERE name = 'Main Course' AND "branchId" = 'branch_default_001' LIMIT 1;
  SELECT id INTO cat_beverages_id FROM categories WHERE name = 'Beverages' AND "branchId" = 'branch_default_001' LIMIT 1;
  SELECT id INTO cat_desserts_id FROM categories WHERE name = 'Desserts' AND "branchId" = 'branch_default_001' LIMIT 1;

  -- Add menu items (without orgId, using itemType and station enums)
  INSERT INTO menu_items (
    id, "branchId", "categoryId", name, description, 
    "itemType", station, price, "isAvailable", "createdAt", "updatedAt"
  )
  VALUES
    -- Appetizers
    (gen_random_uuid(), 'branch_default_001', cat_appetizers_id, 'Spring Rolls', 'Crispy vegetable spring rolls', 'FOOD', 'OTHER', 8000, true, NOW(), NOW()),
    (gen_random_uuid(), 'branch_default_001', cat_appetizers_id, 'Chicken Wings', 'Spicy buffalo wings', 'FOOD', 'FRYER', 12000, true, NOW(), NOW()),
    (gen_random_uuid(), 'branch_default_001', cat_appetizers_id, 'Samosas', 'Beef samosas (3 pcs)', 'FOOD', 'FRYER', 6000, true, NOW(), NOW()),
    
    -- Main Course
    (gen_random_uuid(), 'branch_default_001', cat_mains_id, 'Grilled Chicken', 'Marinated grilled chicken with rice', 'FOOD', 'GRILL', 25000, true, NOW(), NOW()),
    (gen_random_uuid(), 'branch_default_001', cat_mains_id, 'Fish & Chips', 'Fried tilapia with french fries', 'FOOD', 'FRYER', 30000, true, NOW(), NOW()),
    (gen_random_uuid(), 'branch_default_001', cat_mains_id, 'Burger & Fries', 'Beef burger with cheese and fries', 'FOOD', 'GRILL', 20000, true, NOW(), NOW()),
    (gen_random_uuid(), 'branch_default_001', cat_mains_id, 'Pasta Carbonara', 'Creamy pasta with bacon', 'FOOD', 'OTHER', 22000, true, NOW(), NOW()),
    
    -- Beverages
    (gen_random_uuid(), 'branch_default_001', cat_beverages_id, 'Coca Cola', 'Soft drink 500ml', 'DRINK', 'BAR', 3000, true, NOW(), NOW()),
    (gen_random_uuid(), 'branch_default_001', cat_beverages_id, 'Fresh Juice', 'Orange or passion fruit', 'DRINK', 'BAR', 5000, true, NOW(), NOW()),
    (gen_random_uuid(), 'branch_default_001', cat_beverages_id, 'Coffee', 'Espresso or cappuccino', 'DRINK', 'BAR', 4000, true, NOW(), NOW()),
    
    -- Desserts
    (gen_random_uuid(), 'branch_default_001', cat_desserts_id, 'Ice Cream', 'Vanilla or chocolate', 'FOOD', 'OTHER', 7000, true, NOW(), NOW()),
    (gen_random_uuid(), 'branch_default_001', cat_desserts_id, 'Chocolate Cake', 'Rich chocolate cake slice', 'FOOD', 'OTHER', 10000, true, NOW(), NOW())
  ON CONFLICT DO NOTHING;
END $$;

-- Summary
SELECT 
  'Categories' as table_name, COUNT(*) as count FROM categories WHERE "branchId" = 'branch_default_001'
UNION ALL
SELECT 'Menu Items', COUNT(*) FROM menu_items WHERE "branchId" = 'branch_default_001';

