window.DFAApp = window.DFAApp || {};

window.DFAApp.SAMPLES = [
    // ----------------------------------------------------------------
    // Sample 1 — "Strings ending in 'ab'" (6 → 3 states)
    // Two parallel halves that collapse neatly.
    // ----------------------------------------------------------------
    {
        name: "Strings ending in 'ab' (6 → 3)",
        description:
            "A DFA that accepts strings over {a, b} ending with the substring 'ab'. " +
            "States q0/q3, q1/q4, and q2/q5 are pairwise equivalent, " +
            "so the minimized DFA has only 3 states.",
        states: ["q0", "q1", "q2", "q3", "q4", "q5"],
        alphabet: ["a", "b"],
        startState: "q0",
        acceptStates: ["q2", "q5"],
        transitions: {
            q0: { a: "q1", b: "q3" },
            q1: { a: "q1", b: "q2" },
            q2: { a: "q1", b: "q3" },
            q3: { a: "q4", b: "q3" },
            q4: { a: "q4", b: "q5" },
            q5: { a: "q4", b: "q3" }
        }
    },

    // ----------------------------------------------------------------
    // Sample 2 — Classic textbook (6 → 4 states, multi-iteration)
    // Requires 2 refinement rounds, giving a richer step-by-step trace.
    // ----------------------------------------------------------------
    {
        name: "Textbook example (6 → 4, multi-step)",
        description:
            "A 6-state DFA over {0, 1} that needs multiple refinement " +
            "iterations. States {A, B} merge, and states {C, D} merge.",
        states: ["A", "B", "C", "D", "E", "F"],
        alphabet: ["0", "1"],
        startState: "A",
        acceptStates: ["E"],
        transitions: {
            A: { "0": "B", "1": "C" },
            B: { "0": "A", "1": "D" },
            C: { "0": "E", "1": "F" },
            D: { "0": "E", "1": "F" },
            E: { "0": "E", "1": "F" },
            F: { "0": "F", "1": "F" }
        }
    },

    // ----------------------------------------------------------------
    // Sample 3 — Symmetric DFA (5 → 3 states)
    // Nice symmetry between pairs of states.
    // ----------------------------------------------------------------
    {
        name: "Symmetric DFA (5 → 3)",
        description:
            "States q1/q2 and q3/q4 are equivalent pairs. " +
            "Demonstrates a single-step refinement.",
        states: ["q0", "q1", "q2", "q3", "q4"],
        alphabet: ["0", "1"],
        startState: "q0",
        acceptStates: ["q3", "q4"],
        transitions: {
            q0: { "0": "q1", "1": "q2" },
            q1: { "0": "q3", "1": "q4" },
            q2: { "0": "q4", "1": "q3" },
            q3: { "0": "q3", "1": "q3" },
            q4: { "0": "q4", "1": "q4" }
        }
    },

    // ----------------------------------------------------------------
    // Sample 4 — Already minimal (3 states)
    // Shows the tool confirming that no reduction is possible.
    // ----------------------------------------------------------------
    {
        name: "Already minimal (3 states)",
        description:
            "A minimal 3-state DFA over {a, b}. The partition " +
            "refinement algorithm will confirm that no states can be merged.",
        states: ["q0", "q1", "q2"],
        alphabet: ["a", "b"],
        startState: "q0",
        acceptStates: ["q2"],
        transitions: {
            q0: { a: "q1", b: "q0" },
            q1: { a: "q1", b: "q2" },
            q2: { a: "q1", b: "q0" }
        }
    },

    // ----------------------------------------------------------------
    // Sample 5 — DFA with unreachable state (5 → 3 states)
    // One state is unreachable and gets removed before refinement.
    // ----------------------------------------------------------------
    {
        name: "DFA with unreachable state (5 → 3)",
        description:
            "State 'X' cannot be reached from the start state. " +
            "The algorithm first removes it, then minimizes the rest.",
        states: ["q0", "q1", "q2", "q3", "X"],
        alphabet: ["a", "b"],
        startState: "q0",
        acceptStates: ["q2"],
        transitions: {
            q0: { a: "q1", b: "q0" },
            q1: { a: "q1", b: "q2" },
            q2: { a: "q1", b: "q3" },
            q3: { a: "q1", b: "q0" },
            X:  { a: "q2", b: "X" }
        }
    }
];
