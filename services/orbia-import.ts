import { validateWorkspace } from '../lib/domain/workspace';
import { readProductContext, productActive, OrbiaIntegrationError, type OrbiaConfig } from './orbia-context';

/** Dry-run only: no remote write and no change to the IndexedDB workshop. */
export async function prepareOrbiaImport(
  sourceJson: string, config: OrbiaConfig, organizationId: string, locationId: string,
  signal?: AbortSignal,
) {
  const bytes = new TextEncoder().encode(sourceJson);
  if (bytes.byteLength > 20 * 1024 * 1024) throw new Error('La sauvegarde dépasse 20 Mo.');
  let input: unknown;
  try { input = JSON.parse(sourceJson); }
  catch { throw new Error('La sauvegarde Milo doit être un fichier JSON valide.'); }
  const workspace = validateWorkspace(input);
  for (const rows of [workspace.snapshots, workspace.audit]) {
    if (new Set(rows.map(row => row.id)).size !== rows.length)
      throw new Error('Identifiants historiques en double dans la sauvegarde.');
  }
  if (workspace.snapshots.some(s => s.recipe.id !== s.recipe_id || !workspace.recipes.some(r => r.id === s.recipe_id)))
    throw new Error('Une fiche de coût historique ne correspond pas à sa recette.');
  const scope = await readProductContext(config, 'milo', organizationId, locationId, signal);
  if (!productActive(scope) || !['owner', 'admin', 'manager'].includes(scope.role))
    throw new OrbiaIntegrationError('permission', 'Un accès Milo actif avec droit de modification est nécessaire pour préparer cet import.');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sourceSha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  return {
    planVersion: 1 as const, sourceSha256,
    destination: { organizationId: scope.organization_id, locationId: scope.location_id },
    preparedForUserId: scope.user_id, sourceRevision: workspace.revision,
    counts: { suppliers: workspace.suppliers.length, items: workspace.items.length,
      references: workspace.references.length, recipes: workspace.recipes.length,
      snapshots: workspace.snapshots.length, legacyAudit: workspace.audit.length },
    workspace,
    // Local audit and costs are preserved as imported history, never asserted
    // to be authenticated server events or recomputed historical facts.
    historyOrigin: 'local-unverified' as const,
  };
}
