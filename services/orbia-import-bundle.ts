import { z } from 'zod';
import { prepareOrbiaImport } from './orbia-import';
import type { OrbiaConfig } from './orbia-context';

/** Reviewable row batches, NOT table names and NOT an executable import authorization. */
export async function prepareNormalizedImport(
  sourceJson: string, config: OrbiaConfig, organizationId: string, locationId: string,
  importId: string, signal?: AbortSignal,
) {
  z.string().uuid().parse(importId);
  const plan = await prepareOrbiaImport(sourceJson, config, organizationId, locationId, signal);
  const source = JSON.parse(sourceJson);
  // Do not silently strip unknown fields or trim historical names in a migration.
  function canonical(value: unknown): string {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value !== null && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => JSON.stringify(key) + ':' + canonical(v)).join(',') + '}';
    return JSON.stringify(value);
  }
  if (canonical(source) !== canonical(plan.workspace))
    throw new Error('La validation modifierait la sauvegarde. Corrigez ou archivez explicitement les champs incompatibles avant la reprise.');
  const attach = <T extends object>(record: T) => ({ ...record, organization_id: organizationId, location_id: locationId, import_id: importId });
  const { recipes, snapshots, audit, ...catalog } = plan.workspace;
  // UUID collisions across scopes must be resolved by the future server, never regenerated here.
  return {
    contract_version: 1 as const,
    import_id: importId,
    source_sha256: plan.sourceSha256,
    source_revision: plan.sourceRevision,
    destination: { organization_id: organizationId, location_id: locationId },
    prepared_for_user_id: plan.preparedForUserId,
    currency: 'EUR' as const,
    status: 'requires_catalog_agreement' as const,
    // Suppliers/items remain candidates until Nomi identity reconciliation is approved.
    suppliers: catalog.suppliers.map(attach),
    items: catalog.items.map(attach),
    supplier_references: catalog.references.map(attach),
    recipes: recipes.map(({ lines, ...recipe }) => { void lines; return attach(recipe); }),
    recipe_lines: recipes.flatMap(recipe => recipe.lines.map((line, position) => attach({ ...line, recipe_id: recipe.id, position }))),
    cost_snapshots: snapshots.map(snapshot => attach({ ...snapshot, origin: 'local-unverified' as const })),
    legacy_events: audit.map(event => attach({ ...event, origin: 'local-unverified' as const, authenticated_actor_id: null })),
  };
}
