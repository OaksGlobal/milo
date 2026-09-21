import { z } from 'zod';
import type { Workspace, Entity, Supplier, Item, SupplierReference, Recipe } from '../../types/domain';
import { convert, recipeCost } from './calculations';
const nonnegative = z.number().finite().min(0).max(1e9);
const positive = nonnegative.refine(n => n > 0, 'Valeur strictement positive attendue');
const unit = z.enum(['kg','g','l','ml','piece']);
const base = { id: z.string().uuid(), created_at: z.string().datetime(), updated_at: z.string().datetime(), deleted_at: z.string().datetime().nullable() };
const name = z.string().trim().min(1, 'Le nom est obligatoire').max(200);
export const supplierSchema = z.object({ ...base, name, email: z.union([z.literal(''),z.string().email()]), phone: z.string().max(100), lead_days: z.number().int().min(0).max(365), notes: z.string().max(4000) });
export const itemSchema = z.object({ ...base, name, category: z.string().max(100), kind: z.enum(['ingredient','packaging','resale','consumable']), unit, code: z.string().max(100), allergens: z.string().max(500), cost_reference_id: z.string().uuid().nullable() });
export const referenceSchema = z.object({ ...base, supplier_id: z.string().uuid(), item_id: z.string().uuid(), code: z.string().max(100), packaging: name, pack_count: positive, content_quantity: positive, content_unit: unit, price_ht: nonnegative, minimum_packs: z.number().int().min(1).max(1e6) });
export const recipeSchema = z.object({ ...base, name, description: z.string().max(4000), category: z.string().max(100), portions: positive, lines: z.array(z.object({id: z.string().uuid(), type: z.enum(['item','recipe']), target_id: z.string().uuid(), quantity: positive, unit: z.enum(['kg','g','l','ml','piece','portion']), loss_percent: z.number().finite().min(0).max(99.99)})).min(1,'Ajoutez au moins une ligne'), preparation_minutes: nonnegative, hourly_cost: nonnegative, sale_price_ttc: nonnegative, vat_percent: z.number().min(0).max(100), target_food_percent: z.number().min(.1).max(100), rounding: z.number().min(.01).max(100) });
const costSchema = z.object({material: nonnegative, packaging: nonnegative, labor: nonnegative, total: nonnegative, per_portion: nonnegative, material_per_portion: nonnegative, suggested_ht: nonnegative, suggested_ttc: nonnegative, food_percent: nonnegative.nullable(), margin: z.number().finite(), lines: z.array(z.object({id:z.string().uuid(),cost:nonnegative})), warnings:z.array(z.string())});
export const workspaceSchema = z.object({schema_version:z.literal(1), revision:z.number().int().min(0), suppliers:z.array(supplierSchema),items:z.array(itemSchema),references:z.array(referenceSchema),recipes:z.array(recipeSchema),audit:z.array(z.object({id:z.string().uuid(),at:z.string().datetime(),action:z.string(),entity_id:z.string(),label:z.string(),before:z.unknown(),after:z.unknown()})),snapshots:z.array(z.object({id:z.string().uuid(),at:z.string().datetime(),recipe_id:z.string().uuid(),recipe_name:z.string(),recipe:recipeSchema,cost:costSchema}))});
export function emptyWorkspace(): Workspace { return {schema_version:1,revision:0,suppliers:[],items:[],references:[],recipes:[],audit:[],snapshots:[]}; }
export function entity(): Entity { const now = new Date().toISOString(); return {id:crypto.randomUUID(),created_at:now,updated_at:now,deleted_at:null}; }
export function validateWorkspace(input: unknown): Workspace {
  const state = workspaceSchema.parse(input) as Workspace;
  for (const collection of [state.suppliers,state.items,state.references,state.recipes]) if(new Set(collection.map(e=>e.id)).size !== collection.length) throw new Error('Identifiants en double.');
  for (const ref of state.references.filter(r=>!r.deleted_at)) {
    const item = state.items.find(i=>i.id===ref.item_id && !i.deleted_at);
    if (!item || !state.suppliers.some(s=>s.id===ref.supplier_id && !s.deleted_at)) throw new Error('Référence sans article ou fournisseur actif.');
    convert(ref.content_quantity,ref.content_unit,item.unit);
  }
  for (const item of state.items.filter(i=>!i.deleted_at)) if(item.cost_reference_id && !state.references.some(r=>r.id===item.cost_reference_id && r.item_id===item.id && !r.deleted_at)) throw new Error('La référence de coût doit appartenir à cet article.');
  for (const recipe of state.recipes) {
    if(new Set(recipe.lines.map(l=>l.id)).size!==recipe.lines.length) throw new Error('Identifiants de lignes en double.');
    if(!recipe.deleted_at) recipeCost(state, recipe);
  }
  return state;
}
export type Collection = 'suppliers' | 'items' | 'references' | 'recipes';
export type RecordEntity = Supplier | Item | SupplierReference | Recipe;
export function saveEntity(state:Workspace, collection:Collection, value:RecordEntity): Workspace {
  const next = structuredClone(state);
  const list = next[collection] as RecordEntity[];
  const index = list.findIndex(e=>e.id===value.id);
  const before = index >= 0 ? structuredClone(list[index]) : null;
  const record = {...value,updated_at:new Date().toISOString()};
  if(index<0) list.push(record); else list[index]=record;
  next.audit.unshift({id:crypto.randomUUID(),at:record.updated_at,action:value.deleted_at?'Archivage':before?'Modification':'Création',entity_id:value.id,label:'name' in value?value.name:value.code || value.packaging,before,after:record});
  return validateWorkspace(next);
}
