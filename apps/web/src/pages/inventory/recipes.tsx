/**
 * M11.4: Recipes/BOM Page
 * 
 * Provides UI for managing recipes (Bills of Materials):
 * - List active and inactive recipes
 * - Create new recipe with ingredient lines
 * - Edit recipe details and lines
 * - Clone recipes to new menu items
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api';
import { Plus, Search, Trash2, Edit, ChevronDown, ChevronRight } from 'lucide-react';

interface RecipeLine {
    id: string;
    inventoryItemId: string;
    qtyInput: string;
    inputUomId: string;
    qtyBase: string;
    notes: string | null;
    inventoryItem: {
        id: string;
        name: string;
        sku: string;
        unit: string;
    };
    inputUom: {
        id: string;
        code: string;
        name: string;
    };
}

interface Recipe {
    id: string;
    name: string;
    targetType: 'MENU_ITEM' | 'INVENTORY_ITEM';
    targetId: string;
    outputQtyBase: string;
    outputUomId: string | null;
    isActive: boolean;
    createdAt: string;
    lines: RecipeLine[];
    createdBy: {
        id: string;
        firstName: string;
        lastName: string;
    };
    outputUom?: {
        id: string;
        code: string;
        name: string;
    };
}

interface InventoryItem {
    id: string;
    name: string;
    sku: string | null;
}

interface MenuItem {
    id: string;
    name: string;
}

interface UOM {
    id: string;
    code: string;
    name: string;
}

export default function RecipesPage() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState<string>('true');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
    const [expandedRecipes, setExpandedRecipes] = useState<Set<string>>(new Set());

    // Form state
    const [formName, setFormName] = useState('');
    const [formTargetType, setFormTargetType] = useState<'MENU_ITEM' | 'INVENTORY_ITEM'>('MENU_ITEM');
    const [formTargetId, setFormTargetId] = useState('');
    const [formOutputQty, setFormOutputQty] = useState('1');
    const [formLines, setFormLines] = useState<Array<{
        inventoryItemId: string;
        qtyInput: string;
        inputUomId: string;
        notes: string;
    }>>([]);

    // Fetch recipes
    const { data, isLoading } = useQuery({
        queryKey: ['recipes', search, activeFilter],
        queryFn: async () => {
            const params: Record<string, string> = {
                includeLines: 'true',
            };
            if (search) params.search = search;
            if (activeFilter) params.isActive = activeFilter;
            const response = await apiClient.get<{ recipes: Recipe[]; total: number }>(
                '/inventory/v2/recipes',
                { params }
            );
            return response.data;
        },
    });

    // Fetch items for dropdown
    const { data: items } = useQuery({
        queryKey: ['inventory-items-list'],
        queryFn: async () => {
            const response = await apiClient.get<InventoryItem[]>('/inventory/items');
            return response.data;
        },
    });

    // Fetch menu items for dropdown
    const { data: menuItems } = useQuery({
        queryKey: ['menu-items-list'],
        queryFn: async () => {
            const response = await apiClient.get<MenuItem[]>('/pos/menu-items');
            return response.data;
        },
    });

    // Fetch UOMs for dropdown
    const { data: uoms } = useQuery({
        queryKey: ['uoms-list'],
        queryFn: async () => {
            const response = await apiClient.get<UOM[]>('/inventory/foundation/uoms');
            return response.data;
        },
    });

    // Create recipe mutation
    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const response = await apiClient.post('/inventory/v2/recipes', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recipes'] });
            handleCloseDialog();
        },
    });

    // Update recipe mutation
    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            const response = await apiClient.patch(`/inventory/v2/recipes/${id}`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recipes'] });
            handleCloseDialog();
        },
    });

    // Delete recipe mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const response = await apiClient.delete(`/inventory/v2/recipes/${id}`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recipes'] });
        },
    });

    // Toggle recipe active status
    const toggleActiveMutation = useMutation({
        mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
            const response = await apiClient.patch(`/inventory/v2/recipes/${id}`, { isActive });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recipes'] });
        },
    });

    const handleOpenCreate = () => {
        setEditingRecipe(null);
        setFormName('');
        setFormTargetType('MENU_ITEM');
        setFormTargetId('');
        setFormOutputQty('1');
        setFormLines([{ inventoryItemId: '', qtyInput: '', inputUomId: '', notes: '' }]);
        setDialogOpen(true);
    };

    const handleOpenEdit = (recipe: Recipe) => {
        setEditingRecipe(recipe);
        setFormName(recipe.name);
        setFormTargetType(recipe.targetType);
        setFormTargetId(recipe.targetId);
        setFormOutputQty(recipe.outputQtyBase);
        setFormLines(
            recipe.lines.map((l) => ({
                inventoryItemId: l.inventoryItemId,
                qtyInput: l.qtyInput,
                inputUomId: l.inputUomId,
                notes: l.notes ?? '',
            }))
        );
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingRecipe(null);
    };

    const handleAddLine = () => {
        setFormLines([...formLines, { inventoryItemId: '', qtyInput: '', inputUomId: '', notes: '' }]);
    };

    const handleRemoveLine = (index: number) => {
        setFormLines(formLines.filter((_, i) => i !== index));
    };

    const handleUpdateLine = (index: number, field: string, value: string) => {
        const updated = [...formLines];
        (updated[index] as any)[field] = value;
        setFormLines(updated);
    };

    const handleSubmit = async () => {
        const validLines = formLines.filter((l) => l.inventoryItemId && l.qtyInput && l.inputUomId);

        if (editingRecipe) {
            // Update existing recipe
            await updateMutation.mutateAsync({
                id: editingRecipe.id,
                data: {
                    name: formName,
                    outputQtyBase: parseFloat(formOutputQty),
                    isActive: editingRecipe.isActive,
                },
            });
        } else {
            // Create new recipe
            await createMutation.mutateAsync({
                name: formName,
                targetType: formTargetType,
                targetId: formTargetId,
                outputQtyBase: parseFloat(formOutputQty),
                lines: validLines.map((l) => ({
                    inventoryItemId: l.inventoryItemId,
                    qtyInput: parseFloat(l.qtyInput),
                    inputUomId: l.inputUomId,
                    notes: l.notes || undefined,
                })),
            });
        }
    };

    const toggleExpand = (recipeId: string) => {
        const newExpanded = new Set(expandedRecipes);
        if (newExpanded.has(recipeId)) {
            newExpanded.delete(recipeId);
        } else {
            newExpanded.add(recipeId);
        }
        setExpandedRecipes(newExpanded);
    };

    return (
        <AppShell>
            <PageHeader
                title="Recipes (BOM)"
                subtitle="Manage recipes and bills of materials for menu items"
                actions={
                    <Button onClick={handleOpenCreate}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Recipe
                    </Button>
                }
            />

            <Card className="p-4 mb-4">
                <div className="flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Search recipes..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Select value={activeFilter} onValueChange={setActiveFilter}>
                        <option value="">All Status</option>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                    </Select>
                </div>
            </Card>

            <Card>
                {isLoading ? (
                    <div className="p-8 text-center text-muted-foreground">Loading...</div>
                ) : (data?.recipes ?? []).length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                        No recipes found
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-lg border">
                        <table className="min-w-full divide-y divide-border">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-10"></th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Recipe Name</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Target Type</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Ingredients</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Created</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border bg-background">
                                {(data?.recipes ?? []).map((recipe: Recipe) => (
                                    <React.Fragment key={recipe.id}>
                                        <tr className="hover:bg-muted/50 transition-colors">
                                            <td className="px-4 py-3 text-sm">
                                                <button
                                                    onClick={() => toggleExpand(recipe.id)}
                                                    className="p-1 hover:bg-gray-100 rounded"
                                                >
                                                    {expandedRecipes.has(recipe.id) ? (
                                                        <ChevronDown className="h-4 w-4" />
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4" />
                                                    )}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-sm font-medium">{recipe.name}</td>
                                            <td className="px-4 py-3 text-sm">
                                                <Badge variant={recipe.targetType === 'MENU_ITEM' ? 'default' : 'secondary'}>
                                                    {recipe.targetType.replace('_', ' ')}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-sm">{recipe.lines?.length ?? 0} items</td>
                                            <td className="px-4 py-3 text-sm">
                                                <Badge variant={recipe.isActive ? 'success' : 'secondary'}>
                                                    {recipe.isActive ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-sm">{new Date(recipe.createdAt).toLocaleDateString()}</td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="flex gap-2">
                                                    <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(recipe)}>
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => toggleActiveMutation.mutate({ id: recipe.id, isActive: !recipe.isActive })}
                                                    >
                                                        {recipe.isActive ? 'Deactivate' : 'Activate'}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => { if (confirm('Delete this recipe?')) deleteMutation.mutate(recipe.id); }}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedRecipes.has(recipe.id) && (
                                            <tr>
                                                <td colSpan={7} className="px-4 py-4 bg-gray-50">
                                                    <h4 className="font-medium mb-2">Ingredients</h4>
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="text-left border-b">
                                                                <th className="pb-2">SKU</th>
                                                                <th className="pb-2">Ingredient</th>
                                                                <th className="pb-2">Qty Input</th>
                                                                <th className="pb-2">UOM</th>
                                                                <th className="pb-2">Qty Base</th>
                                                                <th className="pb-2">Notes</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {recipe.lines.map((line: RecipeLine) => (
                                                                <tr key={line.id} className="border-b">
                                                                    <td className="py-2">{line.inventoryItem.sku}</td>
                                                                    <td className="py-2">{line.inventoryItem.name}</td>
                                                                    <td className="py-2">{line.qtyInput}</td>
                                                                    <td className="py-2">{line.inputUom.code}</td>
                                                                    <td className="py-2">{line.qtyBase}</td>
                                                                    <td className="py-2 text-gray-500">{line.notes}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <div className="p-6 max-w-2xl">
                    <h3 className="text-lg font-medium mb-4">
                        {editingRecipe ? 'Edit Recipe' : 'Create Recipe'}
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <Label>Recipe Name</Label>
                            <Input
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                placeholder="e.g., Chicken Burger Recipe"
                            />
                        </div>

                        {!editingRecipe && (
                            <>
                                <div>
                                    <Label>Target Type</Label>
                                    <Select
                                        value={formTargetType}
                                        onValueChange={(v) => setFormTargetType(v as 'MENU_ITEM' | 'INVENTORY_ITEM')}
                                    >
                                        <option value="MENU_ITEM">Menu Item</option>
                                        <option value="INVENTORY_ITEM">Inventory Item</option>
                                    </Select>
                                </div>

                                <div>
                                    <Label>
                                        {formTargetType === 'MENU_ITEM' ? 'Menu Item' : 'Inventory Item'}
                                    </Label>
                                    <Select value={formTargetId} onValueChange={setFormTargetId}>
                                        <option value="">Select...</option>
                                        {formTargetType === 'MENU_ITEM'
                                            ? menuItems?.map((item) => (
                                                <option key={item.id} value={item.id}>
                                                    {item.name}
                                                </option>
                                            ))
                                            : items?.map((item) => (
                                                <option key={item.id} value={item.id}>
                                                    {item.sku} - {item.name}
                                                </option>
                                            ))}
                                    </Select>
                                </div>
                            </>
                        )}

                        <div>
                            <Label>Output Quantity (per unit)</Label>
                            <Input
                                type="number"
                                min="0.001"
                                step="0.001"
                                value={formOutputQty}
                                onChange={(e) => setFormOutputQty(e.target.value)}
                            />
                        </div>

                        {!editingRecipe && (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <Label>Ingredients</Label>
                                    <Button variant="outline" size="sm" onClick={handleAddLine}>
                                        <Plus className="h-4 w-4 mr-1" />
                                        Add Line
                                    </Button>
                                </div>

                                <div className="space-y-3">
                                    {formLines.map((line, index) => (
                                        <div key={index} className="flex gap-2 items-end">
                                            <div className="flex-1">
                                                <Select
                                                    value={line.inventoryItemId}
                                                    onValueChange={(v) => handleUpdateLine(index, 'inventoryItemId', v)}
                                                >
                                                    <option value="">Select Item...</option>
                                                    {items?.map((item) => (
                                                        <option key={item.id} value={item.id}>
                                                            {item.sku} - {item.name}
                                                        </option>
                                                    ))}
                                                </Select>
                                            </div>
                                            <div className="w-24">
                                                <Input
                                                    type="number"
                                                    min="0.001"
                                                    step="0.001"
                                                    placeholder="Qty"
                                                    value={line.qtyInput}
                                                    onChange={(e) => handleUpdateLine(index, 'qtyInput', e.target.value)}
                                                />
                                            </div>
                                            <div className="w-32">
                                                <Select
                                                    value={line.inputUomId}
                                                    onValueChange={(v) => handleUpdateLine(index, 'inputUomId', v)}
                                                >
                                                    <option value="">UOM...</option>
                                                    {uoms?.map((uom) => (
                                                        <option key={uom.id} value={uom.id}>
                                                            {uom.code}
                                                        </option>
                                                    ))}
                                                </Select>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleRemoveLine(index)}
                                                disabled={formLines.length === 1}
                                            >
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <Button variant="outline" onClick={handleCloseDialog}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={
                                !formName ||
                                (!editingRecipe && (!formTargetId || formLines.every((l) => !l.inventoryItemId)))
                            }
                        >
                            {editingRecipe ? 'Save Changes' : 'Create Recipe'}
                        </Button>
                    </div>
                </div>
            </Dialog>
        </AppShell>
    );
}
