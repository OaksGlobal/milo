import { z } from 'zod';
import { supplierSchema, itemSchema, referenceSchema, recipeSchema, validateWorkspace } from '../lib/domain/workspace';
import { readProductContext, productActive, orbiaReader, OrbiaIntegrationError, type OrbiaConfig } from './orbia-context';

const uuid = z.string().uuid();
const version = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const mutationSchema = z.discriminatedUnion('collection', [
  z.object({ collection: z.literal('suppliers'), record: supplierSchema }),
  z.object({ collection: z.literal('items'), record: itemSchema }),
  z.object({ collection: z.literal('references'), record: referenceSchema }),
  z.object({ collection: z.literal('recipes'), record: recipeSchema }),
]);
export type CatalogMutation = z.infer<typeof mutationSchema>;
export type RemoteScope = { organization_id: string; location_id: string };
export class RemotePersistenceError extends Error {
  constructor(public code: 'conflict' | 'unavailable' | 'uncertain' | 'invalid', message: string) {
    super(message); this.name = 'RemotePersistenceError';
  }
}
const envelope = z.object({ contract_version: z.literal(1), organization_id: uuid, location_id: uuid, revision: version });
const receipt = envelope.extend({ request_id: uuid, replayed: z.boolean() });
export type MutationReceipt = z.infer<typeof receipt>;

/** Prepared client contract only. No deployed Milo RPC is assumed, no local fallback. */
export function createRemoteCatalogRepository(
  getConfig: () => Promise<OrbiaConfig>, destination: RemoteScope,
) {
  const scope = z.object({ organization_id: uuid, location_id: uuid }).parse(destination);
  function checkScope(value: RemoteScope) {
    if (value.organization_id !== scope.organization_id || value.location_id !== scope.location_id)
      throw new OrbiaIntegrationError('schema', 'Réponse reçue pour un autre périmètre.');
  }
  async function authorize(write: boolean, signal?: AbortSignal) {
    const config = await getConfig(); // Do not retain a stale access token between operations.
    const context = await readProductContext(config, 'milo', scope.organization_id, scope.location_id, signal);
    // Whole catalog includes costs. Until granular financial permissions exist, fail closed.
    if (!['owner', 'admin', 'manager'].includes(context.role) || (write && !productActive(context)))
      throw new OrbiaIntegrationError('permission', 'Droits Milo insuffisants pour cette opération.');
    return config;
  }
  async function post(config: OrbiaConfig, rpc: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
    // Same validation as the authenticated context reader; never accept service credentials.
    orbiaReader(config, signal);
    let response: Response;
    try {
      response = await (config.fetcher ?? fetch)(new URL(`/rest/v1/rpc/${rpc}`, config.url).href, {
        method: 'POST', headers: { apikey: config.publishableKey, Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), cache: 'no-store', redirect: 'error', signal,
      });
    } catch {
      // A timeout/abort may occur after commit. Retry only the SAME request, never generate a new key.
      throw new RemotePersistenceError('uncertain', 'Résultat inconnu. Réessayez la même opération avec le même identifiant.');
    }
    if (response.status === 401) throw new OrbiaIntegrationError('authentication', 'Session Orbia expirée.');
    if (response.status === 403) throw new OrbiaIntegrationError('permission', 'Accès Milo refusé.');
    if (response.status === 409) throw new RemotePersistenceError('conflict', 'Les données ont changé ou cet identifiant désigne une autre opération. Rechargez avant de poursuivre.');
    if (response.status === 404) throw new RemotePersistenceError('unavailable', 'La persistance Milo n’est pas encore installée sur ce projet.');
    if (response.status >= 500) throw new RemotePersistenceError('uncertain', 'Résultat inconnu. Conservez l’identifiant de cette opération pour la reprise.');
    if (!response.ok) throw new RemotePersistenceError('invalid', 'Opération refusée par le serveur Milo.');
    try { return await response.json(); }
    catch { throw new RemotePersistenceError('uncertain', 'Réponse illisible. Vérifiez le résultat avec le même identifiant d’opération.'); }
  }
  return {
    async load(signal?: AbortSignal) {
      const config = await authorize(false, signal);
      const raw = await post(config, 'milo_catalog_read', { target_organization: scope.organization_id, target_location: scope.location_id }, signal);
      const result = envelope.extend({ workspace: z.unknown() }).parse(raw);
      checkScope(result);
      const workspace = validateWorkspace(result.workspace);
      if (workspace.revision !== result.revision) throw new OrbiaIntegrationError('schema', 'Révisions incohérentes.');
      return workspace;
    },
    async saveRecord(mutation: CatalogMutation, expectedRevision: number, requestId: string, signal?: AbortSignal): Promise<MutationReceipt> {
      const command = mutationSchema.parse(mutation);
      version.parse(expectedRevision); uuid.parse(requestId);
      const config = await authorize(true, signal);
      const raw = await post(config, 'milo_catalog_mutate', {
        target_organization: scope.organization_id, target_location: scope.location_id,
        expected_revision: expectedRevision, request_id: requestId, command,
      }, signal);
      const result = receipt.parse(raw); checkScope(result);
      if (result.request_id !== requestId || result.revision !== expectedRevision + 1)
        throw new RemotePersistenceError('uncertain', 'Accusé de réception incohérent. Vérifiez la même opération avant de poursuivre.');
      return result;
    },
  };
}
