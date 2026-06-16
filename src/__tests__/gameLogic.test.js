import {
  gw, mw,
  buildKnockout, buildRoundRobin,
  propagateKnockout, rrStandingsCalc,
} from "../gameLogic";

// ── gw (game winner) ──────────────────────────────────────────────────────────

describe("gw – game winner", () => {
  test("no winner when both scores are low", () => {
    expect(gw(10, 8)).toBeNull();
    expect(gw(0, 0)).toBeNull();
  });

  test("A wins at 21 with 2-point lead", () => {
    expect(gw(21, 19)).toBe("A");
    expect(gw(21, 18)).toBe("A");
  });

  test("B wins at 21 with 2-point lead", () => {
    expect(gw(19, 21)).toBe("B");
  });

  test("no winner at deuce (20-20)", () => {
    expect(gw(20, 20)).toBeNull();
  });

  test("A wins deuce at 22-20", () => {
    expect(gw(22, 20)).toBe("A");
  });

  test("no winner at 22-21 (not 2-point lead yet)", () => {
    expect(gw(22, 21)).toBeNull();
  });

  test("no winner at 29-29 (deuce — 2-point lead still required)", () => {
    expect(gw(29, 29)).toBeNull();
  });

  test("A wins at deuce with 2-point lead (30-28)", () => {
    expect(gw(30, 28)).toBe("A");
  });

  test("B wins at deuce with 2-point lead (28-30)", () => {
    expect(gw(28, 30)).toBe("B");
  });

  test("no winner at 30-29 — 2-point lead still required even at cap", () => {
    expect(gw(30, 29)).toBeNull();
  });
});

// ── mw (match winner) ─────────────────────────────────────────────────────────

describe("mw – match winner", () => {
  const setA = { winner: "A", scoreA: 21, scoreB: 15 };
  const setB = { winner: "B", scoreA: 15, scoreB: 21 };

  test("no winner with no sets played", () => {
    expect(mw([], 2)).toBeNull();
  });

  test("A wins best-of-3 after 2 sets", () => {
    expect(mw([setA, setA], 2)).toBe("A");
  });

  test("no winner at 1-1 in best-of-3", () => {
    expect(mw([setA, setB], 2)).toBeNull();
  });

  test("B wins best-of-3 after 2 sets", () => {
    expect(mw([setB, setB], 2)).toBe("B");
  });

  test("A wins best-of-5 after 3 sets", () => {
    expect(mw([setA, setA, setA], 3)).toBe("A");
  });

  test("no winner at 2-1 in best-of-5", () => {
    expect(mw([setA, setA, setB], 3)).toBeNull();
  });

  test("single-set match: A wins after 1 set", () => {
    expect(mw([setA], 1)).toBe("A");
  });
});

// ── buildKnockout ─────────────────────────────────────────────────────────────

describe("buildKnockout", () => {
  test("2 teams → 1 round (Final) with 1 match", () => {
    const { type, rounds } = buildKnockout(["A", "B"]);
    expect(type).toBe("knockout");
    expect(rounds).toHaveLength(1);
    expect(rounds[0].name).toBe("🏆 Final");
    expect(rounds[0].matches).toHaveLength(1);
  });

  test("4 teams → 2 rounds (Semi-Finals → Final)", () => {
    const { rounds } = buildKnockout(["A", "B", "C", "D"]);
    expect(rounds).toHaveLength(2);
    expect(rounds[0].name).toBe("Semi-Finals");
    expect(rounds[0].matches).toHaveLength(2);
    expect(rounds[1].name).toBe("🏆 Final");
    expect(rounds[1].matches).toHaveLength(1);
  });

  test("3 teams → 2 rounds with one bye in round 1", () => {
    const { rounds } = buildKnockout(["A", "B", "C"]);
    const r1matches = rounds[0].matches;
    const byeCount = r1matches.filter(m => m.isBye).length;
    expect(byeCount).toBe(1);
  });

  test("all R1 matches have both teams listed (non-bye)", () => {
    const { rounds } = buildKnockout(["A", "B", "C", "D"]);
    rounds[0].matches.forEach(m => {
      if (!m.isBye) {
        expect(m.teamA).toBeTruthy();
        expect(m.teamB).toBeTruthy();
      }
    });
  });
});

// ── buildRoundRobin ───────────────────────────────────────────────────────────

describe("buildRoundRobin", () => {
  test("4 teams → 3 rounds", () => {
    const { type, rounds } = buildRoundRobin(["A", "B", "C", "D"]);
    expect(type).toBe("round-robin");
    expect(rounds).toHaveLength(3);
  });

  test("each team plays every other team exactly once", () => {
    const teams = ["A", "B", "C", "D"];
    const { rounds } = buildRoundRobin(teams);
    const pairs = {};
    rounds.forEach(r =>
      r.matches.forEach(m => {
        if (m.isBye) return;
        const key = [m.teamA, m.teamB].sort().join("|");
        pairs[key] = (pairs[key] || 0) + 1;
      })
    );
    const expected = teams.flatMap((a, i) => teams.slice(i + 1).map(b => [a, b].sort().join("|")));
    expected.forEach(k => expect(pairs[k]).toBe(1));
  });

  test("odd number of teams adds a bye", () => {
    const { rounds } = buildRoundRobin(["A", "B", "C"]);
    const byes = rounds.flatMap(r => r.matches.filter(m => m.isBye));
    expect(byes.length).toBeGreaterThan(0);
  });
});

// ── propagateKnockout ─────────────────────────────────────────────────────────

describe("propagateKnockout", () => {
  const makeRounds = () => [
    {
      name: "Semi-Finals",
      matches: [
        { id: "m0", teamA: "Alpha", teamB: "Beta",  winner: null, status: "pending" },
        { id: "m1", teamA: "Gamma", teamB: "Delta", winner: null, status: "pending" },
      ],
    },
    {
      name: "🏆 Final",
      matches: [
        { id: "m2", teamA: "TBD", teamB: "TBD", winner: null, status: "pending" },
      ],
    },
  ];

  test("winners propagate to next round slots", () => {
    const rounds = makeRounds();
    rounds[0].matches[0].winner = "Alpha";
    rounds[0].matches[1].winner = "Gamma";
    const result = propagateKnockout(rounds);
    expect(result[1].matches[0].teamA).toBe("Alpha");
    expect(result[1].matches[0].teamB).toBe("Gamma");
  });

  test("TBD shown when a match is not yet finished", () => {
    const rounds = makeRounds();
    rounds[0].matches[0].winner = "Alpha";
    // m1 not finished yet
    const result = propagateKnockout(rounds);
    expect(result[1].matches[0].teamA).toBe("Alpha");
    expect(result[1].matches[0].teamB).toBe("TBD");
  });

  test("next-round match is reset when teams change", () => {
    const rounds = makeRounds();
    rounds[1].matches[0].winner = "Alpha"; // stale result
    rounds[0].matches[0].winner = "Beta";  // different winner now
    rounds[0].matches[1].winner = "Gamma";
    const result = propagateKnockout(rounds);
    expect(result[1].matches[0].winner).toBeNull();
    expect(result[1].matches[0].status).toBe("pending");
  });

  test("does not mutate the original rounds array", () => {
    const rounds = makeRounds();
    rounds[0].matches[0].winner = "Alpha";
    propagateKnockout(rounds);
    expect(rounds[1].matches[0].teamA).toBe("TBD"); // unchanged
  });
});

// ── rrStandingsCalc ───────────────────────────────────────────────────────────

describe("rrStandingsCalc", () => {
  const teams = ["Alpha", "Beta", "Gamma"];
  const matches = [
    { teamA: "Alpha", teamB: "Beta",  scoreA: 21, scoreB: 15, status: "done", isBye: false },
    { teamA: "Alpha", teamB: "Gamma", scoreA: 21, scoreB: 18, status: "done", isBye: false },
    { teamA: "Beta",  teamB: "Gamma", scoreA: 15, scoreB: 21, status: "done", isBye: false },
  ];

  test("standings are sorted by points descending", () => {
    const standings = rrStandingsCalc(matches, teams);
    const pts = standings.map(([, s]) => s.pts);
    expect(pts[0]).toBeGreaterThanOrEqual(pts[1]);
    expect(pts[1]).toBeGreaterThanOrEqual(pts[2]);
  });

  test("Alpha has 2 wins → 6 pts", () => {
    const standings = rrStandingsCalc(matches, teams);
    const alpha = standings.find(([n]) => n === "Alpha");
    expect(alpha[1].w).toBe(2);
    expect(alpha[1].pts).toBe(6);
  });

  test("Beta has 0 wins → 0 pts", () => {
    const standings = rrStandingsCalc(matches, teams);
    const beta = standings.find(([n]) => n === "Beta");
    expect(beta[1].w).toBe(0);
    expect(beta[1].pts).toBe(0);
  });

  test("pending matches are ignored", () => {
    const withPending = [
      ...matches,
      { teamA: "Alpha", teamB: "Beta", scoreA: null, scoreB: null, status: "pending", isBye: false },
    ];
    const standings = rrStandingsCalc(withPending, teams);
    const alpha = standings.find(([n]) => n === "Alpha");
    expect(alpha[1].w).toBe(2);
  });

  test("bye matches are ignored", () => {
    const withBye = [
      ...matches,
      { teamA: "Alpha", teamB: null, scoreA: null, scoreB: null, status: "bye", isBye: true },
    ];
    const standings = rrStandingsCalc(withBye, teams);
    const alpha = standings.find(([n]) => n === "Alpha");
    expect(alpha[1].w).toBe(2);
  });
});
