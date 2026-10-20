// Extension: online leaderboard (/api/leaderboard) with a local fallback when no server is reachable.
export interface ScoreEntry {
  id?: string;
  pilot: string;
  score: number;
  tricks: number;
  best: string;
  maxCombo: number;
  craft: string;
  duration: number;
  createdAt?: string;
}

const LOCAL_KEY = 'bba.leaderboard.local';

function readLocal(): ScoreEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeLocal(list: ScoreEntry[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 100)));
  } catch {
    /* ignore */
  }
}

export async function fetchLeaderboard(): Promise<{ entries: ScoreEntry[]; online: boolean }> {
  try {
    const res = await fetch('/api/leaderboard?limit=50', { headers: { Accept: 'application/json' } });
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) throw new Error();
    const data = await res.json();
    return { entries: data.entries ?? [], online: true };
  } catch {
    return { entries: readLocal(), online: false };
  }
}

export async function submitScore(entry: ScoreEntry): Promise<{ rank: number; online: boolean }> {
  try {
    const res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) throw new Error();
    const data = await res.json();
    return { rank: data.rank, online: true };
  } catch {
    const list = readLocal();
    const local = { ...entry, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    list.push(local);
    list.sort((a, b) => b.score - a.score);
    writeLocal(list);
    return { rank: list.findIndex((e) => e.id === local.id) + 1, online: false };
  }
}
