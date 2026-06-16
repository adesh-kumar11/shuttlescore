// Pure game / tournament logic — no React, no Firebase

export const WIN_BY = 2, MAX_PTS = 21, DEUCE_CAP = 30;

// Returns "A", "B", or null (game not yet over)
export const gw = (a, b) =>
  ((a >= MAX_PTS || a === DEUCE_CAP) && a - b >= WIN_BY) ? "A"
  : ((b >= MAX_PTS || b === DEUCE_CAP) && b - a >= WIN_BY) ? "B"
  : null;

// Returns "A", "B", or null (match not yet over)
export const mw = (sets, n) =>
  sets.filter(s => s.winner === "A").length >= n ? "A"
  : sets.filter(s => s.winner === "B").length >= n ? "B"
  : null;

export const shuffle = a => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

export const mkMatch = (id, a, b) => ({
  id: `m${id}`, teamA: a, teamB: b,
  scoreA: null, scoreB: null, winner: null, status: "pending", isBye: false, setsDetail: ""
});

export const mkBye = (id, team) => ({
  id: `b${id}`, teamA: team, teamB: null,
  scoreA: null, scoreB: null, winner: team, status: "bye", isBye: true, setsDetail: ""
});

export function buildKnockout(teams) {
  const pow2 = Math.pow(2, Math.ceil(Math.log2(Math.max(teams.length, 2))));
  const seeded = [...shuffle(teams)];
  while (seeded.length < pow2) seeded.push(null);
  const r1 = [];
  for (let i = 0; i < seeded.length; i += 2) {
    const a = seeded[i], b = seeded[i + 1];
    r1.push(!b ? mkBye(i / 2, a) : mkMatch(i / 2, a, b));
  }
  const rounds = []; let cur = r1, ri = 0;
  while (cur.length >= 1) {
    const name = cur.length === 1 ? "🏆 Final" : cur.length === 2 ? "Semi-Finals" : cur.length === 4 ? "Quarter-Finals" : `Round of ${cur.length * 2}`;
    rounds.push({ name, matches: cur });
    if (cur.length === 1) break;
    const next = [];
    for (let i = 0; i < cur.length; i += 2) next.push(mkMatch(ri * 100 + i / 2, "TBD", "TBD"));
    cur = next; ri++;
  }
  return { type: "knockout", rounds };
}

export function buildRoundRobin(teams) {
  const t = [...teams]; if (t.length % 2) t.push(null);
  const rounds = [];
  for (let r = 0; r < t.length - 1; r++) {
    const matches = [];
    for (let i = 0; i < t.length / 2; i++) {
      const a = t[i], b = t[t.length - 1 - i];
      if (a && b) matches.push(mkMatch(r * 100 + i, a, b));
      else if (a || b) matches.push(mkBye(r * 100 + i, a || b));
    }
    rounds.push({ name: `Round ${r + 1}`, matches });
    t.splice(1, 0, t.pop());
  }
  return { type: "round-robin", rounds };
}

export function buildQualifier(teams, topN) {
  const groupSize = 4; const groups = [];
  for (let i = 0; i < teams.length; i += groupSize) groups.push(teams.slice(i, i + groupSize));
  const groupStages = groups.map((g, gi) => {
    const rr = buildRoundRobin(g);
    return { groupName: `Group ${String.fromCharCode(65 + gi)}`, rounds: rr.rounds };
  });
  const knockoutTeams = Array.from({ length: topN }, (_, i) => `Q${i + 1}`);
  const ko = buildKnockout(knockoutTeams);
  return { type: "qualifier", groups: groupStages, knockout: ko, topN, groupsDone: false };
}

export function propagateKnockout(rounds) {
  const r = rounds.map(rnd => ({ ...rnd, matches: [...rnd.matches.map(m => ({ ...m }))] }));
  for (let ri = 0; ri < r.length - 1; ri++) {
    const cur = r[ri].matches, next = r[ri + 1].matches;
    for (let mi = 0; mi < cur.length; mi += 2) {
      const m1 = cur[mi], m2 = cur[mi + 1] || { winner: null };
      const slot = next[Math.floor(mi / 2)];
      if (!slot) continue;
      const prevA = slot.teamA, prevB = slot.teamB;
      slot.teamA = m1.winner || "TBD";
      slot.teamB = m2.winner || "TBD";
      if (slot.teamA !== prevA || slot.teamB !== prevB) {
        slot.winner = null; slot.status = "pending";
        slot.scoreA = null; slot.scoreB = null; slot.setsDetail = "";
      }
    }
  }
  return r;
}

export function rrStandingsCalc(matches, teamNames) {
  const t = {}; teamNames.forEach(n => { t[n] = { w: 0, l: 0, d: 0, pts: 0, f: 0, a: 0, pd: 0 }; });
  matches.forEach(m => {
    if (m.status !== "done" || m.isBye) return;
    const a = parseInt(m.scoreA), b = parseInt(m.scoreB);
    if (isNaN(a) || isNaN(b)) return;
    if (t[m.teamA]) { t[m.teamA].f += a; t[m.teamA].a += b; t[m.teamA].pd += a - b; }
    if (t[m.teamB]) { t[m.teamB].f += b; t[m.teamB].a += a; t[m.teamB].pd += b - a; }
    if (a > b) { if (t[m.teamA]) { t[m.teamA].w++; t[m.teamA].pts += 3; } if (t[m.teamB]) t[m.teamB].l++; }
    else if (b > a) { if (t[m.teamB]) { t[m.teamB].w++; t[m.teamB].pts += 3; } if (t[m.teamA]) t[m.teamA].l++; }
    else { if (t[m.teamA]) { t[m.teamA].d++; t[m.teamA].pts++; } if (t[m.teamB]) { t[m.teamB].d++; t[m.teamB].pts++; } }
  });
  return Object.entries(t).sort((a, b) => b[1].pts - a[1].pts || b[1].pd - a[1].pd);
}

export function computeStats(history, players) {
  const pS = {}, tS = {};
  players.forEach(p => { pS[p] = { wins: 0, losses: 0, matches: 0, setsWon: 0, pointsWon: 0, pointsLost: 0 }; });
  history.forEach(m => {
    const kA = m.teamA.name, kB = m.teamB.name;
    if (!tS[kA]) tS[kA] = { wins: 0, losses: 0, setsWon: 0, pointsWon: 0, pointsLost: 0, players: m.teamA.players };
    if (!tS[kB]) tS[kB] = { wins: 0, losses: 0, setsWon: 0, pointsWon: 0, pointsLost: 0, players: m.teamB.players };
    const aw = m.winner === "A";
    if (aw) { tS[kA].wins++; tS[kB].losses++; } else { tS[kB].wins++; tS[kA].losses++; }
    m.sets.forEach(s => {
      tS[kA].setsWon += s.winner === "A" ? 1 : 0; tS[kA].pointsWon += s.scoreA; tS[kA].pointsLost += s.scoreB;
      tS[kB].setsWon += s.winner === "B" ? 1 : 0; tS[kB].pointsWon += s.scoreB; tS[kB].pointsLost += s.scoreA;
    });
    [...m.teamA.players, ...m.teamB.players].forEach(p => {
      if (!pS[p]) pS[p] = { wins: 0, losses: 0, matches: 0, setsWon: 0, pointsWon: 0, pointsLost: 0 }; pS[p].matches++;
    });
    [{ pl: m.teamA.players, won: aw }, { pl: m.teamB.players, won: !aw }].forEach(({ pl, won }) =>
      pl.forEach(p => { if (!pS[p]) pS[p] = { wins: 0, losses: 0, matches: 0, setsWon: 0, pointsWon: 0, pointsLost: 0 }; if (won) pS[p].wins++; else pS[p].losses++; })
    );
  });
  return { pS, tS };
}
