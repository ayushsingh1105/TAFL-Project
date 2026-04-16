// engine.js - NFA to DFA conversion using Subset Construction
// Pure logic, no DOM stuff

class DFAConverter {
  constructor(nfa) {
    this.states = nfa.states;
    this.alpha = nfa.alphabet;       // just the symbols, no 'eps'
    this.trans = nfa.transitions;
    this.start = nfa.start;
    this.accept = nfa.accept;

    // dfa output
    this.dfaStates = new Map();      // label -> { nfaSet, isAccept }
    this.dfaTrans = {};              // label -> { symbol -> label }
    this.dfaStart = null;
    this.dfaAccept = [];
    this.steps = [];
  }

  // sort states so we always get consistent labels
  static sortStates(set) {
    return [...set].sort();
  }

  // turn a set like ['q0','q1'] into "[q0,q1]", empty set becomes "∅"
  static makeLabel(arr) {
    if (arr.length === 0) return '∅';
    return '[' + arr.join(',') + ']';
  }

  // get epsilon closure of a set of states using BFS
  getEpsClosure(states) {
    let closure = new Set(states);
    let stack = [...states];

    while (stack.length > 0) {
      let curr = stack.pop();
      let epsNext = (this.trans[curr] && this.trans[curr]['eps']) || [];

      for (let s of epsNext) {
        if (!closure.has(s)) {
          closure.add(s);
          stack.push(s);
        }
      }
    }
    // console.log("eps-closure of", states, "=", [...closure]);
    return DFAConverter.sortStates(closure);
  }

  // get all states reachable from `states` on a given symbol (no eps)
  move(states, sym) {
    let res = new Set();
    for (let s of states) {
      let next = (this.trans[s] && this.trans[s][sym]) || [];
      for (let t of next) {
        res.add(t);
      }
    }
    return DFAConverter.sortStates(res);
  }

  // register new dfa state if not already there
  _addState(arr, queue) {
    let label = DFAConverter.makeLabel(arr);
    if (this.dfaStates.has(label)) return false;

    let isAcc = arr.some(s => this.accept.includes(s));
    this.dfaStates.set(label, { nfaStates: arr, isAccept: isAcc });
    this.dfaTrans[label] = {};
    queue.push(label);
    return true;
  }

  // main subset construction algorithm
  convert() {
    let steps = [];
    let queue = [];   // unmarked states to process

    // step 1: eps-closure of start state
    let startSet = this.getEpsClosure([this.start]);
    let startLabel = DFAConverter.makeLabel(startSet);
    this.dfaStart = startLabel;

    steps.push({
      type: 'init',
      detail: {
        message: `Compute ε-closure of start state {${this.start}}.`,
        closure: startSet.slice(),
        label: startLabel
      }
    });

    this._addState(startSet, queue);

    // step 2: keep processing until no unmarked states left
    while (queue.length > 0) {
      let currLabel = queue.shift();
      let currNfa = this.dfaStates.get(currLabel).nfaStates;

      steps.push({
        type: 'process',
        detail: {
          message: `Processing DFA state <code>${currLabel}</code> → NFA states {${currNfa.join(', ')}}.`,
          state: currLabel,
          nfaStates: currNfa.slice()
        }
      });

      // try each symbol
      for (let sym of this.alpha) {
        let moved = this.move(currNfa, sym);
        let closed = this.getEpsClosure(moved);
        let targetLabel = DFAConverter.makeLabel(closed);

        let isNew = this._addState(closed, queue);
        this.dfaTrans[currLabel][sym] = targetLabel;

        // console.log("delta(" + currLabel + "," + sym + ") =", targetLabel);

        steps.push({
          type: 'transition',
          detail: {
            message:
              `δ(<code>${currLabel}</code>, <code>${sym}</code>): ` +
              `move = {${moved.join(', ') || '—'}} → ` +
              `ε-closure = {${closed.join(', ') || '—'}} = <code>${targetLabel}</code>` +
              (isNew ? ' <strong>(new state)</strong>' : ' (already exists)'),
            from: currLabel,
            symbol: sym,
            moveResult: moved.slice(),
            closureResult: closed.slice(),
            to: targetLabel,
            isNew: isNew,
            isTrap: closed.length === 0
          }
        });
      }
    }

    // make sure dead state loops to itself on every symbol
    if (this.dfaStates.has('∅')) {
      for (let sym of this.alpha) {
        this.dfaTrans['∅'][sym] = '∅';
      }
    }
    // console.log("final DFA states:", [...this.dfaStates.keys()]);

    // build final result
    let allLabels = [...this.dfaStates.keys()];
    this.dfaAccept = allLabels.filter(l => this.dfaStates.get(l).isAccept);

    steps.push({
      type: 'complete',
      detail: {
        message:
          `Subset construction complete. DFA has <strong>${allLabels.length}</strong> state(s), ` +
          `<strong>${this.dfaAccept.length}</strong> accepting.` +
          (this.dfaStates.has('∅') ? ' Includes dead/trap state <code>∅</code>.' : ''),
        totalStates: allLabels.length,
        acceptCount: this.dfaAccept.length,
        hasTrap: this.dfaStates.has('∅')
      }
    });

    this.steps = steps;

    let dfa = {
      states: allLabels,
      alphabet: this.alpha.slice(),
      transitions: this.dfaTrans,
      start: this.dfaStart,
      accept: this.dfaAccept,
      stateMap: Object.fromEntries(this.dfaStates)
    };

    return { dfa, steps };
  }
}

// sample NFA for quick testing - recognizes strings ending with "ab"
function getSampleNFA() {
  return {
    states: ['q0', 'q1', 'q2', 'q3'],
    alphabet: ['a', 'b'],
    transitions: {
      q0: { a: ['q0'], b: ['q0'], eps: ['q1'] },
      q1: { a: ['q2'] },
      q2: { b: ['q3'] },
      q3: {}
    },
    start: 'q0',
    accept: ['q3'],
    _raw: {
      states: 'q0, q1, q2, q3',
      alphabet: 'a, b',
      transitions: 'q0, a, q0\nq0, b, q0\nq0, eps, q1\nq1, a, q2\nq2, b, q3',
      start: 'q0',
      accept: 'q3'
    }
  };
}
