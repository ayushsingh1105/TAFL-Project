// visualizer.js - vis-network graph rendering for NFA and DFA

// color scheme for graph nodes and edges
const COLORS = {
  node:     { bg: '#1e1b4b', border: '#6366f1', font: '#e2e8f0' },
  start:    { bg: '#0f766e', border: '#2dd4bf', font: '#f0fdfa' },
  accept:   { border: '#a78bfa' },
  active:   { bg: '#fbbf24', border: '#f59e0b', font: '#1e1b4b' },
  newState: { bg: '#059669', border: '#34d399', font: '#f0fdf4' },
  trap:     { bg: '#7f1d1d', border: '#f87171', font: '#fca5a5' },
  edge:     '#6366f1',
  edgeLbl:  '#c4b5fd',
  edgeNew:  '#34d399',
};

// shared options for both graphs
function getGraphOpts() {
  return {
    layout: {
      hierarchical: {
        enabled: true,
        direction: 'LR',
        sortMethod: 'directed',
        levelSeparation: 180,
        nodeSpacing: 150,
        treeSpacing: 140,
      }
    },
    physics: { enabled: false },
    nodes: {
      shape: 'circle',
      size: 30,
      font: { face: 'JetBrains Mono, monospace', size: 13, color: COLORS.node.font },
      color: { background: COLORS.node.bg, border: COLORS.node.border },
      borderWidth: 2,
      borderWidthSelected: 3,
    },
    edges: {
      color: { color: COLORS.edge },
      font: {
        face: 'JetBrains Mono, monospace', size: 12,
        color: COLORS.edgeLbl, strokeWidth: 3, strokeColor: '#0b0e17', align: 'top',
      },
      arrows: { to: { enabled: true, scaleFactor: 0.7 } },
      smooth: { type: 'curvedCW', roundness: 0.15 },
      width: 1.8,
    },
    interaction: { dragNodes: true, dragView: true, zoomView: true },
  };
}

// helper - get curve settings for an edge
function getSmooth(from, to, hasReverse) {
  if (from === to) return { type: 'curvedCW', roundness: 0.6 };
  return { type: 'curvedCW', roundness: hasReverse ? 0.25 : 0.12 };
}

// ===================== NFA GRAPH =====================

// draw the full NFA graph at once
function renderNFA(nfa, container) {
  let nodes = [];
  let edges = [];

  // invisible node for start arrow
  nodes.push({
    id: '__start__', label: '', shape: 'dot', size: 0,
    color: { background: 'transparent', border: 'transparent' }, fixed: true
  });
  edges.push({
    from: '__start__', to: nfa.start,
    color: { color: COLORS.start.border }, width: 2, smooth: false
  });

  // add state nodes
  for (let st of nfa.states) {
    let isAcc = nfa.accept.includes(st);
    let isSt = (st === nfa.start);
    nodes.push({
      id: st, label: st,
      shape: isAcc ? 'doublecircle' : 'circle',
      borderWidth: isAcc ? 4 : 2,
      size: isAcc ? 25 : 30,
      color: {
        background: isSt ? COLORS.start.bg : COLORS.node.bg,
        border: isSt ? COLORS.start.border : (isAcc ? COLORS.accept.border : COLORS.node.border),
      },
      font: { color: isSt ? COLORS.start.font : COLORS.node.font },
    });
  }

  // group edges by (from,to) to combine labels like "a, b"
  let edgeMap = new Map();
  for (let from of nfa.states) {
    let tr = nfa.transitions[from] || {};
    for (let [sym, targets] of Object.entries(tr)) {
      let displaySym = (sym === 'eps') ? 'ε' : sym;
      for (let to of targets) {
        let key = from + '→' + to;
        if (!edgeMap.has(key)) edgeMap.set(key, { from, to, labels: [] });
        if (!edgeMap.get(key).labels.includes(displaySym)) {
          edgeMap.get(key).labels.push(displaySym);
        }
      }
    }
  }

  // create combined edges
  for (let [, data] of edgeMap) {
    let rev = edgeMap.has(data.to + '→' + data.from);
    edges.push({
      from: data.from, to: data.to,
      label: data.labels.join(', '),
      smooth: getSmooth(data.from, data.to, rev),
    });
  }

  // console.log("NFA nodes:", nodes.length, "edges:", edges.length);

  return new vis.Network(
    container,
    { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) },
    getGraphOpts()
  );
}

// ===================== DFA GRAPH (incremental) =====================

class DFAVisualizer {
  constructor(container, alphabet) {
    this.container = container;
    this.alpha = alphabet;
    this.nodesDS = new vis.DataSet();
    this.edgesDS = new vis.DataSet();
    this.added = new Set();
    this.edgeMap = new Map();    // 'from→to' -> edge id for merging
    this._eid = 0;

    // invisible start pointer
    this.nodesDS.add({
      id: '__start__', label: '', shape: 'dot', size: 0,
      color: { background: 'transparent', border: 'transparent' }, fixed: true
    });

    this.network = new vis.Network(
      container,
      { nodes: this.nodesDS, edges: this.edgesDS },
      getGraphOpts()
    );
  }

  // reset all highlights back to default
  resetHighlights() {
    for (let n of this.nodesDS.get()) {
      if (n.id === '__start__') continue;
      let isTrap = n._isTrap;
      let isAcc = n._isAccept;
      let isSt = n._isStart;
      this.nodesDS.update({
        id: n.id,
        color: {
          background: isTrap ? COLORS.trap.bg : (isSt ? COLORS.start.bg : COLORS.node.bg),
          border: isTrap ? COLORS.trap.border
            : (isAcc ? COLORS.accept.border : (isSt ? COLORS.start.border : COLORS.node.border)),
        },
        font: {
          color: isTrap ? COLORS.trap.font : (isSt ? COLORS.start.font : COLORS.node.font),
        },
      });
    }
    for (let e of this.edgesDS.get()) {
      this.edgesDS.update({ id: e.id, color: { color: COLORS.edge }, width: 1.8 });
    }
  }

  // add a dfa state node to the graph
  addState(label, isAccept, isStart, highlight) {
    if (this.added.has(label)) return;
    this.added.add(label);

    let isTrap = (label === '∅');

    let bg = highlight
      ? (isTrap ? COLORS.trap.bg : COLORS.newState.bg)
      : (isTrap ? COLORS.trap.bg : (isStart ? COLORS.start.bg : COLORS.node.bg));

    let border = highlight
      ? (isTrap ? COLORS.trap.border : COLORS.newState.border)
      : (isTrap ? COLORS.trap.border
        : (isAccept ? COLORS.accept.border
          : (isStart ? COLORS.start.border : COLORS.node.border)));

    let fontClr = highlight
      ? (isTrap ? COLORS.trap.font : COLORS.newState.font)
      : (isTrap ? COLORS.trap.font : (isStart ? COLORS.start.font : COLORS.node.font));

    this.nodesDS.add({
      id: label, label: label,
      shape: isAccept ? 'doublecircle' : 'circle',
      size: isAccept ? 25 : 30,
      borderWidth: isAccept ? 4 : 2,
      _isAccept: isAccept, _isTrap: isTrap, _isStart: isStart,
      color: { background: bg, border: border },
      font: { color: fontClr },
    });

    // draw start arrow
    if (isStart) {
      this.edgesDS.add({
        id: '__start_edge__', from: '__start__', to: label,
        color: { color: COLORS.start.border }, width: 2, smooth: false
      });
    }
  }

  // add edge, merge labels if edge already exists (no overlapping edges)
  addTransition(from, sym, to, highlight) {
    let key = from + '→' + to;

    if (this.edgeMap.has(key)) {
      // merge into existing edge
      let eid = this.edgeMap.get(key);
      let existing = this.edgesDS.get(eid);
      let labels = existing.label.split(', ');
      if (!labels.includes(sym)) {
        labels.push(sym);
        this.edgesDS.update({
          id: eid, label: labels.join(', '),
          color: { color: highlight ? COLORS.edgeNew : COLORS.edge },
          width: highlight ? 2.8 : 1.8,
        });
      }
    } else {
      // new edge
      let eid = 'e_' + (this._eid++);
      let rev = this.edgeMap.has(to + '→' + from);
      this.edgesDS.add({
        id: eid, from, to, label: sym,
        color: { color: highlight ? COLORS.edgeNew : COLORS.edge },
        width: highlight ? 2.8 : 1.8,
        smooth: getSmooth(from, to, rev),
      });
      this.edgeMap.set(key, eid);
    }
  }

  // highlight one state as active (gold)
  highlightState(label) {
    this.resetHighlights();
    if (!this.added.has(label)) return;
    this.nodesDS.update({
      id: label,
      color: { background: COLORS.active.bg, border: COLORS.active.border },
      font: { color: COLORS.active.font },
    });
  }

  // fit view to show everything
  fit() {
    this.network.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
  }

  destroy() {
    if (this.network) this.network.destroy();
  }
}
