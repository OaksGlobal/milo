# Milo remote persistence v1 — proposed contract, 22 September 2026

Status: implementation preparation, not an installed API. The client adapter is tested with synthetic HTTP responses. No SQL migration, table, RPC, import or remote UI activation is included. Do not point production UI at this adapter until backend conformance and real Auth tests pass.

## Existing foundation

Use project `stfekzodfzovprsfblkl`, product `milo`. Read current identity through Supabase Auth and current permissions through `public.orbia_product_context('milo')`. Helly subscription is never a prerequisite. The physical FK target is `public.shops(id, organization_id)`, not `public.locations`, which is a security-invoker view. No identity, organization or establishment is created by a catalog operation.

`services/orbia-remote-repository.ts` intentionally does not implement the local whole-workspace `save` method. It prepares entity commands, rather than persisting a workspace JSON blob. `load` may return an assembled workspace projection to reuse existing calculations; physical data must be normalized.

## Proposed RPC contract

All parameters and response keys use snake_case. Authenticated user JWT plus publishable key only. Backend must independently authorize every request; the client context check is usability/defense in depth, not an authorization boundary.

| RPC (not installed) | Parameters | Response |
| --- | --- | --- |
| `milo_catalog_read` | `target_organization`, `target_location` UUID | `{contract_version:1, organization_id, location_id, revision, workspace}` assembled in one consistent DB snapshot |
| `milo_catalog_mutate` | Same scope, `expected_revision`, `request_id` UUID, `command:{collection,record}` | `{contract_version:1, organization_id, location_id, revision, request_id, replayed}` |

Collections: suppliers, items, references, recipes. Recipe mutation includes its ordered lines and must be atomic. An archive is a soft-delete mutation, never physical deletion. Cost snapshots and legacy audit are not writable through these commands. Server timestamps and actor are authoritative; client timestamps cannot impersonate server audit.

Initial conservative financial policy: only owner/admin/manager can read the complete catalog projection or mutate it. Expired commercial access may read/export while membership/product-user/location rights remain; mutation additionally requires active commercial Milo access. Employee/viewer/accountant access to a redacted projection requires a separate future contract. This is a proposal to validate, not a claim that current foundation roles already provide granular financial permissions.

### Mandatory backend algorithm

1. Authenticate, derive actor from `auth.uid()`, resolve current exact Milo scope. No caller-provided actor or prepared-plan authority. Reject missing/revoked rights before even returning an old idempotency receipt.
2. Verify organization/location consistency, RLS and action-level rights. Serialize writes for the affected catalog revision. Check active commercial rights for mutation, including retries.
3. Resolve idempotency by `(organization_id, location_id, actor_id, request_id)`, compare a server-calculated canonical command digest. Same key and different content is a 409. Same key and same content returns the original receipt without another write or audit. The receipt must retain the original resulting revision, even after later mutations.
4. Compare expected revision; mismatch is 409, never last-write-wins. If records are shared with several locations, authorize mutation across every affected scope or use a location-specific override. A manager at one location must never silently modify another location's recipe or price.
5. Validate normalized records and relationships server-side: same organization, authorized visibility, active references, unit dimension compatibility, nonnegative prices, recipe cycles and ordered line identities. Protect history and existing archived relationships. Client Zod checks cannot replace these constraints.
6. Persist entities/lines, increment revision, insert an authenticated server audit event and idempotency receipt in the same transaction. Any failure rolls back all writes. Immutable cost snapshots use separate explicit operations and retain source price/method/time.
7. Return the exact scoped receipt. Never put SQL errors, credentials or customer data in transport error messages.

The client obtains session configuration anew for each operation, checks response scope/revision, and has no IndexedDB fallback. Network/abort/5xx during mutation has an **unknown commit outcome**. No automatic retry with a fresh UUID: retain the original command, expected revision and request ID until its outcome is resolved. A 404 means the backend is absent, not an empty catalog. The future UI must persist a pending-command outbox per authenticated scope before sending, and require resolution before accepting conflicting edits; this UI/outbox is not implemented in this change.

## Normalized import preparation

`prepareNormalizedImport` builds reviewable row batches from an exported JSON backup. It reuses the Auth/product checks and 20 MiB bound of `prepareOrbiaImport`, preserves UUIDs, archived entities, ordered recipe lines, frozen cost snapshots and original local audit. It refuses unknown fields or validation transformations that would otherwise silently strip/trim source data. Raw source SHA-256 and source revision remain distinct from the eventual server revision.

Batch names are logical collections, **not finalized physical tables**. Supplier/article rows are candidates marked `requires_catalog_agreement`. Organization/location annotate the import provenance; they do not decide the final shared catalog ownership. No batch upload or server import is implemented. Source IndexedDB is untouched.

A future import transaction must:

- Revalidate the original source and its hash server-side; distrust prepared_for_user_id, counts, scope and mappings from the client.
- Use a unique scoped import ID and source digest, independent of normal mutation IDs. Repeating the same committed import returns its receipt; conflicting content or destination is rejected.
- Require an explicit destination and catalog reconciliation preview. Block UUID collisions with differing data. Never generate replacement UUIDs silently or merge on names, email, supplier SKU alone.
- Insert in dependency order: approved shared catalog links, references, recipe headers, lines, snapshots, legacy events. Check cycles and all FK scopes before commit. Preserve archived relationships even where current active references differ.
- Mark imported audit/snapshots as `local-unverified`; original local events have no authenticated actor. Add a separate server import event derived from the logged-in user. Preserve before/after payloads and historical costs without recomputation.
- Record counts/digests and a immutable receipt. No incremental partial import in V1; if 20 MiB exceeds transaction limits, design staged private uploads and atomic promotion before raising the limit.

## Migration and rollout gates

1. Agree the shared catalog contract in `NOMI_CATALOG_PROPOSAL.md` and the financial/read-expiration policy. No shared-schema DDL before coordination.
2. Inspect latest live constraints and migration ledger again. Generate versioned additive migrations with the Supabase CLI after agreement; do not replay old repository histories or use blanket `db push`.
3. Prepare shared catalog identities/explicit links, then Milo recipes/lines, cost snapshots, legacy events, server audit, revisions and idempotency receipts. Use UUID keys and composite organization constraints. Enable RLS and least-privilege grants on every exposed table; deny direct mutation of audit/receipts/snapshots. Shared data should expose only explicitly allowed projections to Nomi/Pulp.
4. Rehearse on a disposable compatible database: server authorization, atomicity, concurrency, constraints, idempotency and rollback. Review any SECURITY DEFINER helper and revoke default PUBLIC execution. HTTP tests must also attempt direct table access to prevent RPC bypass.
5. Before an approved deployment, back up hosted database and private Storage plus a verified restoration rehearsal. Export each local workspace separately, record checksums and keep the original JSON/IndexedDB; local sources are not centrally discoverable.
6. Apply only reviewed additive migrations, recording their actual hosted version/checksum mapping. No operation in this proposal renames/drops shops or changes foundation roles.
7. Implement common Auth/session refresh, scoped UI and pending command recovery; import a selected pilot with explicit mappings. Validate remote read-after-write, counts, UUIDs, archived data, costs and historical payloads against the source.
8. Only then switch that workspace to remote mode. Prevent concurrent edits in the old local copy after cutover. Never silently union local and remote data.

Rollback: disable remote writes and retain database data plus receipts for diagnosis; revert application configuration/code to the previous verified version. The old local copy is only safe if no remote-only writes occurred. Otherwise export the remote state and reconcile before resuming local edits. Dropping tables, clearing IndexedDB, overwriting an existing catalog or deleting imports after subsequent edits are destructive operations and are not part of this plan.

## Required backend/real-session tests before activation

Cross-organization and cross-location IDs; missing Milo while Helly active; Milo active without Helly; revoked membership with existing JWT; expiration during an open screen; direct-table bypass; unauthorized financial roles; invalid foreign refs; archived references; recipe cycles; incompatible dimensions; duplicate request with same/different payload; simultaneous create/update/archive; response lost after commit; stale revision; audit actor tampering; snapshot immutability; empty and archived-only imports; collisions across scopes; import repeat/failure rollback; restored backup equivalence; no secrets/client logs; UI account switch without previous account data. None of these database-level assertions is established by client mock tests.
