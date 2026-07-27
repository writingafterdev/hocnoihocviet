/**
 * Read-only Appwrite inspector.
 *
 * Prints the shape of every database, collection, attribute, and index, plus
 * document counts and (optionally) redacted sample documents. It never writes.
 *
 * Uses the REST API through global `fetch` rather than node-appwrite, for two
 * reasons: the SDK installs its own HTTP agent that ignores HTTPS_PROXY (which
 * breaks it inside proxied sandboxes), and it lists only legacy `database`-type
 * databases — an Appwrite 1.8 `tablesdb` database returns an empty list from
 * `GET /databases` and must be discovered via `GET /tablesdb`.
 *
 * Usage:
 *   npx tsx scripts/inspect-appwrite.ts                     # schema + counts
 *   npx tsx scripts/inspect-appwrite.ts --samples 2         # + 2 sample docs per collection
 *   npx tsx scripts/inspect-appwrite.ts --collection writing_assessments --samples 5
 *   npx tsx scripts/inspect-appwrite.ts --out tmp/appwrite-schema.json
 *
 * Behind an egress proxy, run with NODE_USE_ENV_PROXY=1 so fetch honours HTTPS_PROXY.
 *
 * Reads APPWRITE_ENDPOINT (or NEXT_PUBLIC_APPWRITE_ENDPOINT),
 * NEXT_PUBLIC_APPWRITE_PROJECT_ID, and APPWRITE_API_KEY from .env.local / .env.
 * The API key is never printed.
 */
import { config } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const SAMPLES = Number(argValue('--samples') || 0);
const ONLY_COLLECTION = argValue('--collection');
const OUT_PATH = argValue('--out');
const MAX_FIELD_CHARS = Number(argValue('--max-field-chars') || 400);

const ENDPOINT = (process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '').replace(/\/$/, '');
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
  console.error(
    'Missing credentials. Set NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID, '
    + 'and APPWRITE_API_KEY in .env.local.',
  );
  process.exit(1);
}

const headers = { 'X-Appwrite-Project': PROJECT_ID, 'X-Appwrite-Key': API_KEY };

async function api<T>(routePath: string): Promise<T> {
  const response = await fetch(`${ENDPOINT}${routePath}`, { headers });
  if (!response.ok) throw new Error(`${response.status} ${routePath}: ${(await response.text()).slice(0, 200)}`);
  return response.json() as Promise<T>;
}

interface AppwriteDatabase { $id: string; name: string; type?: string }
interface AppwriteAttribute { key: string; type: string; size?: number; required?: boolean; array?: boolean; default?: unknown }
interface AppwriteIndex { key: string; type: string; attributes: string[] }
interface AppwriteCollection {
  $id: string;
  name: string;
  $permissions: string[];
  documentSecurity?: boolean;
  rowSecurity?: boolean;
  attributes?: AppwriteAttribute[];
  columns?: AppwriteAttribute[];
  indexes?: AppwriteIndex[];
}

/** Truncate long strings so essays and analysis_json blobs stay readable. */
function preview(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.length > MAX_FIELD_CHARS
      ? `${value.slice(0, MAX_FIELD_CHARS)}… [${value.length} chars total]`
      : value;
  }
  if (Array.isArray(value)) {
    return value.length > 5
      ? [...value.slice(0, 5).map(preview), `… ${value.length - 5} more`]
      : value.map(preview);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, preview(item)]));
  }
  return value;
}

/** Appwrite 1.9 expects each query as a JSON-encoded {method, values} object. */
function limitQuery(limit: number) {
  return `queries[]=${encodeURIComponent(JSON.stringify({ method: 'limit', values: [limit] }))}`;
}

async function listDocuments(databaseId: string, collectionId: string, limit: number) {
  return api<{ total: number; documents: Record<string, unknown>[] }>(
    `/databases/${databaseId}/collections/${collectionId}/documents?${limitQuery(limit)}`,
  );
}

/** Legacy `database` and 1.8 `tablesdb` types live behind different list routes. */
async function listDatabases(): Promise<AppwriteDatabase[]> {
  const seen = new Map<string, AppwriteDatabase>();
  for (const route of ['/databases', '/tablesdb']) {
    try {
      const page = await api<{ databases: AppwriteDatabase[] }>(route);
      for (const database of page.databases) seen.set(database.$id, database);
    } catch {
      // A deployment may not expose both routes; the other one still answers.
    }
  }
  return [...seen.values()];
}

async function main() {
  const report: Record<string, unknown> = { endpoint: ENDPOINT, projectId: PROJECT_ID, databases: [] };
  const databases = await listDatabases();
  console.log(`Project ${PROJECT_ID} @ ${ENDPOINT}`);
  console.log(`${databases.length} database(s)\n`);

  for (const database of databases) {
    console.log(`━━ database: ${database.name}  (id: ${database.$id}, type: ${database.type || 'database'})`);
    const { collections } = await api<{ collections: AppwriteCollection[] }>(
      `/databases/${database.$id}/collections?${limitQuery(100)}`,
    );
    const databaseReport: Record<string, unknown> = { id: database.$id, name: database.name, collections: [] };

    for (const collection of collections) {
      if (ONLY_COLLECTION && collection.$id !== ONLY_COLLECTION && collection.name !== ONLY_COLLECTION) continue;

      let total: number | string;
      try {
        total = (await listDocuments(database.$id, collection.$id, 1)).total;
      } catch (error) {
        total = `unreadable (${error instanceof Error ? error.message : String(error)})`;
      }

      const attributes = (collection.attributes || collection.columns || []).map(attribute => ({
        key: attribute.key,
        type: attribute.type,
        size: attribute.size,
        required: attribute.required,
        array: attribute.array,
        default: attribute.default,
      }));
      const indexes = (collection.indexes || []).map(index => ({
        key: index.key,
        type: index.type,
        attributes: index.attributes,
      }));

      console.log(`\n  ▸ ${collection.name}  (id: ${collection.$id})  documents: ${total}`);
      console.log(`    security: ${collection.documentSecurity ?? collection.rowSecurity}  permissions: ${JSON.stringify(collection.$permissions)}`);
      for (const attribute of attributes) {
        const flags = [attribute.required ? 'required' : 'optional', attribute.array ? 'array' : ''].filter(Boolean);
        console.log(`      · ${attribute.key.padEnd(30)} ${attribute.type.padEnd(8)} ${flags.join(' ')}`);
      }
      if (indexes.length) {
        console.log(`      indexes: ${indexes.map(index => `${index.key}(${index.attributes.join(',')})`).join(', ')}`);
      }

      const collectionReport: Record<string, unknown> = {
        id: collection.$id,
        name: collection.name,
        security: collection.documentSecurity ?? collection.rowSecurity,
        permissions: collection.$permissions,
        total,
        attributes,
        indexes,
      };

      if (SAMPLES > 0) {
        try {
          const { documents } = await listDocuments(database.$id, collection.$id, SAMPLES);
          const samples = documents.map(preview);
          collectionReport.samples = samples;
          console.log(`      samples:\n${JSON.stringify(samples, null, 2).split('\n').map(line => `        ${line}`).join('\n')}`);
        } catch (error) {
          collectionReport.samples = [{ error: error instanceof Error ? error.message : String(error) }];
        }
      }

      (databaseReport.collections as unknown[]).push(collectionReport);
    }

    (report.databases as unknown[]).push(databaseReport);
    console.log('');
  }

  if (OUT_PATH) {
    const resolved = path.resolve(OUT_PATH);
    await mkdir(path.dirname(resolved), { recursive: true });
    await writeFile(resolved, JSON.stringify(report, null, 2), 'utf8');
    console.log(`Wrote ${resolved}`);
  }
}

main().catch(error => {
  console.error('Inspection failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
