#!/usr/bin/env python3
"""
Generate Complete Cafesserie Data (Menu + Inventory + Recipes)

Based on deterministic cafe menu items with proper inventory and recipe mappings.
"""

import json

# Load existing cafesserie menu
with open('data/cafesserie-menu.json', 'r') as f:
    menu_data = json.load(f)

print(f"📋 Loaded Cafesserie menu: {len(menu_data['items'])} items")

# CREATE CAFESSERIE INVENTORY
# This is a deterministic list of inventory items needed to support the cafe menu

cafe_inventory = {
    "comment": "Cafesserie Inventory - Deterministic items for coffee shop operations",
    "items": [
        # COFFEE & ESPRESSO
        {"sku": "CAF-INV-COFF-0001", "name": "Espresso Coffee Beans (Arabica)", "category": "Coffee", "unit": "KG", "unitCost": 45000, "reorderLevel": 2, "reorderQty": 5, "initialStock": 10},
        {"sku": "CAF-INV-COFF-0002", "name": "Decaf Coffee Beans", "category": "Coffee", "unit": "KG", "unitCost": 48000, "reorderLevel": 1, "reorderQty": 2, "initialStock": 3},
        
        # DAIRY
        {"sku": "CAF-INV-DARY-0001", "name": "Whole Milk", "category": "Dairy", "unit": "LTR", "unitCost": 3500, "reorderLevel": 10, "reorderQty": 30, "initialStock": 40},
        {"sku": "CAF-INV-DARY-0002", "name": "Almond Milk", "category": "Dairy", "unit": "LTR", "unitCost": 8000, "reorderLevel": 5, "reorderQty": 10, "initialStock": 12},
        {"sku": "CAF-INV-DARY-0003", "name": "Oat Milk", "category": "Dairy", "unit": "LTR", "unitCost": 9000, "reorderLevel": 3, "reorderQty": 8, "initialStock": 8},
        {"sku": "CAF-INV-DARY-0004", "name": "Heavy Cream", "category": "Dairy", "unit": "LTR", "unitCost": 12000, "reorderLevel": 3, "reorderQty": 5, "initialStock": 6},
        {"sku": "CAF-INV-DARY-0005", "name": "Butter (Unsalted)", "category": "Dairy", "unit": "KG", "unitCost": 16000, "reorderLevel": 2, "reorderQty": 5, "initialStock": 5},
        {"sku": "CAF-INV-DARY-0006", "name": "Cream Cheese", "category": "Dairy", "unit": "KG", "unitCost": 18000, "reorderLevel": 2, "reorderQty": 3, "initialStock": 4},
        {"sku": "CAF-INV-DARY-0007", "name": "Cheddar Cheese", "category": "Dairy", "unit": "KG", "unitCost": 22000, "reorderLevel": 1, "reorderQty": 2, "initialStock": 2},
        {"sku": "CAF-INV-DARY-0008", "name": "Mozzarella Cheese", "category": "Dairy", "unit": "KG", "unitCost": 20000, "reorderLevel": 1, "reorderQty": 2, "initialStock": 2},
        {"sku": "CAF-INV-DARY-0009", "name": "Vanilla Ice Cream", "category": "Dairy", "unit": "LTR", "unitCost": 15000, "reorderLevel": 2, "reorderQty": 4, "initialStock": 5},
        {"sku": "CAF-INV-DARY-0010", "name": "Yoghurt (Plain)", "category": "Dairy", "unit": "KG", "unitCost": 6000, "reorderLevel": 3, "reorderQty": 5, "initialStock": 6},
        {"sku": "CAF-INV-DARY-0011", "name": "Eggs (Fresh)", "category": "Dairy", "unit": "TRAY", "unitCost": 13000, "reorderLevel": 3, "reorderQty": 5, "initialStock": 8},
        
        # SYRUPS & FLAVORINGS
        {"sku": "CAF-INV-SYRP-0001", "name": "Vanilla Syrup", "category": "Syrups", "unit": "BTL", "unitCost": 12000, "reorderLevel": 2, "reorderQty": 6, "initialStock": 6},
        {"sku": "CAF-INV-SYRP-0002", "name": "Caramel Syrup", "category": "Syrups", "unit": "BTL", "unitCost": 12000, "reorderLevel": 2, "reorderQty": 6, "initialStock": 6},
        {"sku": "CAF-INV-SYRP-0003", "name": "Hazelnut Syrup", "category": "Syrups", "unit": "BTL", "unitCost": 13000, "reorderLevel": 1, "reorderQty": 4, "initialStock": 4},
        {"sku": "CAF-INV-SYRP-0004", "name": "Chocolate Syrup", "category": "Syrups", "unit": "BTL", "unitCost": 11000, "reorderLevel": 2, "reorderQty": 5, "initialStock": 5},
        {"sku": "CAF-INV-SYRP-0005", "name": "Mint Syrup", "category": "Syrups", "unit": "BTL", "unitCost": 12000, "reorderLevel": 1, "reorderQty": 3, "initialStock": 3},
        {"sku": "CAF-INV-SYRP-0006", "name": "Honey (Pure)", "category": "Syrups", "unit": "KG", "unitCost": 25000, "reorderLevel": 1, "reorderQty": 2, "initialStock": 3},
        
        # TEA
        {"sku": "CAF-INV-TEA-0001", "name": "English Breakfast Tea Bags", "category": "Tea", "unit": "BOX", "unitCost": 8000, "reorderLevel": 2, "reorderQty": 5, "initialStock": 6},
        {"sku": "CAF-INV-TEA-0002", "name": "Earl Grey Tea Bags", "category": "Tea", "unit": "BOX", "unitCost": 9000, "reorderLevel": 2, "reorderQty": 5, "initialStock": 5},
        {"sku": "CAF-INV-TEA-0003", "name": "Green Tea Bags", "category": "Tea", "unit": "BOX", "unitCost": 9500, "reorderLevel": 2, "reorderQty": 5, "initialStock": 5},
        {"sku": "CAF-INV-TEA-0004", "name": "Chamomile Tea Bags", "category": "Tea", "unit": "BOX", "unitCost": 10000, "reorderLevel": 1, "reorderQty": 3, "initialStock": 4},
        {"sku": "CAF-INV-TEA-0005", "name": "Peppermint Tea Bags", "category": "Tea", "unit": "BOX", "unitCost": 9000, "reorderLevel": 1, "reorderQty": 3, "initialStock": 3},
        
        # BAKING INGREDIENTS
        {"sku": "CAF-INV-BAKF-0001", "name": "All-Purpose Flour", "category": "Baking", "unit": "KG", "unitCost": 3000, "reorderLevel": 10, "reorderQty": 25, "initialStock": 30},
        {"sku": "CAF-INV-BAKF-0002", "name": "Sugar (White)", "category": "Baking", "unit": "KG", "unitCost": 3500, "reorderLevel": 10, "reorderQty": 20, "initialStock": 25},
        {"sku": "CAF-INV-BAKF-0003", "name": "Brown Sugar", "category": "Baking", "unit": "KG", "unitCost": 4000, "reorderLevel": 5, "reorderQty": 10, "initialStock": 12},
        {"sku": "CAF-INV-BAKF-0004", "name": "Baking Powder", "category": "Baking", "unit": "KG", "unitCost": 5000, "reorderLevel": 2, "reorderQty": 5, "initialStock": 5},
        {"sku": "CAF-INV-BAKF-0005", "name": "Cocoa Powder", "category": "Baking", "unit": "KG", "unitCost": 15000, "reorderLevel": 1, "reorderQty": 3, "initialStock": 3},
        {"sku": "CAF-INV-BAKF-0006", "name": "Chocolate Chips", "category": "Baking", "unit": "KG", "unitCost": 18000, "reorderLevel": 2, "reorderQty": 5, "initialStock": 5},
        {"sku": "CAF-INV-BAKF-0007", "name": "Vanilla Extract", "category": "Baking", "unit": "BTL", "unitCost": 8000, "reorderLevel": 1, "reorderQty": 2, "initialStock": 3},
        {"sku": "CAF-INV-BAKF-0008", "name": "Cinnamon Powder", "category": "Baking", "unit": "KG", "unitCost": 12000, "reorderLevel": 1, "reorderQty": 2, "initialStock": 2},
        
        # BREAD & BAKERY SUPPLIES
        {"sku": "CAF-INV-BRED-0001", "name": "White Bread Loaf", "category": "Bread", "unit": "PC", "unitCost": 4000, "reorderLevel": 10, "reorderQty": 20, "initialStock": 25},
        {"sku": "CAF-INV-BRED-0002", "name": "Whole Wheat Bread", "category": "Bread", "unit": "PC", "unitCost": 4500, "reorderLevel": 8, "reorderQty": 15, "initialStock": 20},
        {"sku": "CAF-INV-BRED-0003", "name": "Croissants (Frozen)", "category": "Bread", "unit": "PC", "unitCost": 2000, "reorderLevel": 20, "reorderQty": 50, "initialStock": 60},
        {"sku": "CAF-INV-BRED-0004", "name": "Bagels", "category": "Bread", "unit": "PC", "unitCost": 1500, "reorderLevel": 15, "reorderQty": 30, "initialStock": 40},
        {"sku": "CAF-INV-BRED-0005", "name": "Muffin Mix", "category": "Bread", "unit": "KG", "unitCost": 8000, "reorderLevel": 3, "reorderQty": 5, "initialStock": 6},
        {"sku": "CAF-INV-BRED-0006", "name": "Scone Mix", "category": "Bread", "unit": "KG", "unitCost": 7500, "reorderLevel": 2, "reorderQty": 4, "initialStock": 5},
        
        # PRODUCE
        {"sku": "CAF-INV-PROD-0001", "name": "Tomatoes", "category": "Produce", "unit": "KG", "unitCost": 3000, "reorderLevel": 5, "reorderQty": 10, "initialStock": 12},
        {"sku": "CAF-INV-PROD-0002", "name": "Lettuce", "category": "Produce", "unit": "PC", "unitCost": 2500, "reorderLevel": 5, "reorderQty": 10, "initialStock": 15},
        {"sku": "CAF-INV-PROD-0003", "name": "Cucumber", "category": "Produce", "unit": "KG", "unitCost": 3000, "reorderLevel": 3, "reorderQty": 8, "initialStock": 10},
        {"sku": "CAF-INV-PROD-0004", "name": "Avocado", "category": "Produce", "unit": "PC", "unitCost": 1500, "reorderLevel": 10, "reorderQty": 20, "initialStock": 25},
        {"sku": "CAF-INV-PROD-0005", "name": "Spinach", "category": "Produce", "unit": "KG", "unitCost": 4000, "reorderLevel": 3, "reorderQty": 6, "initialStock": 8},
        {"sku": "CAF-INV-PROD-0006", "name": "Carrots", "category": "Produce", "unit": "KG", "unitCost": 2500, "reorderLevel": 3, "reorderQty": 8, "initialStock": 10},
        {"sku": "CAF-INV-PROD-0007", "name": "Onions", "category": "Produce", "unit": "KG", "unitCost": 2000, "reorderLevel": 5, "reorderQty": 10, "initialStock": 15},
        
        # FRUITS
        {"sku": "CAF-INV-FRUT-0001", "name": "Bananas", "category": "Fruits", "unit": "KG", "unitCost": 3000, "reorderLevel": 5, "reorderQty": 10, "initialStock": 15},
        {"sku": "CAF-INV-FRUT-0002", "name": "Strawberries", "category": "Fruits", "unit": "KG", "unitCost": 12000, "reorderLevel": 2, "reorderQty": 5, "initialStock": 6},
        {"sku": "CAF-INV-FRUT-0003", "name": "Blueberries", "category": "Fruits", "unit": "KG", "unitCost": 15000, "reorderLevel": 1, "reorderQty": 3, "initialStock": 4},
        {"sku": "CAF-INV-FRUT-0004", "name": "Oranges", "category": "Fruits", "unit": "KG", "unitCost": 4000, "reorderLevel": 5, "reorderQty": 10, "initialStock": 12},
        {"sku": "CAF-INV-FRUT-0005", "name": "Apples", "category": "Fruits", "unit": "KG", "unitCost": 5000, "reorderLevel": 3, "reorderQty": 8, "initialStock": 10},
        {"sku": "CAF-INV-FRUT-0006", "name": "Pineapple", "category": "Fruits", "unit": "PC", "unitCost": 3500, "reorderLevel": 3, "reorderQty": 8, "initialStock": 10},
        {"sku": "CAF-INV-FRUT-0007", "name": "Mango", "category": "Fruits", "unit": "KG", "unitCost": 6000, "reorderLevel": 2, "reorderQty": 5, "initialStock": 6},
        {"sku": "CAF-INV-FRUT-0008", "name": "Watermelon", "category": "Fruits", "unit": "PC", "unitCost": 5000, "reorderLevel": 2, "reorderQty": 5, "initialStock": 5},
        {"sku": "CAF-INV-FRUT-0009", "name": "Lemon", "category": "Fruits", "unit": "KG", "unitCost": 3500, "reorderLevel": 3, "reorderQty": 5, "initialStock": 8},
        
        # PROTEINS
        {"sku": "CAF-INV-PROT-0001", "name": "Chicken Breast", "category": "Proteins", "unit": "KG", "unitCost": 18000, "reorderLevel": 3, "reorderQty": 8, "initialStock": 10},
        {"sku": "CAF-INV-PROT-0002", "name": "Ham (Sliced)", "category": "Proteins", "unit": "KG", "unitCost": 25000, "reorderLevel": 2, "reorderQty": 5, "initialStock": 6},
        {"sku": "CAF-INV-PROT-0003", "name": "Bacon", "category": "Proteins", "unit": "KG", "unitCost": 28000, "reorderLevel": 2, "reorderQty": 5, "initialStock": 6},
        {"sku": "CAF-INV-PROT-0004", "name": "Tuna (Canned)", "category": "Proteins", "unit": "TIN", "unitCost": 8000, "reorderLevel": 5, "reorderQty": 12, "initialStock": 15},
        {"sku": "CAF-INV-PROT-0005", "name": "Smoked Salmon", "category": "Proteins", "unit": "KG", "unitCost": 45000, "reorderLevel": 1, "reorderQty": 2, "initialStock": 2},
        
        # CONDIMENTS & SAUCES
        {"sku": "CAF-INV-COND-0001", "name": "Mayonnaise", "category": "Condiments", "unit": "KG", "unitCost": 8000, "reorderLevel": 2, "reorderQty": 5, "initialStock": 6},
        {"sku": "CAF-INV-COND-0002", "name": "Mustard", "category": "Condiments", "unit": "KG", "unitCost": 7000, "reorderLevel": 2, "reorderQty": 4, "initialStock": 5},
        {"sku": "CAF-INV-COND-0003", "name": "Olive Oil", "category": "Condiments", "unit": "LTR", "unitCost": 18000, "reorderLevel": 2, "reorderQty": 4, "initialStock": 5},
        {"sku": "CAF-INV-COND-0004", "name": "Balsamic Vinegar", "category": "Condiments", "unit": "BTL", "unitCost": 12000, "reorderLevel": 1, "reorderQty": 3, "initialStock": 3},
        {"sku": "CAF-INV-COND-0005", "name": "Pesto Sauce", "category": "Condiments", "unit": "JAR", "unitCost": 15000, "reorderLevel": 1, "reorderQty": 3, "initialStock": 3},
        {"sku": "CAF-INV-COND-0006", "name": "Salt", "category": "Condiments", "unit": "KG", "unitCost": 1000, "reorderLevel": 3, "reorderQty": 5, "initialStock": 8},
        {"sku": "CAF-INV-COND-0007", "name": "Black Pepper", "category": "Condiments", "unit": "KG", "unitCost": 20000, "reorderLevel": 1, "reorderQty": 2, "initialStock": 2},
        
        # BEVERAGES
        {"sku": "CAF-INV-BEV-0001", "name": "Coca Cola (Bottles)", "category": "Beverages", "unit": "CRATE", "unitCost": 18000, "reorderLevel": 2, "reorderQty": 5, "initialStock": 8},
        {"sku": "CAF-INV-BEV-0002", "name": "Sprite (Bottles)", "category": "Beverages", "unit": "CRATE", "unitCost": 18000, "reorderLevel": 2, "reorderQty": 5, "initialStock": 6},
        {"sku": "CAF-INV-BEV-0003", "name": "Fanta (Bottles)", "category": "Beverages", "unit": "CRATE", "unitCost": 18000, "reorderLevel": 1, "reorderQty": 3, "initialStock": 4},
        {"sku": "CAF-INV-BEV-0004", "name": "Bottled Water", "category": "Beverages", "unit": "CRATE", "unitCost": 12000, "reorderLevel": 3, "reorderQty": 8, "initialStock": 10},
        {"sku": "CAF-INV-BEV-0005", "name": "Orange Juice (Carton)", "category": "Beverages", "unit": "LTR", "unitCost": 8000, "reorderLevel": 3, "reorderQty": 8, "initialStock": 10},
        {"sku": "CAF-INV-BEV-0006", "name": "Apple Juice (Carton)", "category": "Beverages", "unit": "LTR", "unitCost": 8000, "reorderLevel": 2, "reorderQty": 6, "initialStock": 8},
        
        # PACKAGING
        {"sku": "CAF-INV-PKG-0001", "name": "Takeaway Coffee Cups (8oz)", "category": "Packaging", "unit": "PACK", "unitCost": 15000, "reorderLevel": 5, "reorderQty": 10, "initialStock": 15},
        {"sku": "CAF-INV-PKG-0002", "name": "Takeaway Coffee Cups (12oz)", "category": "Packaging", "unit": "PACK", "unitCost": 18000, "reorderLevel": 5, "reorderQty": 10, "initialStock": 15},
        {"sku": "CAF-INV-PKG-0003", "name": "Cup Lids", "category": "Packaging", "unit": "PACK", "unitCost": 8000, "reorderLevel": 5, "reorderQty": 10, "initialStock": 12},
        {"sku": "CAF-INV-PKG-0004", "name": "Paper Bags", "category": "Packaging", "unit": "PACK", "unitCost": 12000, "reorderLevel": 3, "reorderQty": 8, "initialStock": 10},
        {"sku": "CAF-INV-PKG-0005", "name": "Napkins", "category": "Packaging", "unit": "PACK", "unitCost": 5000, "reorderLevel": 5, "reorderQty": 10, "initialStock": 12},
    ]
}

# Save cafesserie inventory
with open('data/cafesserie-inventory.json', 'w') as f:
    json.dump(cafe_inventory, f, indent=2)

print(f"✅ Cafesserie inventory created: {len(cafe_inventory['items'])} items")

# NOW CREATE RECIPES FOR CAFESSERIE MENU ITEMS
cafe_recipes = []

def add_cafe_recipe(menu_sku, menu_name, ingredients, needs_confirmation=False):
    cafe_recipes.append({
        "menuSku": menu_sku,
        "menuName": menu_name,
        "ingredients": ingredients,
        "needsConfirmation": needs_confirmation
    })

# Map menu items to recipes
for item in menu_data['items']:
    sku = item['sku']
    name = item['name']
    category = item.get('category', '')
    
    # COFFEE DRINKS
    if category == 'coffee':
        if 'Espresso' in name and 'Double' not in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-COFF-0001", "name": "Coffee Beans", "qty": 9, "unit": "G", "note": "Single shot"}
            ])
        elif 'Double Espresso' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-COFF-0001", "name": "Coffee Beans", "qty": 18, "unit": "G", "note": "Double shot"}
            ])
        elif 'Americano' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-COFF-0001", "name": "Coffee Beans", "qty": 18, "unit": "G", "note": "Double shot"},
                {"inventorySku": "CAF-INV-BEV-0004", "name": "Hot Water", "qty": 150, "unit": "ML", "note": ""}
            ])
        elif 'Cappuccino' in name and 'Hazelnut' not in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-COFF-0001", "name": "Coffee Beans", "qty": 18, "unit": "G", "note": "Double shot"},
                {"inventorySku": "CAF-INV-DARY-0001", "name": "Milk", "qty": 150, "unit": "ML", "note": "Steamed & foamed"}
            ])
        elif 'Latte' in name and 'Caramel' not in name and 'Vanilla' not in name and 'Iced' not in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-COFF-0001", "name": "Coffee Beans", "qty": 18, "unit": "G", "note": "Double shot"},
                {"inventorySku": "CAF-INV-DARY-0001", "name": "Milk", "qty": 200, "unit": "ML", "note": "Steamed"}
            ])
        elif 'Flat White' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-COFF-0001", "name": "Coffee Beans", "qty": 18, "unit": "G", "note": "Double shot"},
                {"inventorySku": "CAF-INV-DARY-0001", "name": "Milk", "qty": 180, "unit": "ML", "note": "Microfoam"}
            ])
        elif 'Macchiato' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-COFF-0001", "name": "Coffee Beans", "qty": 18, "unit": "G", "note": "Double shot"},
                {"inventorySku": "CAF-INV-DARY-0001", "name": "Milk", "qty": 30, "unit": "ML", "note": "Foam mark"}
            ])
        elif 'Mocha' in name and 'Iced' not in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-COFF-0001", "name": "Coffee Beans", "qty": 18, "unit": "G", "note": "Double shot"},
                {"inventorySku": "CAF-INV-DARY-0001", "name": "Milk", "qty": 180, "unit": "ML", "note": "Steamed"},
                {"inventorySku": "CAF-INV-SYRP-0004", "name": "Chocolate Syrup", "qty": 20, "unit": "ML", "note": ""}
            ])
    
    # SPECIALTY COFFEE
    elif category == 'specialty-coffee':
        if 'Caramel Latte' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-COFF-0001", "name": "Coffee Beans", "qty": 18, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-DARY-0001", "name": "Milk", "qty": 200, "unit": "ML", "note": ""},
                {"inventorySku": "CAF-INV-SYRP-0002", "name": "Caramel Syrup", "qty": 20, "unit": "ML", "note": ""}
            ])
        elif 'Vanilla Latte' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-COFF-0001", "name": "Coffee Beans", "qty": 18, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-DARY-0001", "name": "Milk", "qty": 200, "unit": "ML", "note": ""},
                {"inventorySku": "CAF-INV-SYRP-0001", "name": "Vanilla Syrup", "qty": 20, "unit": "ML", "note": ""}
            ])
        elif 'Hazelnut Cappuccino' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-COFF-0001", "name": "Coffee Beans", "qty": 18, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-DARY-0001", "name": "Milk", "qty": 150, "unit": "ML", "note": ""},
                {"inventorySku": "CAF-INV-SYRP-0003", "name": "Hazelnut Syrup", "qty": 20, "unit": "ML", "note": ""}
            ])
        elif 'Iced Latte' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-COFF-0001", "name": "Coffee Beans", "qty": 18, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-DARY-0001", "name": "Milk", "qty": 200, "unit": "ML", "note": "Cold"}
            ])
        elif 'Iced Mocha' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-COFF-0001", "name": "Coffee Beans", "qty": 18, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-DARY-0001", "name": "Milk", "qty": 180, "unit": "ML", "note": "Cold"},
                {"inventorySku": "CAF-INV-SYRP-0004", "name": "Chocolate Syrup", "qty": 20, "unit": "ML", "note": ""}
            ])
        elif 'Affogato' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-COFF-0001", "name": "Coffee Beans", "qty": 18, "unit": "G", "note": "Double shot"},
                {"inventorySku": "CAF-INV-DARY-0009", "name": "Vanilla Ice Cream", "qty": 100, "unit": "G", "note": ""}
            ])
    
    # TEA
    elif category == 'tea':
        if 'English Breakfast' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-TEA-0001", "name": "English Breakfast Tea", "qty": 1, "unit": "BAG", "note": ""}
            ])
        elif 'Earl Grey' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-TEA-0002", "name": "Earl Grey Tea", "qty": 1, "unit": "BAG", "note": ""}
            ])
        elif 'Green Tea' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-TEA-0003", "name": "Green Tea", "qty": 1, "unit": "BAG", "note": ""}
            ])
        elif 'Chamomile' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-TEA-0004", "name": "Chamomile Tea", "qty": 1, "unit": "BAG", "note": ""}
            ])
        elif 'Peppermint' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-TEA-0005", "name": "Peppermint Tea", "qty": 1, "unit": "BAG", "note": ""}
            ])
    
    # BREAKFAST
    elif category == 'breakfast':
        if 'Croissant' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-BRED-0003", "name": "Croissant", "qty": 1, "unit": "PC", "note": "Baked"}
            ])
        elif 'Bagel' in name:
            if 'Smoked Salmon' in name:
                add_cafe_recipe(sku, name, [
                    {"inventorySku": "CAF-INV-BRED-0004", "name": "Bagel", "qty": 1, "unit": "PC", "note": ""},
                    {"inventorySku": "CAF-INV-DARY-0006", "name": "Cream Cheese", "qty": 30, "unit": "G", "note": ""},
                    {"inventorySku": "CAF-INV-PROT-0005", "name": "Smoked Salmon", "qty": 50, "unit": "G", "note": ""}
                ])
            else:
                add_cafe_recipe(sku, name, [
                    {"inventorySku": "CAF-INV-BRED-0004", "name": "Bagel", "qty": 1, "unit": "PC", "note": ""},
                    {"inventorySku": "CAF-INV-DARY-0006", "name": "Cream Cheese", "qty": 30, "unit": "G", "note": ""}
                ])
        elif 'Avocado Toast' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-BRED-0002", "name": "Whole Wheat Bread", "qty": 2, "unit": "SLICES", "note": "Toasted"},
                {"inventorySku": "CAF-INV-PROD-0004", "name": "Avocado", "qty": 1, "unit": "PC", "note": ""},
                {"inventorySku": "CAF-INV-DARY-0011", "name": "Eggs", "qty": 1, "unit": "PC", "note": "Optional"}
            ])
        elif 'Yogurt Parfait' in name or 'Yoghurt' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-DARY-0010", "name": "Yoghurt", "qty": 200, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-FRUT-0001", "name": "Mixed Berries", "qty": 80, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-SYRP-0006", "name": "Honey", "qty": 15, "unit": "ML", "note": ""}
            ])
        elif 'Eggs' in name or 'Omelette' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-DARY-0011", "name": "Eggs", "qty": 2, "unit": "PC", "note": ""},
                {"inventorySku": "CAF-INV-BRED-0001", "name": "Toast", "qty": 2, "unit": "SLICES", "note": ""}
            ])
    
    # PASTRIES
    elif category == 'pastries':
        if 'Muffin' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-BRED-0005", "name": "Muffin Mix", "qty": 120, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-DARY-0011", "name": "Eggs", "qty": 1, "unit": "PC", "note": ""},
                {"inventorySku": "CAF-INV-FRUT-0003", "name": "Blueberries", "qty": 30, "unit": "G", "note": "Optional"}
            ])
        elif 'Scone' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-BRED-0006", "name": "Scone Mix", "qty": 100, "unit": "G", "note": ""}
            ])
        elif 'Brownie' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-BAKF-0001", "name": "Flour", "qty": 80, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-BAKF-0005", "name": "Cocoa", "qty": 40, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-BAKF-0006", "name": "Chocolate Chips", "qty": 30, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-DARY-0011", "name": "Eggs", "qty": 2, "unit": "PC", "note": ""},
                {"inventorySku": "CAF-INV-DARY-0005", "name": "Butter", "qty": 60, "unit": "G", "note": ""}
            ])
        elif 'Cookie' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-BAKF-0001", "name": "Flour", "qty": 60, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-BAKF-0006", "name": "Chocolate Chips", "qty": 40, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-BAKF-0002", "name": "Sugar", "qty": 30, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-DARY-0005", "name": "Butter", "qty": 40, "unit": "G", "note": ""}
            ])
    
    # SANDWICHES
    elif category == 'sandwiches':
        if 'Chicken' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-BRED-0001", "name": "Bread", "qty": 2, "unit": "SLICES", "note": ""},
                {"inventorySku": "CAF-INV-PROT-0001", "name": "Chicken Breast", "qty": 100, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-PROD-0002", "name": "Lettuce", "qty": 20, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-PROD-0001", "name": "Tomato", "qty": 30, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-COND-0001", "name": "Mayo", "qty": 15, "unit": "G", "note": ""}
            ])
        elif 'Ham' in name or 'BLT' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-BRED-0001", "name": "Bread", "qty": 2, "unit": "SLICES", "note": ""},
                {"inventorySku": "CAF-INV-PROT-0002", "name": "Ham", "qty": 60, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-PROT-0003", "name": "Bacon", "qty": 40, "unit": "G", "note": "Optional"},
                {"inventorySku": "CAF-INV-PROD-0002", "name": "Lettuce", "qty": 20, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-PROD-0001", "name": "Tomato", "qty": 30, "unit": "G", "note": ""}
            ])
        elif 'Tuna' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-BRED-0001", "name": "Bread", "qty": 2, "unit": "SLICES", "note": ""},
                {"inventorySku": "CAF-INV-PROT-0004", "name": "Tuna", "qty": 1, "unit": "TIN", "note": ""},
                {"inventorySku": "CAF-INV-COND-0001", "name": "Mayo", "qty": 20, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-PROD-0002", "name": "Lettuce", "qty": 20, "unit": "G", "note": ""}
            ])
        else:
            # Generic sandwich
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-BRED-0001", "name": "Bread", "qty": 2, "unit": "SLICES", "note": ""},
                {"inventorySku": "CAF-INV-DARY-0007", "name": "Cheese", "qty": 40, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-PROD-0002", "name": "Lettuce", "qty": 20, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-PROD-0001", "name": "Tomato", "qty": 30, "unit": "G", "note": ""}
            ], True)
    
    # SALADS
    elif category == 'salads':
        if 'Caesar' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-PROD-0002", "name": "Lettuce", "qty": 150, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-PROT-0001", "name": "Chicken", "qty": 80, "unit": "G", "note": "Optional"},
                {"inventorySku": "CAF-INV-DARY-0004", "name": "Parmesan", "qty": 20, "unit": "G", "note": ""}
            ])
        elif 'Greek' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-PROD-0002", "name": "Lettuce", "qty": 100, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-PROD-0001", "name": "Tomato", "qty": 60, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-PROD-0003", "name": "Cucumber", "qty": 50, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-DARY-0008", "name": "Feta Cheese", "qty": 40, "unit": "G", "note": ""}
            ])
        else:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-PROD-0002", "name": "Mixed Greens", "qty": 120, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-PROD-0001", "name": "Tomato", "qty": 40, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-PROD-0003", "name": "Cucumber", "qty": 40, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-COND-0003", "name": "Olive Oil", "qty": 10, "unit": "ML", "note": "Dressing"}
            ])
    
    # HOT MEALS
    elif category == 'mains':
        add_cafe_recipe(sku, name, [
            {"inventorySku": "CAF-INV-PROT-0001", "name": "Protein", "qty": 150, "unit": "G", "note": ""},
            {"inventorySku": "CAF-INV-PROD-0001", "name": "Vegetables", "qty": 100, "unit": "G", "note": ""}
        ], True)
    
    # DESSERTS
    elif category == 'desserts':
        if 'Cake' in name or 'Cheesecake' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-BAKF-0001", "name": "Flour", "qty": 80, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-BAKF-0002", "name": "Sugar", "qty": 60, "unit": "G", "note": ""},
                {"inventorySku": "CAF-INV-DARY-0011", "name": "Eggs", "qty": 2, "unit": "PC", "note": ""},
                {"inventorySku": "CAF-INV-DARY-0006", "name": "Cream Cheese", "qty": 100, "unit": "G", "note": "Optional"}
            ])
        elif 'Ice Cream' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-DARY-0009", "name": "Ice Cream", "qty": 150, "unit": "G", "note": ""}
            ])
    
    # SMOOTHIES
    elif category == 'smoothies':
        add_cafe_recipe(sku, name, [
            {"inventorySku": "CAF-INV-FRUT-0001", "name": "Mixed Fruit", "qty": 200, "unit": "G", "note": ""},
            {"inventorySku": "CAF-INV-DARY-0010", "name": "Yoghurt", "qty": 100, "unit": "G", "note": ""},
            {"inventorySku": "CAF-INV-SYRP-0006", "name": "Honey", "qty": 15, "unit": "ML", "note": ""}
        ])
    
    # FRESH JUICE
    elif category == 'fresh-juice':
        fruit_map = {
            'Orange': 'CAF-INV-FRUT-0004',
            'Apple': 'CAF-INV-FRUT-0005',
            'Pineapple': 'CAF-INV-FRUT-0006',
            'Mango': 'CAF-INV-FRUT-0007',
            'Watermelon': 'CAF-INV-FRUT-0008'
        }
        fruit_sku = next((v for k, v in fruit_map.items() if k in name), 'CAF-INV-FRUT-0004')
        add_cafe_recipe(sku, name, [
            {"inventorySku": fruit_sku, "name": "Fresh Fruit", "qty": 300, "unit": "G", "note": "For juice"}
        ])
    
    # COLD DRINKS
    elif category == 'cold-drinks':
        if 'Coca Cola' in name or 'Coke' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-BEV-0001", "name": "Coca Cola", "qty": 1, "unit": "BTL", "note": ""}
            ])
        elif 'Sprite' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-BEV-0002", "name": "Sprite", "qty": 1, "unit": "BTL", "note": ""}
            ])
        elif 'Fanta' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-BEV-0003", "name": "Fanta", "qty": 1, "unit": "BTL", "note": ""}
            ])
        elif 'Water' in name:
            add_cafe_recipe(sku, name, [
                {"inventorySku": "CAF-INV-BEV-0004", "name": "Water", "qty": 1, "unit": "BTL", "note": ""}
            ])

# Save cafesserie recipes
with open('data/cafesserie-recipes.json', 'w') as f:
    json.dump(cafe_recipes, f, indent=2)

print(f"✅ Cafesserie recipes created: {len(cafe_recipes)} recipes")
print(f"   Needs confirmation: {len([r for r in cafe_recipes if r['needsConfirmation']])}")

print(f"\n✅ All Cafesserie files generated successfully!")
print(f"\n📊 SUMMARY:")
print(f"   Cafesserie Menu: {len(menu_data['items'])} items")
print(f"   Cafesserie Inventory: {len(cafe_inventory['items'])} items")
print(f"   Cafesserie Recipes: {len(cafe_recipes)} recipes")
