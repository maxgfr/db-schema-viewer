/** Past "Challenge My Schema" scores of one diagram, in localStorage (a few small entries each). */
export interface ChallengeHistoryEntry {
  score: number;
  issueCount: number;
  timestamp: string;
  schemaName: string;
}

const PREFIX = "db-schema-viewer-challenge-history:";
/** Entries kept per diagram. */
const LIMIT = 20;

export function loadChallengeHistory(diagramId: string): ChallengeHistoryEntry[] {
  try {
    const raw = localStorage.getItem(`${PREFIX}${diagramId}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChallengeHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveChallengeEntry(diagramId: string, entry: ChallengeHistoryEntry): void {
  const history = [...loadChallengeHistory(diagramId), entry].slice(-LIMIT);
  try { localStorage.setItem(`${PREFIX}${diagramId}`, JSON.stringify(history)); } catch { /* full: kept for this view */ }
}

/** Forgets the history of a deleted diagram. */
export function deleteChallengeHistory(diagramId: string): void {
  try { localStorage.removeItem(`${PREFIX}${diagramId}`); } catch { /* blocked: nothing to remove */ }
}

/** Removes the history of every diagram that is no longer stored (deleted before this cleanup existed). */
export function pruneChallengeHistory(diagramIds: ReadonlySet<string>): void {
  try {
    const orphans: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX) && !diagramIds.has(key.slice(PREFIX.length))) orphans.push(key);
    }
    for (const key of orphans) localStorage.removeItem(key);
  } catch {
    // Blocked: tried again on the next start.
  }
}
