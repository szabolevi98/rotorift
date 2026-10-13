// Server-authored results; departed pilots remain in the run's participant list.
export function buildResults(players, kind = 'race', final = false) {
  const rows = [...players].map(p => ({
    id: p.id, name: p.name, color: p.color, mode: p.mode,
    completed: p.lap?.completed ?? 0, bestMs: p.lap?.bestMs ?? null,
    finishMs: p.finishMs ?? null, finished: !!p.finished,
    status: p.finished ? 'finished' : p.abandoned || final ? 'dnf' : p.connected === false ? 'reconnecting' : 'racing',
  }));
  rows.sort((a,b) => Number(b.finished)-Number(a.finished)
    || (a.finished && b.finished ? (kind === 'hotlap' ? a.bestMs-b.bestMs : a.finishMs-b.finishMs) : 0)
    || b.completed-a.completed || (a.bestMs ?? Infinity)-(b.bestMs ?? Infinity)
    || String(a.id).localeCompare(String(b.id)));
  let place = 0;
  return rows.map(row => ({ ...row, place: row.finished ? ++place : null }));
}
