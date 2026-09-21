export type Unit = 'kg' | 'g' | 'l' | 'ml' | 'piece';
export type Kind = 'ingredient' | 'packaging' | 'resale' | 'consumable';
export interface Entity { id: string; created_at: string; updated_at: string; deleted_at: string | null }
export interface Supplier extends Entity { name: string; email: string; phone: string; lead_days: number; notes: string }
export interface Item extends Entity { name: string; category: string; kind: Kind; unit: Unit; code: string; allergens: string; cost_reference_id: string | null }
export interface SupplierReference extends Entity { supplier_id: string; item_id: string; code: string; packaging: string; pack_count: number; content_quantity: number; content_unit: Unit; price_ht: number; minimum_packs: number }
export interface RecipeLine { id: string; type: 'item' | 'recipe'; target_id: string; quantity: number; unit: Unit | 'portion'; loss_percent: number }
export interface Recipe extends Entity { name: string; description: string; category: string; portions: number; lines: RecipeLine[]; preparation_minutes: number; hourly_cost: number; sale_price_ttc: number; vat_percent: number; target_food_percent: number; rounding: number }
export interface Cost { material: number; packaging: number; labor: number; total: number; per_portion: number; material_per_portion: number; suggested_ht: number; suggested_ttc: number; food_percent: number | null; margin: number; lines: { id: string; cost: number }[]; warnings: string[] }
export interface Audit { id: string; at: string; action: string; entity_id: string; label: string; before: unknown; after: unknown }
export interface Snapshot { id: string; at: string; recipe_id: string; recipe_name: string; recipe: Recipe; cost: Cost }
export interface Workspace { schema_version: 1; revision: number; suppliers: Supplier[]; items: Item[]; references: SupplierReference[]; recipes: Recipe[]; audit: Audit[]; snapshots: Snapshot[] }
