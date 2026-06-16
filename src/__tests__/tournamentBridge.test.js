import React from "react";
import { render, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TournamentView } from "../App";

// ── Firebase mock ─────────────────────────────────────────────────────────────

const mockSaveTournament = jest.fn();
let subscribeCb = null;

jest.mock("../firebase", () => ({
  subscribeTournament: jest.fn((room, cb) => {
    subscribeCb = cb;
    return () => { subscribeCb = null; };
  }),
  saveTournament: (...args) => mockSaveTournament(...args),
  // Unused by TournamentView but imported by App.js at module level
  saveLiveMatch: jest.fn(),
  savePlayers: jest.fn(),
  saveTeams: jest.fn(),
  saveHistory: jest.fn(),
  saveRoomMeta: jest.fn(),
  getRoomMeta: jest.fn(() => Promise.resolve(null)),
  subscribeLiveMatch: jest.fn(() => () => {}),
  subscribePlayers: jest.fn(() => () => {}),
  subscribeTeams: jest.fn(() => () => {}),
  subscribeHistory: jest.fn(() => () => {}),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockTourn = {
  type: "knockout",
  setsToWin: 2,
  rounds: [
    {
      name: "🏆 Final",
      matches: [
        {
          id: "m0",
          teamA: "Alpha",
          teamB: "Beta",
          scoreA: null,
          scoreB: null,
          winner: null,
          status: "pending",
          isBye: false,
          setsDetail: "",
        },
      ],
    },
  ],
};

const noop = () => {};

/**
 * Renders TournamentView pre-loaded with tournament data.
 * Passing `initialTourn` causes the subscribeTournament mock to feed data
 * synchronously during the component's first useEffect, so tournRef is
 * populated before any test assertion runs.
 */
function renderWithTourn(initialTourn = null, hidden = false) {
  const { subscribeTournament } = require("../firebase");
  subscribeTournament.mockImplementation((room, cb) => {
    subscribeCb = cb;
    if (initialTourn) cb(initialTourn);  // seed synchronously
    return () => { subscribeCb = null; };
  });

  return render(
    <div style={{ display: hidden ? "none" : "" }}>
      <TournamentView
        teams={[{ name: "Alpha", members: ["P1"] }, { name: "Beta", members: ["P2"] }]}
        players={["P1", "P2"]}
        room="test-room"
        isRef={true}
        onStartMatch={noop}
        toast$={noop}
      />
    </div>
  );
}

afterEach(() => {
  delete window.__writeTourn;
  subscribeCb = null;
  mockSaveTournament.mockClear();
  jest.clearAllMocks();
});

// ── window.__writeTourn lifecycle ─────────────────────────────────────────────

describe("window.__writeTourn bridge lifecycle", () => {
  test("is registered when TournamentView mounts", () => {
    renderWithTourn();
    expect(typeof window.__writeTourn).toBe("function");
  });

  test("persists when TournamentView is hidden via display:none — the bug fix", () => {
    const { rerender } = render(
      <div style={{ display: "" }}>
        <TournamentView teams={[]} players={[]} room="test-room"
          isRef={true} onStartMatch={noop} toast$={noop} />
      </div>
    );
    expect(window.__writeTourn).toBeDefined();

    // Simulate navigating away to "match" view (our fix keeps TournamentView
    // mounted but hides it with display:none instead of unmounting)
    rerender(
      <div style={{ display: "none" }}>
        <TournamentView teams={[]} players={[]} room="test-room"
          isRef={true} onStartMatch={noop} toast$={noop} />
      </div>
    );

    expect(window.__writeTourn).toBeDefined();
  });

  test("is deleted when TournamentView actually unmounts", () => {
    const { unmount } = renderWithTourn();
    expect(window.__writeTourn).toBeDefined();
    unmount();
    expect(window.__writeTourn).toBeUndefined();
  });
});

// ── writeResult correctness (called via window.__writeTourn) ──────────────────

describe("writeResult via window.__writeTourn", () => {
  test("saves match winner and set scores to saveTournament", () => {
    renderWithTourn(mockTourn);

    const sets = [
      { scoreA: 21, scoreB: 15, winner: "A" },
      { scoreA: 21, scoreB: 18, winner: "A" },
    ];

    act(() => {
      window.__writeTourn(
        { round: 0, match: 0 }, sets, "A",
        { name: "Alpha", players: ["P1"] },
        { name: "Beta",  players: ["P2"] }
      );
    });

    expect(mockSaveTournament).toHaveBeenCalledTimes(1);
    const [, saved] = mockSaveTournament.mock.calls[0];
    const match = saved.rounds[0].matches[0];
    expect(match.winner).toBe("Alpha");
    expect(match.scoreA).toBe(2);
    expect(match.scoreB).toBe(0);
    expect(match.status).toBe("done");
    expect(match.setsDetail).toBe("21-15, 21-18");
  });

  test("saves B as winner when B wins", () => {
    renderWithTourn(mockTourn);

    act(() => {
      window.__writeTourn(
        { round: 0, match: 0 },
        [{ scoreA: 15, scoreB: 21, winner: "B" }, { scoreA: 18, scoreB: 21, winner: "B" }],
        "B",
        { name: "Alpha", players: ["P1"] },
        { name: "Beta",  players: ["P2"] }
      );
    });

    const [, saved] = mockSaveTournament.mock.calls[0];
    expect(saved.rounds[0].matches[0].winner).toBe("Beta");
  });

  test("does nothing when tournament is not yet loaded", () => {
    renderWithTourn(); // no initialTourn

    act(() => {
      window.__writeTourn(
        { round: 0, match: 0 },
        [{ scoreA: 21, scoreB: 15, winner: "A" }],
        "A",
        { name: "Alpha", players: ["P1"] },
        { name: "Beta",  players: ["P2"] }
      );
    });

    expect(mockSaveTournament).not.toHaveBeenCalled();
  });

  test("does nothing when path is null", () => {
    renderWithTourn(mockTourn);

    act(() => {
      window.__writeTourn(
        null,
        [{ scoreA: 21, scoreB: 15, winner: "A" }],
        "A",
        { name: "Alpha", players: ["P1"] },
        { name: "Beta",  players: ["P2"] }
      );
    });

    expect(mockSaveTournament).not.toHaveBeenCalled();
  });

  test("propagates knockout winner into the next round after writing result", () => {
    const twoRoundTourn = {
      type: "knockout",
      setsToWin: 2,
      rounds: [
        {
          name: "Semi-Finals",
          matches: [
            { id: "m0", teamA: "Alpha", teamB: "Beta",  winner: null,    status: "pending", isBye: false, setsDetail: "" },
            { id: "m1", teamA: "Gamma", teamB: "Delta", winner: "Gamma", status: "done",    isBye: false, setsDetail: "21-15" },
          ],
        },
        {
          name: "🏆 Final",
          matches: [
            { id: "m2", teamA: "TBD", teamB: "TBD", winner: null, status: "pending", isBye: false, setsDetail: "" },
          ],
        },
      ],
    };

    renderWithTourn(twoRoundTourn);

    act(() => {
      window.__writeTourn(
        { round: 0, match: 0 },
        [{ scoreA: 21, scoreB: 18, winner: "A" }, { scoreA: 21, scoreB: 19, winner: "A" }],
        "A",
        { name: "Alpha", players: ["P1"] },
        { name: "Beta",  players: ["P2"] }
      );
    });

    const [, saved] = mockSaveTournament.mock.calls[0];
    const finalMatch = saved.rounds[1].matches[0];
    expect(finalMatch.teamA).toBe("Alpha");
    expect(finalMatch.teamB).toBe("Gamma");
  });

  test("handles group-stage path (qualifier format)", () => {
    const qualTourn = {
      type: "qualifier",
      setsToWin: 2,
      groups: [
        {
          groupName: "Group A",
          rounds: [
            {
              name: "Round 1",
              matches: [
                { id: "m0", teamA: "Alpha", teamB: "Beta", winner: null, status: "pending", isBye: false, setsDetail: "" },
              ],
            },
          ],
        },
      ],
      knockout: { rounds: [] },
    };

    renderWithTourn(qualTourn);

    act(() => {
      window.__writeTourn(
        { group: 0, round: 0, match: 0 },
        [{ scoreA: 21, scoreB: 10, winner: "A" }, { scoreA: 21, scoreB: 12, winner: "A" }],
        "A",
        { name: "Alpha", players: ["P1"] },
        { name: "Beta",  players: ["P2"] }
      );
    });

    const [, saved] = mockSaveTournament.mock.calls[0];
    const match = saved.groups[0].rounds[0].matches[0];
    expect(match.winner).toBe("Alpha");
    expect(match.status).toBe("done");
  });

  test("handles qualifier knockout-phase path (path.ko=true routes to t.knockout.rounds)", () => {
    // This tests the core bug fix: before the fix, qualifier KO matches looked at
    // t.rounds (undefined for qualifier) and silently failed to save.
    const qualWithKO = {
      type: "qualifier",
      setsToWin: 2,
      groups: [],
      groupsDone: true,
      knockout: {
        type: "knockout",
        rounds: [
          {
            name: "🏆 Final",
            matches: [
              { id: "m0", teamA: "Alpha", teamB: "Beta", winner: null, status: "pending", isBye: false, setsDetail: "" },
            ],
          },
        ],
      },
    };

    renderWithTourn(qualWithKO);

    act(() => {
      window.__writeTourn(
        { ko: true, round: 0, match: 0 },  // path.ko = true → reads t.knockout.rounds
        [{ scoreA: 21, scoreB: 18, winner: "A" }, { scoreA: 21, scoreB: 16, winner: "A" }],
        "A",
        { name: "Alpha", players: ["P1"] },
        { name: "Beta",  players: ["P2"] }
      );
    });

    expect(mockSaveTournament).toHaveBeenCalledTimes(1);
    const [, saved] = mockSaveTournament.mock.calls[0];
    const match = saved.knockout.rounds[0].matches[0];
    expect(match.winner).toBe("Alpha");
    expect(match.scoreA).toBe(2);
    expect(match.scoreB).toBe(0);
    expect(match.status).toBe("done");
    expect(match.setsDetail).toBe("21-18, 21-16");
  });

  test("round-robin knockout-phase path (path.ko=true on rr-ko tournament)", () => {
    const rrWithKO = {
      type: "round-robin",
      setsToWin: 2,
      groupsDone: true,
      rounds: [],
      knockout: {
        type: "knockout",
        rounds: [
          {
            name: "🏆 Final",
            matches: [
              { id: "m0", teamA: "Alpha", teamB: "Beta", winner: null, status: "pending", isBye: false, setsDetail: "" },
            ],
          },
        ],
      },
    };

    renderWithTourn(rrWithKO);

    act(() => {
      window.__writeTourn(
        { ko: true, round: 0, match: 0 },
        [{ scoreA: 21, scoreB: 14, winner: "A" }, { scoreA: 21, scoreB: 19, winner: "A" }],
        "A",
        { name: "Alpha", players: ["P1"] },
        { name: "Beta",  players: ["P2"] }
      );
    });

    expect(mockSaveTournament).toHaveBeenCalledTimes(1);
    const [, saved] = mockSaveTournament.mock.calls[0];
    expect(saved.knockout.rounds[0].matches[0].winner).toBe("Alpha");
    expect(saved.knockout.rounds[0].matches[0].status).toBe("done");
  });
});
