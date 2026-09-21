import type { Workspace, Recipe } from '../../types/domain';
import { recipeCost, itemCost } from './calculations';
export type Metric = 'margin_value' | 'margin_rate' | 'markup_rate' | 'food_rate';
export interface ProfitRow { recipe: Recipe; price_ht: number; cost: number; margin_value: number; margin_rate: number; markup_rate: number | null; food_rate: number; supplier_ids: string[] }
// Only the supplier chosen for costing is attributed. Other available offers do not imply purchases.
export function recipeSuppliers(state: Workspace, recipe: Recipe, seen = new Set<string>()): string[] {
 if(seen.has(recipe.id)) return [];
 const visited = new Set(seen).add(recipe.id);
 return [...new Set(recipe.lines.flatMap(line=>{
  if(line.type==='recipe'){const r=state.recipes.find(r=>r.id===line.target_id&&!r.deleted_at);return r?recipeSuppliers(state,r,visited):[];}
  const item=state.items.find(i=>i.id===line.target_id&&!i.deleted_at);
  if(!item)return [];
  const refs=state.references.filter(r=>!r.deleted_at&&r.item_id===item.id&&state.suppliers.some(s=>s.id===r.supplier_id&&!s.deleted_at));
  const ref=refs.find(r=>r.id===item.cost_reference_id)??(refs.length===1?refs[0]:undefined);
  return ref?[ref.supplier_id]:[];
 }))];
}
export function profitability(state:Workspace){
 const rows:ProfitRow[]=[],excluded:{recipe:Recipe;reason:string}[]=[];
 for(const recipe of state.recipes.filter(r=>!r.deleted_at)){
  const c=recipeCost(state,recipe);
  if(c.warnings.length){excluded.push({recipe,reason:'Coût incomplet : prix de référence manquant'});continue;}
  if(recipe.sale_price_ttc<=0){excluded.push({recipe,reason:'Prix de vente à renseigner'});continue;}
  const price_ht=recipe.sale_price_ttc/(1+recipe.vat_percent/100);
  const margin_value=price_ht-c.per_portion;
  rows.push({recipe,price_ht,cost:c.per_portion,margin_value,margin_rate:margin_value/price_ht*100,markup_rate:c.per_portion>0?margin_value/c.per_portion*100:null,food_rate:c.material_per_portion/price_ht*100,supplier_ids:recipeSuppliers(state,recipe)});
 }
 return {rows,excluded};
}
export function rankProfit(rows:ProfitRow[],metric:Metric,bestFirst:boolean){
 return [...rows].sort((a,b)=>{const av=a[metric],bv=b[metric];if(av===null)return bv===null?a.recipe.name.localeCompare(b.recipe.name,'fr'):1;if(bv===null)return -1;const sign=(metric==='food_rate'?-1:1)*(bestFirst?-1:1);return (av-bv)*sign||a.recipe.name.localeCompare(b.recipe.name,'fr');});
}
export function supplierCatalog(state:Workspace){return state.suppliers.filter(s=>!s.deleted_at).map(s=>{const refs=state.references.filter(r=>!r.deleted_at&&r.supplier_id===s.id);const items=state.items.filter(i=>!i.deleted_at&&refs.some(r=>r.item_id===i.id));return {supplier:s,references:refs,items,missing_prices:items.filter(i=>itemCost(state,i.id)===null).length};});}
