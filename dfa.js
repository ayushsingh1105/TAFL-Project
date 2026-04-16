/* ===================================================================
   dfa.js — DFA Data Model & Minimization Algorithm
   
   Implements:
     • DFA validation
     • Reachable-state computation (BFS)
     • Partition-refinement minimization with full step recording
     • Minimized-DFA construction
   =================================================================== */

window.DFAApp = window.DFAApp || {};

/* ---------- Partition color palette ---------- */
window.DFAApp.PARTITION_COLORS = [
    '#818cf8', '#f472b6', '#34d399', '#fbbf24',
    '#a78bfa', '#22d3ee', '#fb923c', '#a3e635',
    '#f87171', '#2dd4bf'
];

/* ---------- DFA Class ---------- */
class DFA {
    /**
     * @param {string[]} states       — e.g. ['q0','q1','q2']
     * @param {string[]} alphabet     — e.g. ['a','b']
     * @param {Object}   transitions  — { q0: { a: 'q1', b: 'q0' }, … }
     * @param {string}   startState   — e.g. 'q0'
     * @param {string[]} acceptStates — e.g. ['q2']
     */
    constructor(states, alphabet, transitions, startState, acceptStates) {
        this.states       = states;
        this.alphabet     = alphabet;
        this.transitions  = transitions;
        this.startState   = startState;
        this.acceptStates = acceptStates;
    }

    /* ---- Transition lookup (returns null for missing) ---- */
    getTransition(state, symbol) {
        if (this.transitions[state] && this.transitions[state][symbol] !== undefined) {
            return this.transitions[state][symbol];
        }
        return null;
    }

    /* ============================================================
       VALIDATION  — returns { valid: bool, errors: string[] }
       ============================================================ */
    validate() {
        const errors = [];

        // At least one state
        if (!this.states.length) errors.push('At least one state is required.');

        // Alphabet non-empty
        if (!this.alphabet.length) errors.push('Alphabet must contain at least one symbol.');

        // Start state exists
        if (!this.states.includes(this.startState))
            errors.push(`Start state "${this.startState}" is not in the set of states.`);

        // Accept states exist
        for (const s of this.acceptStates) {
            if (!this.states.includes(s))
                errors.push(`Accept state "${s}" is not in the set of states.`);
        }

        // At least one accept state
        if (!this.acceptStates.length)
            errors.push('At least one accept (final) state is required.');

        // Transitions: every (state, symbol) must be defined and target must be valid
        for (const state of this.states) {
            for (const sym of this.alphabet) {
                const target = this.getTransition(state, sym);
                if (target === null) {
                    errors.push(`Missing transition: δ(${state}, ${sym}).`);
                } else if (!this.states.includes(target)) {
                    errors.push(`Transition δ(${state}, ${sym}) = "${target}" — target not in states.`);
                }
            }
        }

        return { valid: errors.length === 0, errors };
    }

    /* ============================================================
       REACHABLE STATES  — BFS from startState
       Returns a Set of reachable state names.
       ============================================================ */
    findReachableStates() {
        const visited = new Set();
        const queue   = [this.startState];
        visited.add(this.startState);

        while (queue.length) {
            const current = queue.shift();
            for (const sym of this.alphabet) {
                const target = this.getTransition(current, sym);
                if (target && !visited.has(target)) {
                    visited.add(target);
                    queue.push(target);
                }
            }
        }
        return visited;
    }

    /* ============================================================
       MINIMIZE  — Partition Refinement (Hopcroft-style)
       
       Returns { steps: Step[], minimizedDFA: DFA, finalPartition }
       
       Each Step object:
         { stepNumber, type, partition, explanation,
           splitDetails?, removedStates?, minimizedDFA?, stateMapping? }
       ============================================================ */
    minimize() {
        const steps = [];
        let stepNum = 0;

        /* ----- Step 0: Remove unreachable states ----- */
        const reachable     = this.findReachableStates();
        const removedStates = this.states.filter(s => !reachable.has(s));
        const workingStates = this.states.filter(s => reachable.has(s));

        if (removedStates.length > 0) {
            steps.push({
                stepNumber: stepNum++,
                type: 'unreachable',
                partition: [workingStates.slice()],
                removedStates: removedStates.slice(),
                explanation:
                    `Removed unreachable state${removedStates.length > 1 ? 's' : ''}: ` +
                    `{${removedStates.join(', ')}}. ` +
                    `These states cannot be reached from the start state "${this.startState}" ` +
                    `and do not affect the language recognised by the DFA.`
            });
        }

        /* ----- Step 1: Initial partition  { non-accept , accept } ----- */
        const accepting    = workingStates.filter(s => this.acceptStates.includes(s));
        const nonAccepting = workingStates.filter(s => !this.acceptStates.includes(s));

        let partition = [];
        if (nonAccepting.length) partition.push(nonAccepting);
        if (accepting.length)    partition.push(accepting);

        steps.push({
            stepNumber: stepNum++,
            type: 'initial',
            partition: deepCopy(partition),
            explanation:
                `Initial partition — separate accepting states from non-accepting states.\n` +
                (nonAccepting.length
                    ? `Non-accepting: {${nonAccepting.join(', ')}}\n`
                    : '') +
                `Accepting: {${accepting.join(', ')}}`
        });

        /* ----- Steps 2 … N: Iterative refinement ----- */
        let changed = true;
        let iterationCount = 0;

        while (changed) {
            changed = false;
            const newPartition  = [];
            const splitDetails  = [];

            for (const group of partition) {
                // Singleton groups can never be split
                if (group.length <= 1) {
                    newPartition.push(group);
                    continue;
                }

                // Compute a "signature" for each state in this group:
                // For every alphabet symbol, which *group index* does the
                // target state belong to?
                const sigMap = new Map();

                for (const state of group) {
                    const sig = this.alphabet.map(sym => {
                        const target = this.getTransition(state, sym);
                        if (!target) return -1;            // dead / missing
                        return partition.findIndex(g => g.includes(target));
                    }).join(',');

                    if (!sigMap.has(sig)) sigMap.set(sig, []);
                    sigMap.get(sig).push(state);
                }

                const splits = [...sigMap.values()];

                if (splits.length > 1) {
                    changed = true;
                    splitDetails.push({
                        originalGroup: group.slice(),
                        resultGroups:  splits.map(s => s.slice()),
                        reason: this._buildSplitReason(group, splits, partition)
                    });
                }

                newPartition.push(...splits);
            }

            if (changed) {
                partition = newPartition;
                iterationCount++;
                steps.push({
                    stepNumber: stepNum++,
                    type: 'refinement',
                    partition:   deepCopy(partition),
                    splitDetails: deepCopy(splitDetails),
                    explanation:
                        `Refinement iteration ${iterationCount}. ` +
                        splitDetails.map(d =>
                            `Group {${d.originalGroup.join(', ')}} was split into ` +
                            d.resultGroups.map(g => `{${g.join(', ')}}`).join(' and ') + '.'
                        ).join(' ')
                });
            }
        }

        /* ----- Stable — no more refinement ----- */
        steps.push({
            stepNumber: stepNum++,
            type: 'complete',
            partition: deepCopy(partition),
            explanation:
                'Partition is stable — no group can be refined further. ' +
                'States within the same group are equivalent: they accept ' +
                'exactly the same set of future input strings.'
        });

        /* ----- Build the minimized DFA ----- */
        const minimizedDFA = this._buildMinimizedDFA(partition, workingStates);
        const stateMapping = this._stateMapping(partition);

        steps.push({
            stepNumber: stepNum++,
            type: 'result',
            partition:    deepCopy(partition),
            minimizedDFA: minimizedDFA,
            stateMapping: stateMapping,
            explanation:
                'Minimized DFA constructed. Each equivalence class becomes a single state. ' +
                `Result: ${minimizedDFA.states.length} state${minimizedDFA.states.length > 1 ? 's' : ''} ` +
                `(down from ${workingStates.length}).`
        });

        return { steps, minimizedDFA, finalPartition: partition };
    }

    /* ---- Build a human-readable explanation of why a group was split ---- */
    _buildSplitReason(group, splits, partition) {
        const reasons = [];

        for (const sym of this.alphabet) {
            // Collect target-group for each state
            const mapping = {};
            for (const state of group) {
                const target = this.getTransition(state, sym);
                const tgtIdx = target
                    ? partition.findIndex(g => g.includes(target))
                    : -1;
                mapping[state] = tgtIdx;
            }

            // Check if this symbol distinguishes any two split groups
            const targetGroups = splits.map(sp => mapping[sp[0]]);
            if (new Set(targetGroups).size > 1) {
                // Build a descriptive string
                const parts = splits.map(sp => {
                    const repr  = sp[0];
                    const tgt   = this.getTransition(repr, sym);
                    const tIdx  = mapping[repr];
                    const tgtGroupStr = tIdx >= 0
                        ? `{${partition[tIdx].join(', ')}}`
                        : '∅ (dead)';
                    return `${sp.join(',')} → δ(·, ${sym}) ∈ ${tgtGroupStr}`;
                });
                reasons.push(`On symbol '${sym}': ${parts.join('  vs  ')}`);
            }
        }

        return reasons.join('\n');
    }

    /* ---- Construct the minimized DFA from the final partition ---- */
    _buildMinimizedDFA(partition, workingStates) {
        // Name each new state after its group members, e.g. "{q0,q3}"
        const groupName = group => {
            if (group.length === 1) return group[0];
            return '{' + group.join(',') + '}';
        };

        // Map from old state → group index
        const stateToGroup = {};
        partition.forEach((group, idx) => {
            group.forEach(s => { stateToGroup[s] = idx; });
        });

        const newStates       = partition.map(groupName);
        const newAlphabet     = this.alphabet.slice();
        const newStartState   = newStates[stateToGroup[this.startState]];
        const newAcceptStates = [];
        const newTransitions  = {};

        partition.forEach((group, idx) => {
            const name = newStates[idx];

            // Accept if any member is accepting (all members share the property)
            if (group.some(s => this.acceptStates.includes(s))) {
                newAcceptStates.push(name);
            }

            // Transitions: use representative (first member)
            newTransitions[name] = {};
            for (const sym of this.alphabet) {
                const target    = this.getTransition(group[0], sym);
                const targetIdx = target !== null ? stateToGroup[target] : undefined;
                newTransitions[name][sym] = targetIdx !== undefined
                    ? newStates[targetIdx]
                    : null;
            }
        });

        return new DFA(newStates, newAlphabet, newTransitions, newStartState, newAcceptStates);
    }

    /* ---- Build old→new state mapping for display ---- */
    _stateMapping(partition) {
        const groupName = group =>
            group.length === 1 ? group[0] : '{' + group.join(',') + '}';

        const mapping = [];
        partition.forEach(group => {
            const name = groupName(group);
            group.forEach(s => mapping.push({ oldState: s, newState: name }));
        });
        return mapping;
    }
}

/* ---------- Utility: deep copy plain objects / arrays ---------- */
function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/* Export */
window.DFAApp.DFA = DFA;
