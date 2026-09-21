import { z } from "zod";

const uuid = z.string().uuid();
const roleSchema = z.enum(["owner", "admin", "manager", "employee", "accountant", "viewer"]);
const contextSchema = z.object({
  organization_id: uuid, organization_name: z.string(),
  location_id: uuid, location_name: z.string(), timezone: z.string(),
  role: roleSchema, product_active: z.boolean(),
  expires_at: z.string().datetime({ offset: true }).nullable(),
  can_manage_billing: z.boolean(),
});
export type ProductContext = z.infer<typeof contextSchema> & { user_id: string };
export type OrbiaConfig = {
  url: string; publishableKey: string; accessToken: string;
  fetcher?: typeof fetch;
};
export class OrbiaIntegrationError extends Error {
  constructor(public code: "configuration" | "authentication" | "permission" | "schema" | "network", message: string) {
    super(message); this.name = "OrbiaIntegrationError";
  }
}
export function parseOrbia<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new OrbiaIntegrationError("schema", "Le format de la réponse Orbia est incompatible.");
  return parsed.data;
}
export function orbiaReader(config: OrbiaConfig, signal?: AbortSignal) {
  let url: URL;
  try { url = new URL(config.url); }
  catch { throw new OrbiaIntegrationError("configuration", "Adresse du projet Orbia invalide."); }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" ||
      url.search || url.hash || !config.publishableKey.startsWith("sb_publishable_") || !config.accessToken)
    throw new OrbiaIntegrationError("configuration", "Une clé publiable et une session utilisateur Orbia sont nécessaires.");
  return async (path: string, params?: Record<string, string>): Promise<unknown> => {
    const target = new URL(path, url.origin);
    if (target.origin !== url.origin) throw new OrbiaIntegrationError("configuration", "Origine Orbia incohérente.");
    if (params) target.search = new URLSearchParams(params).toString();
    let response: Response;
    try {
      response = await (config.fetcher ?? fetch)(target.href, {
        method: "GET", headers: { apikey: config.publishableKey, Authorization: `Bearer ${config.accessToken}` },
        cache: "no-store", redirect: "error", signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new OrbiaIntegrationError("network", "Connexion à Orbia indisponible. Réessayez.");
    }
    if (response.status === 401) throw new OrbiaIntegrationError("authentication", "Session Orbia expirée.");
    if (response.status === 403) throw new OrbiaIntegrationError("permission", "Accès Orbia refusé.");
    if (!response.ok) throw new OrbiaIntegrationError("schema", "Le socle Orbia attendu n’est pas disponible.");
    try { return await response.json(); }
    catch { throw new OrbiaIntegrationError("schema", "Réponse Orbia invalide."); }
  };
}
/** Authentication and current permissions are rechecked on every call. */
export async function readProductContext(
  config: OrbiaConfig, product: "milo" | "cento",
  organizationId: string, locationId: string, signal?: AbortSignal,
): Promise<ProductContext> {
  uuid.parse(organizationId); uuid.parse(locationId);
  const request = orbiaReader(config, signal);
  const user = parseOrbia(z.object({ id: uuid }), await request("/auth/v1/user"));
  const rows = parseOrbia(z.array(contextSchema), await request("/rest/v1/rpc/orbia_product_context", {
    target_product: product, organization_id: `eq.${organizationId}`,
    location_id: `eq.${locationId}`, limit: "2",
  }));
  if (rows.length !== 1 || rows[0].organization_id !== organizationId ||
      rows[0].location_id !== locationId || rows[0].role === "employee")
    throw new OrbiaIntegrationError("permission", "Cet établissement n’est pas accessible dans cette application.");
  return { ...rows[0], user_id: user.id };
}
export function productActive(context: ProductContext, now = Date.now()): boolean {
  return context.product_active && (context.expires_at === null || Date.parse(context.expires_at) > now);
}

