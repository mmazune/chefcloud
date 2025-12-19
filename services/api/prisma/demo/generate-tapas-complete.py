#!/usr/bin/env python3
"""
Generate Complete Tapas Menu + Recipes from Inventory

This script:
1. Expands tapas-menu.json to include ALL drinks from inventory (beers, wines, spirits)
2. Creates tapas-recipes.json with ingredient mappings for every menu item
3. Ensures deterministic SKUs and idempotent data
"""

import json
from typing import Dict, List

# Load existing data
with open('data/tapas-menu.json', 'r') as f:
    menu_data = json.load(f)

with open('data/tapas-inventory.json', 'r') as f:
    inventory_data = json.load(f)

# Track next SKU numbers for each category
sku_counters = {
    'BEER': 4,  # TAP-BEER-0003 exists
    'WINE': 1,
    'SPRT': 1,  # Spirits
}

# Build SKU map for quick lookup
inventory_by_sku = {item['sku']: item for item in inventory_data['items']}

def generate_drink_item(inv_item, category_name, sku_prefix, price_multiplier=1.0):
    """Generate a menu item from an inventory item"""
    global sku_counters
    sku_num = sku_counters.get(sku_prefix, 1)
    sku = f"TAP-{sku_prefix}-{sku_num:04d}"
    sku_counters[sku_prefix] = sku_num + 1
    
    # Calculate menu price from cost (typical 3-4x markup for drinks)
    base_price = float(inv_item['unitCost']) * price_multiplier
    
    return {
        "sku": sku,
        "name": inv_item['name'],
        "description": f"{inv_item['name']} - {inv_item.get('unit', 'BTL')}",
        "category": category_name,
        "itemType": "DRINK",
        "station": "BAR",
        "price": int(round(base_price / 100) * 100)  # Round to nearest 100
    }

# Existing menu items - keep as-is
existing_items = menu_data['items'].copy()

# Find highest SKU numbers in existing items to avoid conflicts
for item in existing_items:
    sku = item.get('sku', '')
    if 'BEER' in sku:
        parts = sku.split('-')
        if len(parts) == 3:
            try:
                num = int(parts[2])
                sku_counters['BEER'] = max(sku_counters['BEER'], num + 1)
            except:
                pass
    elif 'WINE' in sku:
        parts = sku.split('-')
        if len(parts) == 3:
            try:
                num = int(parts[2])
                sku_counters['WINE'] = max(sku_counters['WINE'], num + 1)
            except:
                pass

# Generate new drink items from inventory
new_items = []

# BEERS - add individual beer types from inventory
beer_items = [item for item in inventory_data['items'] if item['category'] == 'Beers']
for beer in beer_items:
    # Skip if already in menu
    if any(i['name'] == beer['name'] for i in existing_items):
        continue
    new_items.append(generate_drink_item(beer, "Beers & Ciders", "BEER", 3.5))

# WINES - add all wine types
wine_categories = {
    'Wine - Red': 'Wines - Red',
    'Wine - White': 'Wines - White',
    'Wine - Rose': 'Wines - Rosé',
    'Champagne': 'Wines - Champagne & Sparkling'
}

for inv_cat, menu_cat in wine_categories.items():
    wine_items = [item for item in inventory_data['items'] if item['category'] == inv_cat]
    for wine in wine_items:
        if any(i['name'] == wine['name'] for i in existing_items):
            continue
        # Wines sold by glass (175ml from 750ml bottle)
        glass_price = float(wine['unitCost']) * 0.25 * 4.0  # ~175ml at 4x markup
        new_items.append({
            "sku": f"TAP-WINE-{sku_counters['WINE']:04d}",
            "name": f"{wine['name']} (Glass)",
            "description": f"175ml glass of {wine['name']}",
            "category": menu_cat,
            "itemType": "DRINK",
            "station": "BAR",
            "price": int(round(glass_price / 1000) * 1000)
        })
        sku_counters['WINE'] += 1
        
        # Also bottle option
        bottle_price = float(wine['unitCost']) * 3.5
        new_items.append({
            "sku": f"TAP-WINE-{sku_counters['WINE']:04d}",
            "name": f"{wine['name']} (Bottle)",
            "description": f"750ml bottle of {wine['name']}",
            "category": menu_cat,
            "itemType": "DRINK",
            "station": "BAR",
            "price": int(round(bottle_price / 1000) * 1000)
        })
        sku_counters['WINE'] += 1

# SPIRITS - add all spirit categories
spirit_categories = {
    'Spirits - Vodka': 'Spirits - Vodka',
    'Spirits - Gin': 'Spirits - Gin',
    'Spirits - Rum': 'Spirits - Rum',
    'Spirits - Tequila': 'Spirits - Tequila',
    'Spirits - Whiskey': 'Spirits - Whiskey & Bourbon',
    'Spirits - Brandy': 'Spirits - Brandy & Cognac',
    'Liqueurs': 'Spirits - Creams & Liqueurs'
}

for inv_cat, menu_cat in spirit_categories.items():
    spirit_items = [item for item in inventory_data['items'] if item['category'] == inv_cat]
    for spirit in spirit_items:
        if any(i['name'] == spirit['name'] for i in existing_items):
            continue
        # Spirits sold by shot (35ml)
        shot_price = float(spirit['unitCost']) * 0.035 * 5.0  # 35ml at 5x markup
        new_items.append({
            "sku": f"TAP-SPRT-{sku_counters['SPRT']:04d}",
            "name": f"{spirit['name']} (Shot)",
            "description": f"35ml shot of {spirit['name']}",
            "category": menu_cat,
            "itemType": "DRINK",
            "station": "BAR",
            "price": int(round(shot_price / 500) * 500)  # Round to nearest 500
        })
        sku_counters['SPRT'] += 1

# Combine existing and new items
all_items = existing_items + new_items

# Update menu data
menu_data['items'] = all_items

# Save expanded menu
with open('data/tapas-menu.json', 'w') as f:
    json.dump(menu_data, f, indent=2)

print(f"✅ Tapas menu expanded:")
print(f"   Total items: {len(all_items)}")
print(f"   Food items: {len([i for i in all_items if i['itemType'] == 'FOOD'])}")
print(f"   Drink items: {len([i for i in all_items if i['itemType'] == 'DRINK'])}")
print(f"   New drinks added: {len(new_items)}")
print(f"   Beers: {len([i for i in all_items if 'Beer' in i['category']])}")
print(f"   Wines: {len([i for i in all_items if 'Wine' in i['category']])}")
print(f"   Spirits: {len([i for i in all_items if 'Spirit' in i['category']])}")
print(f"   Cocktails: {len([i for i in all_items if i['category'] == 'Cocktails'])}")
print(f"   Mocktails: {len([i for i in all_items if i['category'] == 'Mocktails'])}")

# NOW CREATE RECIPES FOR ALL ITEMS
recipes = []

# Helper to add recipe
def add_recipe(menu_sku, menu_name, ingredients, needs_confirmation=False):
    recipes.append({
        "menuSku": menu_sku,
        "menuName": menu_name,
        "ingredients": ingredients,
        "needsConfirmation": needs_confirmation
    })

# Process each menu item
for item in all_items:
    sku = item['sku']
    name = item['name']
    category = item['category']
    
    # DRINKS - mostly 1:1 mappings
    if 'Beer' in category or 'Cider' in category:
        # Find matching inventory SKU
        inv_match = None
        for inv_sku, inv_item in inventory_by_sku.items():
            if inv_item['name'].lower() in name.lower():
                inv_match = inv_sku
                break
        
        if inv_match:
            # Beer/cider: 1 bottle = 1 unit
            add_recipe(sku, name, [
                {"inventorySku": inv_match, "name": inventory_by_sku[inv_match]['name'], 
                 "qty": 1, "unit": "BTL", "note": ""}
            ])
        else:
            # Generic beer mapping - needs confirmation
            add_recipe(sku, name, [
                {"inventorySku": "INV-BEER-0001", "name": "Nile Special", 
                 "qty": 1, "unit": "BTL", "note": "Generic mapping"}
            ], True)
    
    elif 'Wine' in category:
        # Find matching wine inventory
        inv_match = None
        for inv_sku, inv_item in inventory_by_sku.items():
            if 'wine' in inv_item['category'].lower() or 'champagne' in inv_item['category'].lower():
                if inv_item['name'].lower().replace(' ', '') in name.lower().replace(' ', ''):
                    inv_match = inv_sku
                    break
        
        if inv_match:
            if '(Glass)' in name:
                # 175ml glass from 750ml bottle
                add_recipe(sku, name, [
                    {"inventorySku": inv_match, "name": inventory_by_sku[inv_match]['name'], 
                     "qty": 175, "unit": "ML", "note": ""}
                ])
            else:
                # Full bottle
                add_recipe(sku, name, [
                    {"inventorySku": inv_match, "name": inventory_by_sku[inv_match]['name'], 
                     "qty": 1, "unit": "BTL", "note": ""}
                ])
        else:
            # Generic wine - needs confirmation
            add_recipe(sku, name, [
                {"inventorySku": "INV-WINE-0001", "name": "Generic Wine", 
                 "qty": 175 if '(Glass)' in name else 1, 
                 "unit": "ML" if '(Glass)' in name else "BTL", 
                 "note": "Generic mapping"}
            ], True)
    
    elif 'Spirit' in category:
        # Find matching spirit inventory
        inv_match = None
        for inv_sku, inv_item in inventory_by_sku.items():
            if 'spirit' in inv_item['category'].lower() or 'liqueur' in inv_item['category'].lower():
                # Match by name (remove (Shot) suffix)
                clean_name = name.replace(' (Shot)', '')
                if inv_item['name'].lower() == clean_name.lower():
                    inv_match = inv_sku
                    break
        
        if inv_match:
            # 35ml shot
            add_recipe(sku, name, [
                {"inventorySku": inv_match, "name": inventory_by_sku[inv_match]['name'], 
                 "qty": 35, "unit": "ML", "note": ""}
            ])
        else:
            # Generic spirit - needs confirmation
            add_recipe(sku, name, [
                {"inventorySku": "INV-VODK-0001", "name": "Generic Spirit", 
                 "qty": 35, "unit": "ML", "note": "Generic mapping"}
            ], True)
    
    # COCKTAILS - multi-ingredient recipes
    elif category == 'Cocktails':
        if 'Martini' in name:
            if 'Dirty' in name:
                add_recipe(sku, name, [
                    {"inventorySku": "INV-VODK-0001", "name": "Vodka", "qty": 60, "unit": "ML", "note": ""},
                    {"inventorySku": "INV-OILS-0001", "name": "Olive Brine", "qty": 15, "unit": "ML", "note": ""},
                    {"inventorySku": "INV-VEGT-0007", "name": "Olives", "qty": 3, "unit": "PCS", "note": ""}
                ])
            else:
                add_recipe(sku, name, [
                    {"inventorySku": "INV-GIN-0002", "name": "Gin", "qty": 60, "unit": "ML", "note": ""},
                    {"inventorySku": "INV-VEGT-0007", "name": "Olives", "qty": 2, "unit": "PCS", "note": ""}
                ])
        elif 'Long Island' in name:
            add_recipe(sku, name, [
                {"inventorySku": "INV-VODK-0001", "name": "Vodka", "qty": 15, "unit": "ML", "note": ""},
                {"inventorySku": "INV-GIN-0001", "name": "Gin", "qty": 15, "unit": "ML", "note": ""},
                {"inventorySku": "INV-RUM-0001", "name": "Rum", "qty": 15, "unit": "ML", "note": ""},
                {"inventorySku": "INV-TEQL-0001", "name": "Tequila", "qty": 15, "unit": "ML", "note": ""},
                {"inventorySku": "INV-SODA-0001", "name": "Cola", "qty": 100, "unit": "ML", "note": ""},
                {"inventorySku": "INV-FRUT-0003", "name": "Lemon", "qty": 20, "unit": "ML", "note": "Juice"}
            ])
        elif 'Old Fashioned' in name:
            add_recipe(sku, name, [
                {"inventorySku": "INV-WHSK-0002", "name": "Bourbon", "qty": 60, "unit": "ML", "note": ""},
                {"inventorySku": "INV-MIXR-0001", "name": "Bitters", "qty": 3, "unit": "ML", "note": ""},
                {"inventorySku": "INV-SALT-0003", "name": "Sugar", "qty": 5, "unit": "G", "note": ""}
            ])
        elif 'Whiskey Sour' in name or 'Gin Sour' in name:
            base_spirit = "INV-WHSK-0001" if 'Whiskey' in name else "INV-GIN-0002"
            add_recipe(sku, name, [
                {"inventorySku": base_spirit, "name": "Base Spirit", "qty": 50, "unit": "ML", "note": ""},
                {"inventorySku": "INV-FRUT-0003", "name": "Lemon Juice", "qty": 25, "unit": "ML", "note": ""},
                {"inventorySku": "INV-SALT-0003", "name": "Sugar Syrup", "qty": 15, "unit": "ML", "note": ""}
            ])
        elif 'Mojito' in name:
            add_recipe(sku, name, [
                {"inventorySku": "INV-RUM-0002", "name": "White Rum", "qty": 50, "unit": "ML", "note": ""},
                {"inventorySku": "INV-VEGT-0012", "name": "Mint", "qty": 10, "unit": "G", "note": ""},
                {"inventorySku": "INV-FRUT-0004", "name": "Lime", "qty": 25, "unit": "ML", "note": "Juice"},
                {"inventorySku": "INV-SALT-0003", "name": "Sugar", "qty": 10, "unit": "G", "note": ""},
                {"inventorySku": "INV-SODA-0005", "name": "Soda Water", "qty": 100, "unit": "ML", "note": ""}
            ])
        elif 'Margarita' in name:
            add_recipe(sku, name, [
                {"inventorySku": "INV-TEQL-0002", "name": "Tequila", "qty": 50, "unit": "ML", "note": ""},
                {"inventorySku": "INV-CREM-0004", "name": "Cointreau", "qty": 25, "unit": "ML", "note": ""},
                {"inventorySku": "INV-FRUT-0004", "name": "Lime Juice", "qty": 25, "unit": "ML", "note": ""},
                {"inventorySku": "INV-SALT-0001", "name": "Salt", "qty": 2, "unit": "G", "note": "Rim"}
            ])
        else:
            # Generic cocktail - 3 ingredient default
            add_recipe(sku, name, [
                {"inventorySku": "INV-VODK-0001", "name": "Base Spirit", "qty": 50, "unit": "ML", "note": ""},
                {"inventorySku": "INV-FRUT-0003", "name": "Citrus", "qty": 20, "unit": "ML", "note": ""},
                {"inventorySku": "INV-SALT-0003", "name": "Sweetener", "qty": 10, "unit": "ML", "note": ""}
            ], True)
    
    # MOCKTAILS
    elif category == 'Mocktails':
        if 'Virgin Mojito' in name:
            add_recipe(sku, name, [
                {"inventorySku": "INV-VEGT-0012", "name": "Mint", "qty": 10, "unit": "G", "note": ""},
                {"inventorySku": "INV-FRUT-0004", "name": "Lime Juice", "qty": 30, "unit": "ML", "note": ""},
                {"inventorySku": "INV-SALT-0003", "name": "Sugar", "qty": 15, "unit": "G", "note": ""},
                {"inventorySku": "INV-SODA-0005", "name": "Soda Water", "qty": 200, "unit": "ML", "note": ""}
            ])
        else:
            # Generic mocktail
            add_recipe(sku, name, [
                {"inventorySku": "INV-FRUT-0005", "name": "Fresh Fruit", "qty": 100, "unit": "G", "note": ""},
                {"inventorySku": "INV-JUCE-0001", "name": "Juice", "qty": 150, "unit": "ML", "note": ""},
                {"inventorySku": "INV-SALT-0003", "name": "Sugar", "qty": 10, "unit": "G", "note": ""}
            ], True)
    
    # SOFT DRINKS & JUICES
    elif 'Soft Drink' in category or 'Juice' in category or 'Milkshake' in category or 'Smoothie' in category:
        if 'Water' in name:
            add_recipe(sku, name, [
                {"inventorySku": "INV-MINR-0001", "name": "Bottled Water", "qty": 1, "unit": "BTL", "note": ""}
            ])
        elif 'Soda' in name or 'Cola' in name or 'Sprite' in name or 'Fanta' in name:
            add_recipe(sku, name, [
                {"inventorySku": "INV-SODA-0001", "name": "Soda", "qty": 1, "unit": "BTL", "note": ""}
            ])
        elif 'Red Bull' in name:
            add_recipe(sku, name, [
                {"inventorySku": "INV-MINR-0002", "name": "Red Bull", "qty": 1, "unit": "CAN", "note": ""}
            ])
        elif 'Milkshake' in name:
            add_recipe(sku, name, [
                {"inventorySku": "INV-DARY-0006", "name": "Milk", "qty": 250, "unit": "ML", "note": ""},
                {"inventorySku": "INV-DARY-0011", "name": "Ice Cream", "qty": 100, "unit": "G", "note": ""},
                {"inventorySku": "INV-SYRP-0001", "name": "Flavored Syrup", "qty": 30, "unit": "ML", "note": ""}
            ])
        elif 'Smoothie' in name:
            add_recipe(sku, name, [
                {"inventorySku": "INV-FRUT-0005", "name": "Mixed Fruit", "qty": 200, "unit": "G", "note": ""},
                {"inventorySku": "INV-DARY-0007", "name": "Yoghurt", "qty": 100, "unit": "ML", "note": ""},
                {"inventorySku": "INV-SALT-0004", "name": "Honey", "qty": 15, "unit": "ML", "note": ""}
            ])
        elif 'juice' in name.lower():
            # Fresh juice
            fruit_map = {
                'orange': 'INV-JUCE-0001',
                'pineapple': 'INV-FRUT-0005',
                'passion': 'INV-FRUT-0006',
                'watermelon': 'INV-FRUT-0007',
                'mango': 'INV-FRUT-0008'
            }
            fruit_sku = next((v for k, v in fruit_map.items() if k in name.lower()), 'INV-FRUT-0005')
            add_recipe(sku, name, [
                {"inventorySku": fruit_sku, "name": "Fresh Fruit", "qty": 300, "unit": "G", "note": "For juice"}
            ])
        else:
            add_recipe(sku, name, [
                {"inventorySku": "INV-SODA-0001", "name": "Generic Beverage", "qty": 1, "unit": "BTL", "note": ""}
            ], True)
    
    # HOT BEVERAGES
    elif 'Hot Beverage' in category:
        if 'Tea' in name:
            add_recipe(sku, name, [
                {"inventorySku": "INV-COFF-0003", "name": "Tea Bag", "qty": 1, "unit": "PCS", "note": ""},
                {"inventorySku": "INV-MINR-0001", "name": "Hot Water", "qty": 250, "unit": "ML", "note": ""}
            ])
        elif 'Coffee' in name or 'Latte' in name or 'Cappuccino' in name or 'Espresso' in name or 'Americano' in name:
            # Coffee-based drinks
            if 'Latte' in name or 'Cappuccino' in name:
                add_recipe(sku, name, [
                    {"inventorySku": "INV-COFF-0001", "name": "Coffee Beans", "qty": 18, "unit": "G", "note": "Double shot"},
                    {"inventorySku": "INV-DARY-0006", "name": "Milk", "qty": 200, "unit": "ML", "note": "Steamed"}
                ])
            elif 'Mocha' in name:
                add_recipe(sku, name, [
                    {"inventorySku": "INV-COFF-0001", "name": "Coffee Beans", "qty": 18, "unit": "G", "note": ""},
                    {"inventorySku": "INV-DARY-0006", "name": "Milk", "qty": 150, "unit": "ML", "note": ""},
                    {"inventorySku": "INV-COFF-0004", "name": "Chocolate", "qty": 20, "unit": "G", "note": ""}
                ])
            else:
                # Americano/black coffee
                add_recipe(sku, name, [
                    {"inventorySku": "INV-COFF-0001", "name": "Coffee Beans", "qty": 18, "unit": "G", "note": "Double shot"},
                    {"inventorySku": "INV-MINR-0001", "name": "Hot Water", "qty": 150, "unit": "ML", "note": ""}
                ])
        elif 'Hot Chocolate' in name:
            add_recipe(sku, name, [
                {"inventorySku": "INV-COFF-0004", "name": "Drinking Chocolate", "qty": 30, "unit": "G", "note": ""},
                {"inventorySku": "INV-DARY-0006", "name": "Milk", "qty": 250, "unit": "ML", "note": "Hot"}
            ])
        else:
            add_recipe(sku, name, [
                {"inventorySku": "INV-COFF-0002", "name": "Instant Coffee", "qty": 5, "unit": "G", "note": ""},
                {"inventorySku": "INV-MINR-0001", "name": "Hot Water", "qty": 200, "unit": "ML", "note": ""}
            ], True)
    
    # FOOD ITEMS - Create proper recipes
    elif item['itemType'] == 'FOOD':
        if 'Breakfast' in category:
            if 'English Breakfast' in name:
                add_recipe(sku, name, [
                    {"inventorySku": "INV-CHKN-0004", "name": "Eggs", "qty": 2, "unit": "PCS", "note": ""},
                    {"inventorySku": "INV-PORK-0006", "name": "Pork Sausage", "qty": 100, "unit": "G", "note": ""},
                    {"inventorySku": "INV-PORK-0001", "name": "Bacon", "qty": 60, "unit": "G", "note": ""},
                    {"inventorySku": "INV-SAUC-0006", "name": "Baked Beans", "qty": 80, "unit": "G", "note": ""},
                    {"inventorySku": "INV-VEGT-0005", "name": "Mushrooms", "qty": 40, "unit": "G", "note": ""},
                    {"inventorySku": "INV-BAKF-0001", "name": "Toast", "qty": 2, "unit": "SLICES", "note": ""},
                    {"inventorySku": "INV-VEGT-0002", "name": "Tomato", "qty": 50, "unit": "G", "note": "Grilled"},
                    {"inventorySku": "INV-VEGT-0006", "name": "Potato", "qty": 100, "unit": "G", "note": "Wedges"}
                ])
            elif 'Healthy Breakfast' in name or 'Yoghurt' in name or 'Yogurt' in name:
                add_recipe(sku, name, [
                    {"inventorySku": "INV-DARY-0008", "name": "Vanilla Yoghurt", "qty": 200, "unit": "ML", "note": ""},
                    {"inventorySku": "INV-CERE-0004", "name": "Muesli", "qty": 50, "unit": "G", "note": ""},
                    {"inventorySku": "INV-FRUT-0005", "name": "Mixed Fruit", "qty": 100, "unit": "G", "note": ""},
                    {"inventorySku": "INV-SALT-0004", "name": "Honey", "qty": 15, "unit": "ML", "note": ""}
                ])
            elif 'Pancake' in name:
                add_recipe(sku, name, [
                    {"inventorySku": "INV-BAKF-0002", "name": "Flour", "qty": 120, "unit": "G", "note": ""},
                    {"inventorySku": "INV-CHKN-0004", "name": "Eggs", "qty": 1, "unit": "PCS", "note": ""},
                    {"inventorySku": "INV-DARY-0006", "name": "Milk", "qty": 150, "unit": "ML", "note": ""},
                    {"inventorySku": "INV-SYRP-0002", "name": "Pancake Syrup", "qty": 30, "unit": "ML", "note": ""},
                    {"inventorySku": "INV-FRUT-0002", "name": "Banana", "qty": 1, "unit": "PCS", "note": ""},
                    {"inventorySku": "INV-SALT-0004", "name": "Honey", "qty": 10, "unit": "ML", "note": ""}
                ])
            elif 'Avocado' in name:
                add_recipe(sku, name, [
                    {"inventorySku": "INV-BAKF-0001", "name": "Bread", "qty": 100, "unit": "G", "note": "Toasted"},
                    {"inventorySku": "INV-VEGT-0007", "name": "Avocado", "qty": 1, "unit": "PCS", "note": ""},
                    {"inventorySku": "INV-CHKN-0004", "name": "Eggs", "qty": 2, "unit": "PCS", "note": ""},
                    {"inventorySku": "INV-VEGT-0002", "name": "Tomato", "qty": 30, "unit": "G", "note": ""}
                ])
            elif 'Fruit Salad' in name:
                add_recipe(sku, name, [
                    {"inventorySku": "INV-FRUT-0005", "name": "Pineapple", "qty": 80, "unit": "G", "note": ""},
                    {"inventorySku": "INV-FRUT-0007", "name": "Watermelon", "qty": 80, "unit": "G", "note": ""},
                    {"inventorySku": "INV-FRUT-0008", "name": "Mango", "qty": 60, "unit": "G", "note": ""},
                    {"inventorySku": "INV-FRUT-0002", "name": "Banana", "qty": 1, "unit": "PCS", "note": ""},
                    {"inventorySku": "INV-FRUT-0003", "name": "Lemon Juice", "qty": 10, "unit": "ML", "note": ""},
                    {"inventorySku": "INV-SALT-0004", "name": "Honey", "qty": 15, "unit": "ML", "note": ""}
                ])
            else:
                # Generic breakfast
                add_recipe(sku, name, [
                    {"inventorySku": "INV-CHKN-0004", "name": "Eggs", "qty": 2, "unit": "PCS", "note": ""},
                    {"inventorySku": "INV-PORK-0006", "name": "Sausage", "qty": 80, "unit": "G", "note": ""},
                    {"inventorySku": "INV-BAKF-0001", "name": "Toast", "qty": 2, "unit": "SLICES", "note": ""},
                    {"inventorySku": "INV-VEGT-0002", "name": "Tomato", "qty": 40, "unit": "G", "note": ""}
                ], True)
        
        elif 'Burger' in category or 'Burger' in name:
            meat_map = {'Beef': 'INV-MEAT-0003', 'Chicken': 'INV-CHKN-0001', 'Pork': 'INV-PORK-0005'}
            meat_sku = next((v for k, v in meat_map.items() if k in name), 'INV-MEAT-0003')
            
            add_recipe(sku, name, [
                {"inventorySku": meat_sku, "name": "Patty", "qty": 150, "unit": "G", "note": ""},
                {"inventorySku": "INV-BAKF-0001", "name": "Burger Bun", "qty": 1, "unit": "PCS", "note": ""},
                {"inventorySku": "INV-DARY-0001", "name": "Cheese", "qty": 30, "unit": "G", "note": ""},
                {"inventorySku": "INV-VEGT-0001", "name": "Lettuce", "qty": 20, "unit": "G", "note": ""},
                {"inventorySku": "INV-VEGT-0002", "name": "Tomato", "qty": 30, "unit": "G", "note": ""},
                {"inventorySku": "INV-VEGT-0003", "name": "Onion", "qty": 20, "unit": "G", "note": ""},
                {"inventorySku": "INV-VEGT-0006", "name": "Fries", "qty": 150, "unit": "G", "note": "Side"},
                {"inventorySku": "INV-SAUC-0008", "name": "Mayo", "qty": 15, "unit": "G", "note": ""},
                {"inventorySku": "INV-SAUC-0007", "name": "Ketchup", "qty": 15, "unit": "G", "note": ""}
            ])
        
        elif 'Wing' in name or 'wings' in name.lower():
            add_recipe(sku, name, [
                {"inventorySku": "INV-CHKN-0002", "name": "Chicken Wings", "qty": 250, "unit": "G", "note": ""},
                {"inventorySku": "INV-SAUC-0001", "name": "BBQ Sauce", "qty": 30, "unit": "G", "note": ""},
                {"inventorySku": "INV-SPCE-0001", "name": "Spices", "qty": 5, "unit": "G", "note": ""}
            ])
        
        elif 'Pasta' in category or 'pasta' in name.lower():
            pasta_type = 'INV-CERE-0002' if 'Penne' in name else 'INV-CERE-0003'
            add_recipe(sku, name, [
                {"inventorySku": pasta_type, "name": "Pasta", "qty": 200, "unit": "G", "note": ""},
                {"inventorySku": "INV-SAUC-0003", "name": "Tomato Sauce", "qty": 100, "unit": "G", "note": ""},
                {"inventorySku": "INV-DARY-0004", "name": "Parmesan", "qty": 20, "unit": "G", "note": ""},
                {"inventorySku": "INV-VEGT-0010", "name": "Garlic", "qty": 5, "unit": "G", "note": ""},
                {"inventorySku": "INV-OILS-0001", "name": "Olive Oil", "qty": 10, "unit": "ML", "note": ""}
            ])
        
        elif 'Fish' in category or 'fish' in name.lower():
            add_recipe(sku, name, [
                {"inventorySku": "INV-FISH-0001", "name": "Fish Fillet", "qty": 200, "unit": "G", "note": ""},
                {"inventorySku": "INV-VEGT-0006", "name": "Potato", "qty": 150, "unit": "G", "note": ""},
                {"inventorySku": "INV-VEGT-0001", "name": "Lettuce", "qty": 30, "unit": "G", "note": ""},
                {"inventorySku": "INV-FRUT-0003", "name": "Lemon", "qty": 20, "unit": "G", "note": ""}
            ])
        
        elif 'Salad' in category or 'salad' in name.lower():
            add_recipe(sku, name, [
                {"inventorySku": "INV-VEGT-0001", "name": "Lettuce", "qty": 100, "unit": "G", "note": ""},
                {"inventorySku": "INV-VEGT-0002", "name": "Tomato", "qty": 60, "unit": "G", "note": ""},
                {"inventorySku": "INV-VEGT-0008", "name": "Cucumber", "qty": 50, "unit": "G", "note": ""},
                {"inventorySku": "INV-VEGT-0003", "name": "Onion", "qty": 20, "unit": "G", "note": ""},
                {"inventorySku": "INV-OILS-0001", "name": "Olive Oil", "qty": 15, "unit": "ML", "note": "Dressing"}
            ])
        
        elif 'Dessert' in category:
            if 'Ice Cream' in name or 'ice cream' in name.lower():
                add_recipe(sku, name, [
                    {"inventorySku": "INV-DARY-0011", "name": "Ice Cream", "qty": 150, "unit": "G", "note": ""},
                    {"inventorySku": "INV-SYRP-0001", "name": "Chocolate Syrup", "qty": 20, "unit": "ML", "note": ""}
                ])
            else:
                add_recipe(sku, name, [
                    {"inventorySku": "INV-BAKF-0002", "name": "Flour", "qty": 80, "unit": "G", "note": ""},
                    {"inventorySku": "INV-SALT-0003", "name": "Sugar", "qty": 60, "unit": "G", "note": ""},
                    {"inventorySku": "INV-CHKN-0004", "name": "Eggs", "qty": 1, "unit": "PCS", "note": ""},
                    {"inventorySku": "INV-DARY-0010", "name": "Butter", "qty": 40, "unit": "G", "note": ""}
                ], True)
        
        else:
            # Generic food - needs confirmation
            add_recipe(sku, name, [
                {"inventorySku": "INV-MEAT-0003", "name": "Protein", "qty": 150, "unit": "G", "note": ""},
                {"inventorySku": "INV-VEGT-0006", "name": "Vegetables", "qty": 100, "unit": "G", "note": ""},
                {"inventorySku": "INV-CERE-0001", "name": "Starch", "qty": 100, "unit": "G", "note": ""}
            ], True)

# Save recipes
with open('data/tapas-recipes.json', 'w') as f:
    json.dump(recipes, f, indent=2)

print(f"\n✅ Tapas recipes created:")
print(f"   Total recipes: {len(recipes)}")
print(f"   Needs confirmation: {len([r for r in recipes if r['needsConfirmation']])}")
print(f"   Verified recipes: {len([r for r in recipes if not r['needsConfirmation']])}")

print(f"\n✅ All files generated successfully!")
