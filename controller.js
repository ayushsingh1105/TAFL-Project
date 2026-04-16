// controller.js - connects the DFAConverter engine with the UI
// handles input parsing, validation, step controls, and rendering

(function () {
  'use strict';

  // grab all DOM elements
  const $ = (sel) => document.querySelector(sel);
  const el = {
    form:         $('#nfaForm'),
    states:       $('#inputStates'),
    alphabet:     $('#inputAlphabet'),
    transitions:  $('#inputTransitions'),
    startState:   $('#inputStart'),
    acceptStates: $('#inputAccept'),
    errorBox:     $('#errorBox'),
    btnConvert:   $('#btnConvert'),
    btnExample:   $('#btnLoadExample'),
    btnNext:      $('#btnNextStep'),
    btnAuto:      $('#btnAutoPlay'),
    btnReset:     $('#btnReset'),
    controls:     $('#controlPanel'),
    graphs:       $('#graphSection'),
    expPanel:     $('#explanationPanel'),
    stepExp:      $('#step-explanation'),
    tablePanel:   $('#tablePanel'),
    tableWrap:    $('#tableWrapper'),
    stepCount:    $('#stepCounter'),
    nfaBox:       $('#nfaCanvas'),
    dfaBox:       $('#dfaCanvas'),
  };

  // app state
  let nfa = null;
  let dfa = null;
  let steps = [];
  let currStep = 0;
  let autoTimer = null;
  let nfaNet = null;
  let dfaViz = null;

  // ---- input parsing helpers ----

  // split comma-separated values, trim whitespace
  function splitCSV(str) {
    return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  // parse transition lines, each line: "source, symbol, dest"
  function parseTrans(text) {
    let lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let res = [];

    for (let i = 0; i < lines.length; i++) {
      let parts = lines[i].split(',').map(p => p.trim());
      if (parts.length !== 3 || parts.some(p => p === '')) {
        throw new Error(`Line ${i + 1} invalid: "${lines[i]}". Use: source, symbol, dest`);
      }
      res.push({ from: parts[0], symbol: parts[1], to: parts[2] });
    }
    return res;
  }

  // ---- build and validate NFA from form inputs ----

  function buildNFA() {
    let states = splitCSV(el.states.value);
    let rawAlpha = splitCSV(el.alphabet.value);
    let start = el.startState.value.trim();
    let accept = splitCSV(el.acceptStates.value);

    // filter out eps from alphabet
    let alpha = rawAlpha.filter(a => a !== 'eps');

    if (states.length === 0) throw new Error('States cannot be empty.');
    if (alpha.length === 0) throw new Error('Alphabet cannot be empty (don\'t include "eps").');
    if (!start) throw new Error('Start state is required.');
    if (!states.includes(start)) throw new Error(`Start state "${start}" not in states.`);
    for (let a of accept) {
      if (!states.includes(a)) throw new Error(`Accept state "${a}" not in states.`);
    }

    // build transition map
    let rawTrans = parseTrans(el.transitions.value);
    let trans = {};
    for (let s of states) trans[s] = {};

    for (let t of rawTrans) {
      if (!states.includes(t.from)) throw new Error(`Unknown source state "${t.from}".`);
      if (!states.includes(t.to)) throw new Error(`Unknown dest state "${t.to}".`);
      if (t.symbol !== 'eps' && !alpha.includes(t.symbol))
        throw new Error(`Unknown symbol "${t.symbol}".`);

      if (!trans[t.from][t.symbol]) trans[t.from][t.symbol] = [];
      if (!trans[t.from][t.symbol].includes(t.to)) {
        trans[t.from][t.symbol].push(t.to);
      }
    }
    // console.log("parsed NFA:", { states, alpha, trans, start, accept });

    return { states, alphabet: alpha, transitions: trans, start, accept };
  }

  // ---- error display ----

  function showErr(msg) { el.errorBox.textContent = msg; el.errorBox.hidden = false; }
  function hideErr() { el.errorBox.hidden = true; el.errorBox.textContent = ''; }

  // ---- render the DFA transition table ----

  function renderTable() {
    if (!dfa) return;

    let { alphabet, states: dfaStates, transitions: dfaTr, start, accept, stateMap } = dfa;

    let html = '<table id="dfaTransitionTable"><thead><tr><th>DFA State</th>';
    for (let sym of alphabet) html += `<th>δ(·, ${sym})</th>`;
    html += '</tr></thead><tbody>';

    for (let state of dfaStates) {
      let isSt = (state === start);
      let isAcc = accept.includes(state);
      let cls = '';
      if (isSt) cls += ' row-start';
      if (isAcc) cls += ' row-accept';

      let nfaInfo = stateMap[state] ? stateMap[state].nfaStates.join(',') : '';
      html += `<tr class="${cls.trim()}">`;
      html += `<td title="NFA subset: {${nfaInfo}}">${isSt ? '→ ' : ''}${state}</td>`;

      for (let sym of alphabet) {
        let target = (dfaTr[state] && dfaTr[state][sym]) ? dfaTr[state][sym] : '—';
        html += `<td>${target}</td>`;
      }
      html += '</tr>';
    }

    html += '</tbody></table>';
    el.tableWrap.innerHTML = html;
  }

  // ---- render step explanation text ----

  function renderExp(step) {
    let html = '';

    switch (step.type) {
      case 'init':
        html = `
          <div class="step-highlight fade-in">
            <strong>Step: Initialization</strong><br/>
            ${step.detail.message}<br/>
            ε-closure({${nfa.start}}) = {${step.detail.closure.join(', ')}} → DFA start state = <code>${step.detail.label}</code>
          </div>
          <p class="fade-in-delay-1">
            <strong>What is ε-closure?</strong> The ε-closure of a state is the set of all states 
            reachable from it by following zero or more ε-transitions (including itself).
            This is always the first step: we find every state the NFA could be in <em>before</em> 
            reading any input.
          </p>`;
        break;

      case 'process':
        html = `
          <div class="step-highlight fade-in">
            <strong>Step: Processing State</strong><br/>
            ${step.detail.message}
          </div>
          <p class="fade-in-delay-1">
            For each symbol in Σ = {${nfa.alphabet.join(', ')}}, we compute 
            <code>move(T, a)</code> then <code>ε-closure</code> of the result 
            to determine the target DFA state.
          </p>`;
        break;

      case 'transition':
        html = `
          <div class="step-highlight fade-in">
            <strong>Step: Computing Transition</strong><br/>
            ${step.detail.message}
          </div>`;
        if (step.detail.isTrap) {
          html += `
            <p class="fade-in-delay-1">
              <strong>Dead/Trap State (∅):</strong> No NFA states are reachable for this symbol.
              This creates the trap state ∅ which self-loops on every symbol, 
              ensuring the DFA is <em>total</em> (every state has a transition for every symbol).
            </p>`;
        } else if (step.detail.isNew) {
          html += `
            <p class="fade-in-delay-1">
              This is a <strong>new DFA state</strong>. It has been added to the processing queue 
              and will be expanded in a later step.
            </p>`;
        }
        break;

      case 'complete':
        html = `
          <div class="step-highlight complete fade-in">
            <strong>✅ Conversion Complete!</strong><br/>
            ${step.detail.message}
          </div>
          <p class="fade-in-delay-1">
            The DFA is fully constructed. Each DFA state is a unique subset of NFA states, 
            and every state has exactly one transition per symbol. 
            A DFA state is <em>accepting</em> if its subset contains any NFA accepting state.
          </p>`;
        break;
    }

    el.stepExp.innerHTML = html;
  }

  // ---- execute one step ----

  function runStep(idx) {
    if (idx >= steps.length) return;
    let step = steps[idx];

    // update explanation
    renderExp(step);

    // update dfa graph
    switch (step.type) {
      case 'init': {
        let isAcc = dfa.accept.includes(step.detail.label);
        dfaViz.addState(step.detail.label, isAcc, true, true);
        dfaViz.highlightState(step.detail.label);
        dfaViz.fit();
        break;
      }
      case 'process': {
        dfaViz.resetHighlights();
        dfaViz.highlightState(step.detail.state);
        break;
      }
      case 'transition': {
        let isAcc = dfa.accept.includes(step.detail.to);
        dfaViz.addState(step.detail.to, isAcc, false, step.detail.isNew);
        dfaViz.addTransition(step.detail.from, step.detail.symbol, step.detail.to, true);
        dfaViz.fit();
        break;
      }
      case 'complete': {
        dfaViz.resetHighlights();
        dfaViz.fit();
        renderTable();
        break;
      }
    }

    // update table progressively
    if (step.type !== 'complete') renderTable();

    el.stepCount.textContent = `Step ${idx + 1} / ${steps.length}`;

    // disable buttons when done
    if (idx + 1 >= steps.length) {
      el.btnNext.disabled = true;
      el.btnAuto.disabled = true;
      stopAuto();
    }
  }

  // ---- auto play controls ----

  function startAuto() {
    if (autoTimer) return;
    el.btnAuto.textContent = '⏸️ Pause';
    el.btnAuto.classList.replace('btn--outline', 'btn--primary');

    autoTimer = setInterval(() => {
      if (currStep >= steps.length) { stopAuto(); return; }
      runStep(currStep);
      currStep++;
    }, 1200);
  }

  function stopAuto() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    el.btnAuto.textContent = '▶️ Auto Play';
    el.btnAuto.classList.replace('btn--primary', 'btn--outline');
  }

  // ---- main convert handler ----

  function handleConvert() {
    hideErr();

    try {
      nfa = buildNFA();
    } catch (err) {
      showErr(err.message);
      return;
    }

    // run the engine
    let converter = new DFAConverter(nfa);
    let result = converter.convert();
    dfa = result.dfa;
    steps = result.steps;
    currStep = 0;

    // show ui panels
    el.controls.hidden = false;
    el.graphs.hidden = false;
    el.expPanel.hidden = false;
    el.tablePanel.hidden = false;
    el.controls.classList.add('fade-in');
    el.graphs.classList.add('fade-in');
    el.expPanel.classList.add('fade-in-delay-1');
    el.tablePanel.classList.add('fade-in-delay-2');

    // reset controls
    el.btnNext.disabled = false;
    el.btnAuto.disabled = false;
    stopAuto();

    el.stepExp.innerHTML =
      '<p class="explanation-placeholder">Click <strong>Next Step</strong> to begin the subset construction walkthrough.</p>';
    el.tableWrap.innerHTML =
      '<table id="dfaTransitionTable"><thead><tr><th>DFA State</th></tr></thead><tbody></tbody></table>';
    el.stepCount.textContent = `Step 0 / ${steps.length}`;

    // draw NFA graph
    if (nfaNet) nfaNet.destroy();
    nfaNet = renderNFA(nfa, el.nfaBox);

    // init DFA visualizer
    if (dfaViz) dfaViz.destroy();
    dfaViz = new DFAVisualizer(el.dfaBox, dfa.alphabet);

    el.graphs.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---- reset handler ----

  function handleReset() {
    stopAuto();
    nfa = null; dfa = null; steps = []; currStep = 0;

    if (nfaNet) { nfaNet.destroy(); nfaNet = null; }
    if (dfaViz) { dfaViz.destroy(); dfaViz = null; }

    el.controls.hidden = true;
    el.graphs.hidden = true;
    el.expPanel.hidden = true;
    el.tablePanel.hidden = true;
    hideErr();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---- load example handler ----

  function loadExample() {
    let sample = getSampleNFA();
    el.states.value = sample._raw.states;
    el.alphabet.value = sample._raw.alphabet;
    el.transitions.value = sample._raw.transitions;
    el.startState.value = sample._raw.start;
    el.acceptStates.value = sample._raw.accept;
    hideErr();
  }

  // ---- bind events ----

  el.form.addEventListener('submit', (e) => { e.preventDefault(); handleConvert(); });
  el.btnExample.addEventListener('click', loadExample);

  el.btnNext.addEventListener('click', () => {
    // console.log("next step clicked, currStep:", currStep);
    if (currStep < steps.length) { runStep(currStep); currStep++; }
  });

  el.btnAuto.addEventListener('click', () => {
    autoTimer ? stopAuto() : startAuto();
  });

  el.btnReset.addEventListener('click', handleReset);

})();
