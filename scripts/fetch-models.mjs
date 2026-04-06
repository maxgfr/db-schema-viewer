#!/usr/bin/env node
import { writeFile } from 'fs/promises';

const REMOTE_CATALOG_URL = 'https://models.dev/api.json';
const OUT_PATH = new URL('../public/models.json', import.meta.url).pathname;

async function main() {
  try {
    console.log('[fetch-models] Fetching', REMOTE_CATALOG_URL);
    const resp = await fetch(REMOTE_CATALOG_URL, { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!resp.ok) throw new Error(`Remote returned ${resp.status} ${resp.statusText}`);

    const json = await resp.json();
    await writeFile(OUT_PATH, JSON.stringify(json), 'utf8');

    console.log('[fetch-models] Wrote', OUT_PATH);
  } catch (err) {
    console.error('[fetch-models] Error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
