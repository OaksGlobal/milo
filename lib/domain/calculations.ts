import type { Unit, Workspace, Recipe, Cost, SupplierReference } from '../../types/domain';
const units: Record<Unit, { dimension: string; factor: number }> = { kg: { dimension: 'mass', factor: 1 }, g: { dimension: 'mass', factor: .001 }, l: { dimension: 'volume', factor: 1 }, ml: { dimension: 'volume', factor: .001 }, piece: { dimension: 'count', factor: 1 } };
export const round = (value: number, precision = 6) => Math.round((value + Number.EPSILON) * 10 ** precision) / 10 ** precision;
export function convert(quantity: number, from: Unit, to: Unit): number {
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error('La quantité doit être positive ou nulle.');
  if (!units[from] || !units[to] || units[from].dimension !== units[to].dimension) throw new Error(`Conversion incompatible : ${from} → ${to}.`);
  return quantity * units[from].factor / units[to].factor;
}
export function referenceCost(ref: SupplierReference, unit: Unit): number {
  const content = convert(ref.pack_count * ref.content_quantity, ref.content_unit, unit);
  if (content <= 0 || ref.price_ht < 0 || !Number.isFinite(ref.price_ht)) throw new Error('Conditionnement ou prix invalide.');
  return ref.price_ht / content;
}
export function itemCost(state: Workspace, id: string): number | null {
  const item = state.items.find(i => i.id === id && !i.deleted_at);
  if (!item) throw new Error('Article absent ou archivé.');
  const refs = state.references.filter(r => r.item_id === id && !r.deleted_at && state.suppliers.some(s => s.id === r.supplier_id && !s.deleted_at));
  const ref = refs.find(r => r.id === item.cost_reference_id) ?? (refs.length === 1 ? refs[0] : undefined);
  return ref ? referenceCost(ref, item.unit) : null;
}
export function recipeCost(state: Workspace, recipe: Recipe, parents: string[] = []): Cost {
  if (parents.includes(recipe.id)) throw new Error('Une recette ne peut pas se contenir, même indirectement.');
  if (recipe.portions <= 0 || !Number.isFinite(recipe.portions)) throw new Error('Le rendement doit être supérieur à zéro.');
  let material = 0, packaging = 0, labor = recipe.preparation_minutes / 60 * recipe.hourly_cost;
  const warnings: string[] = [];
  const lines = recipe.lines.map(line => {
    if (line.quantity <= 0 || line.loss_percent < 0 || line.loss_percent >= 100) throw new Error('Quantité ou perte technique invalide.');
    let cost = 0;
    const q = line.quantity / (1 - line.loss_percent / 100);
    if (line.type === 'recipe') {
      const child = state.recipes.find(r => r.id === line.target_id && !r.deleted_at);
      if (!child || line.unit !== 'portion') throw new Error('Sous-recette absente ou unité invalide.');
      const c = recipeCost(state, child, [...parents, recipe.id]);
      material += c.material / child.portions * q;
      packaging += c.packaging / child.portions * q;
      labor += c.labor / child.portions * q;
      cost = c.per_portion * q;
      warnings.push(...c.warnings);
    } else {
      const item = state.items.find(i => i.id === line.target_id && !i.deleted_at);
      if (!item || line.unit === 'portion') throw new Error('Ingrédient absent ou unité invalide.');
      const unitCost = itemCost(state, item.id);
      const quantity = convert(q, line.unit, item.unit);
      if (unitCost === null) warnings.push(`Prix de référence à choisir : ${item.name}`);
      cost = quantity * (unitCost ?? 0);
      if (item.kind === 'packaging') packaging += cost; else material += cost;
    }
    return { id: line.id, cost: round(cost) };
  });
  const total = material + packaging + labor;
  const per_portion = total / recipe.portions;
  const material_per_portion = material / recipe.portions;
  const suggested_ht = Math.max(per_portion, material_per_portion / (recipe.target_food_percent / 100));
  const rawTTC = suggested_ht * (1 + recipe.vat_percent / 100);
  const suggested_ttc = round(Math.ceil(round(rawTTC / recipe.rounding, 8)) * recipe.rounding, 2);
  const actualHT = recipe.sale_price_ttc / (1 + recipe.vat_percent / 100);
  return { material: round(material), packaging: round(packaging), labor: round(labor), total: round(total), per_portion: round(per_portion), material_per_portion: round(material_per_portion), suggested_ht: round(suggested_ttc / (1 + recipe.vat_percent / 100)), suggested_ttc, food_percent: actualHT > 0 ? material_per_portion / actualHT * 100 : null, margin: round(actualHT - per_portion), lines, warnings: [...new Set(warnings)] };
}
