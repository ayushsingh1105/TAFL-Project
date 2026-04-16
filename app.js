(function () {
    'use strict';

    const { DFA, DFAVisualizer, SAMPLES, PARTITION_COLORS } = window.DFAApp;

    /* ============================================================
       STATE
       ============================================================ */
    const state = {
        dfa:            null,   // current DFA instance
        minimization:   null,   // { steps, minimizedDFA, finalPartition }
        currentStep:    0,
        isPlaying:      false,
        playTimer:      null,
        originalViz:    new DFAVisualizer('#originalSvg'),
        minimizedViz:   new DFAVisualizer('#minimizedSvg'),
    };

    /* ============================================================
       DOM REFERENCES
       ============================================================ */
    const $ = id => document.getElementById(id);

    const dom = {
        sampleSelect:       $('sampleSelect'),
        statesInput:        $('statesInput'),
        alphabetInput:      $('alphabetInput'),
        startStateSelect:   $('startStateSelect'),
        acceptStatesInput:  $('acceptStatesInput'),
        transitionTableWrap:$('transitionTableWrap'),
        generateTableBtn:   $('generateTableBtn'),
        visualizeBtn:       $('visualizeBtn'),
        minimizeBtn:        $('minimizeBtn'),
        resetBtn:           $('resetBtn'),
        errorMessage:       $('errorMessage'),
        toggleInputBtn:     $('toggleInputBtn'),
        inputPanel:         $('inputPanel'),

        vizPanel:           $('vizPanel'),
        vizContainer:       $('vizContainer'),
        tabOriginal:        $('tabOriginal'),
        tabMinimized:       $('tabMinimized'),
        originalGraphArea:  $('originalGraphArea'),
        minimizedGraphArea: $('minimizedGraphArea'),
        originalPlaceholder:$('originalPlaceholder'),
        partitionLegend:    $('partitionLegend'),

        stepsPanel:         $('stepsPanel'),
        stepCounter:        $('stepCounter'),
        stepFirst:          $('stepFirst'),
        stepPrev:           $('stepPrev'),
        stepPlay:           $('stepPlay'),
        stepNext:           $('stepNext'),
        stepLast:           $('stepLast'),
        speedSlider:        $('speedSlider'),
        speedValue:         $('speedValue'),
        stepProgressBar:    $('stepProgressBar'),
        stepTypeBadge:      $('stepTypeBadge'),
        stepExplanationText:$('stepExplanationText'),
        partitionDisplay:   $('partitionDisplay'),
        stepDetails:        $('stepDetails'),

        resultsPanel:       $('resultsPanel'),
        originalStateCount: $('originalStateCount'),
        minimizedStateCount:$('minimizedStateCount'),
        statesReduced:      $('statesReduced'),
        stateMappingWrap:   $('stateMappingWrap'),
        minimizedTableWrap: $('minimizedTableWrap'),
        exportJsonBtn:      $('exportJsonBtn'),
        exportPngBtn:       $('exportPngBtn'),
    };

    /* ============================================================
       INITIALISATION
       ============================================================ */
    function init() {
        populateSamples();
        bindEvents();

        // Load first sample by default for a nice first impression
        if (SAMPLES.length) {
            dom.sampleSelect.value = '0';
            loadSample(0);
        }
    }

    /* ============================================================
       SAMPLE HANDLING
       ============================================================ */
    function populateSamples() {
        SAMPLES.forEach((sample, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = sample.name;
            dom.sampleSelect.appendChild(opt);
        });
    }

    function loadSample(index) {
        const s = SAMPLES[index];
        if (!s) return;

        dom.statesInput.value       = s.states.join(', ');
        dom.alphabetInput.value     = s.alphabet.join(', ');
        dom.acceptStatesInput.value = s.acceptStates.join(', ');

        populateStartStateDropdown(s.states, s.startState);
        generateTransitionTable(s.states, s.alphabet, s.transitions);

        dom.visualizeBtn.disabled = false;
        hideError();
    }

    /* ============================================================
       FORM HELPERS
       ============================================================ */
    function parseCSV(str) {
        return str.split(',').map(s => s.trim()).filter(Boolean);
    }

    function populateStartStateDropdown(states, selected) {
        dom.startStateSelect.innerHTML = '<option value="">—</option>';
        states.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s; opt.textContent = s;
            if (s === selected) opt.selected = true;
            dom.startStateSelect.appendChild(opt);
        });
    }

    /** Generate the editable transition-table grid. */
    function generateTransitionTable(states, alphabet, existingTransitions) {
        if (!states.length || !alphabet.length) {
            dom.transitionTableWrap.innerHTML =
                '<p class="placeholder-text">Enter states & alphabet first.</p>';
            return;
        }

        let html = '<table><thead><tr><th>State</th>';
        alphabet.forEach(sym => { html += `<th>δ(·, ${sym})</th>`; });
        html += '</tr></thead><tbody>';

        states.forEach(st => {
            html += `<tr><td>${st}</td>`;
            alphabet.forEach(sym => {
                const current = existingTransitions && existingTransitions[st]
                    ? (existingTransitions[st][sym] || '')
                    : '';
                html += '<td><select class="cell-select" data-state="' + st +
                        '" data-symbol="' + sym + '">';
                html += '<option value="">—</option>';
                states.forEach(s2 => {
                    html += `<option value="${s2}" ${s2 === current ? 'selected' : ''}>${s2}</option>`;
                });
                html += '</select></td>';
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        dom.transitionTableWrap.innerHTML = html;
    }

    /** Read transitions from the generated table selects. */
    function readTransitionsFromTable() {
        const trans = {};
        dom.transitionTableWrap.querySelectorAll('.cell-select').forEach(sel => {
            const st  = sel.dataset.state;
            const sym = sel.dataset.symbol;
            if (!trans[st]) trans[st] = {};
            trans[st][sym] = sel.value || null;
        });
        return trans;
    }

    /* ============================================================
       BUILD DFA FROM FORM
       ============================================================ */
    function buildDFAFromForm() {
        const states      = parseCSV(dom.statesInput.value);
        const alphabet    = parseCSV(dom.alphabetInput.value);
        const startState  = dom.startStateSelect.value;
        const acceptStates= parseCSV(dom.acceptStatesInput.value);
        const transitions = readTransitionsFromTable();

        return new DFA(states, alphabet, transitions, startState, acceptStates);
    }

    /* ============================================================
       ERROR DISPLAY
       ============================================================ */
    function showError(messages) {
        dom.errorMessage.innerHTML = messages.map(m => `• ${m}`).join('<br>');
        dom.errorMessage.classList.add('visible');
    }
    function hideError() {
        dom.errorMessage.classList.remove('visible');
    }

    /* ============================================================
       VISUALIZE (render original DFA)
       ============================================================ */
    function visualize() {
        hideError();
        const dfa = buildDFAFromForm();
        const { valid, errors } = dfa.validate();

        if (!valid) { showError(errors); return; }

        state.dfa = dfa;
        state.minimization = null;
        state.currentStep = 0;
        stopPlaying();

        // Hide minimized panel, steps, results
        dom.stepsPanel.classList.add('hidden');
        dom.resultsPanel.classList.add('hidden');
        dom.tabMinimized.disabled = true;
        switchTab('original');

        // Show placeholder off, render graph
        dom.originalPlaceholder.style.display = 'none';
        state.originalViz.render(dfa);

        dom.minimizeBtn.disabled = false;
    }

    /* ============================================================
       MINIMIZE
       ============================================================ */
    function minimize() {
        if (!state.dfa) return;
        hideError();

        const result = state.dfa.minimize();
        state.minimization = result;
        state.currentStep  = 0;

        // Show steps panel
        dom.stepsPanel.classList.remove('hidden');

        // Render first step
        renderStep(0);
    }

    /* ============================================================
       STEP RENDERING
       ============================================================ */
    function renderStep(index) {
        const { steps, minimizedDFA } = state.minimization;
        if (index < 0 || index >= steps.length) return;

        state.currentStep = index;
        const step = steps[index];

        // Counter
        dom.stepCounter.textContent = `Step ${index + 1} / ${steps.length}`;

        // Progress bar
        const pct = ((index + 1) / steps.length) * 100;
        dom.stepProgressBar.style.width = pct + '%';

        // Type badge
        dom.stepTypeBadge.textContent = step.type;
        dom.stepTypeBadge.className = 'step-type-badge ' + step.type;

        // Explanation
        dom.stepExplanationText.textContent = step.explanation;

        // Partition display
        if (step.partition) {
            renderPartitionBadges(step.partition);
            state.originalViz.updatePartitionColors(step.partition);
            renderPartitionLegend(step.partition);
        }

        // Split details
        if (step.splitDetails && step.splitDetails.length) {
            dom.stepDetails.innerHTML = step.splitDetails.map(d =>
                `<div class="split-reason">` +
                `<strong>Split {${d.originalGroup.join(', ')}}</strong><br>` +
                (d.reason || '').replace(/\n/g, '<br>') +
                `</div>`
            ).join('');
        } else {
            dom.stepDetails.innerHTML = '';
        }

        // On the RESULT step, show minimized DFA + results panel
        if (step.type === 'result') {
            showResults(step, minimizedDFA);
        } else {
            dom.resultsPanel.classList.add('hidden');
            dom.tabMinimized.disabled = true;
        }
    }

    /* ---- Partition badges ---- */
    function renderPartitionBadges(partition) {
        dom.partitionDisplay.innerHTML = partition.map((group, idx) => {
            const color = PARTITION_COLORS[idx % PARTITION_COLORS.length];
            return `<div class="partition-group" style="--group-color:${color}; animation-delay:${idx * 60}ms">
                <span class="group-label">G${idx + 1}</span>
                ${group.map(s => `<span class="state-badge">${s}</span>`).join('')}
            </div>`;
        }).join('');
    }

    /* ---- Partition legend ---- */
    function renderPartitionLegend(partition) {
        dom.partitionLegend.innerHTML = partition.map((group, idx) => {
            const color = PARTITION_COLORS[idx % PARTITION_COLORS.length];
            return `<span class="legend-item" style="animation-delay:${idx * 50}ms">
                <span class="legend-dot" style="background:${color}"></span>
                {${group.join(', ')}}
            </span>`;
        }).join('');
    }

    /* ============================================================
       RESULTS PANEL
       ============================================================ */
    function showResults(step, minimizedDFA) {
        dom.resultsPanel.classList.remove('hidden');

        // Stats
        const origCount = state.dfa.states.length;
        const minCount  = minimizedDFA.states.length;
        dom.originalStateCount.textContent  = origCount;
        dom.minimizedStateCount.textContent = minCount;
        dom.statesReduced.textContent       = origCount - minCount;

        // State mapping table
        if (step.stateMapping) {
            let html = '<table class="result-table"><thead><tr><th>Original</th><th>→</th><th>New State</th></tr></thead><tbody>';
            step.stateMapping.forEach(m => {
                html += `<tr>
                    <td>${m.oldState}</td><td>→</td>
                    <td class="merged-group">${m.newState}</td></tr>`;
            });
            html += '</tbody></table>';
            dom.stateMappingWrap.innerHTML = html;
        }

        // Minimized transition table
        {
            let html = '<table class="result-table"><thead><tr><th>State</th>';
            minimizedDFA.alphabet.forEach(sym => { html += `<th>δ(·, ${sym})</th>`; });
            html += '</tr></thead><tbody>';
            minimizedDFA.states.forEach(st => {
                const isStart  = st === minimizedDFA.startState;
                const isAccept = minimizedDFA.acceptStates.includes(st);
                const cls = isStart ? 'state-start' : (isAccept ? 'state-accept' : '');
                const prefix = (isStart ? '→ ' : '') + (isAccept ? '* ' : '');
                html += `<tr><td class="${cls}">${prefix}${st}</td>`;
                minimizedDFA.alphabet.forEach(sym => {
                    const tgt = minimizedDFA.getTransition(st, sym);
                    html += `<td>${tgt || '—'}</td>`;
                });
                html += '</tr>';
            });
            html += '</tbody></table>';
            dom.minimizedTableWrap.innerHTML = html;
        }

        // Enable minimized tab & render that graph
        dom.tabMinimized.disabled = false;
        state.minimizedViz.render(minimizedDFA);
        state.minimizedViz.updatePartitionColors(
            minimizedDFA.states.map(s => [s])  // each state is its own group
        );
    }

    /* ============================================================
       TAB SWITCHING
       ============================================================ */
    function switchTab(tabName) {
        dom.tabOriginal.classList.toggle('active', tabName === 'original');
        dom.tabMinimized.classList.toggle('active', tabName === 'minimized');
        dom.originalGraphArea.classList.toggle('active', tabName === 'original');
        dom.minimizedGraphArea.classList.toggle('active', tabName === 'minimized');
    }

    /* ============================================================
       STEP NAVIGATION
       ============================================================ */
    function goFirst() { renderStep(0); }
    function goPrev()  { renderStep(Math.max(0, state.currentStep - 1)); }
    function goNext()  {
        const max = state.minimization.steps.length - 1;
        renderStep(Math.min(max, state.currentStep + 1));
        if (state.currentStep >= max) stopPlaying();
    }
    function goLast()  { renderStep(state.minimization.steps.length - 1); }

    function togglePlay() {
        if (state.isPlaying) { stopPlaying(); }
        else { startPlaying(); }
    }
    function startPlaying() {
        state.isPlaying = true;
        dom.stepPlay.textContent = '⏸';
        dom.stepPlay.classList.add('playing');
        const speedMs = [2000, 1500, 1000, 600, 350][parseInt(dom.speedSlider.value) - 1];
        state.playTimer = setInterval(() => goNext(), speedMs);
    }
    function stopPlaying() {
        state.isPlaying = false;
        dom.stepPlay.textContent = '▶';
        dom.stepPlay.classList.remove('playing');
        if (state.playTimer) { clearInterval(state.playTimer); state.playTimer = null; }
    }

    /* ============================================================
       EXPORT
       ============================================================ */
    function exportJSON() {
        if (!state.minimization || !state.minimization.minimizedDFA) return;
        const dfa = state.minimization.minimizedDFA;
        const data = {
            states:       dfa.states,
            alphabet:     dfa.alphabet,
            transitions:  dfa.transitions,
            startState:   dfa.startState,
            acceptStates: dfa.acceptStates
        };
        download('minimized_dfa.json', JSON.stringify(data, null, 2), 'application/json');
    }

    function exportPNG() {
        // Determine which SVG is active
        const isMinTab = dom.tabMinimized.classList.contains('active');
        const svgEl = document.querySelector(isMinTab ? '#minimizedSvg' : '#originalSvg');
        if (!svgEl) return;

        const svgData = new XMLSerializer().serializeToString(svgEl);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url     = URL.createObjectURL(svgBlob);

        const canvas = document.createElement('canvas');
        const ctx    = canvas.getContext('2d');
        const img    = new Image();

        img.onload = () => {
            canvas.width  = img.width * 2;
            canvas.height = img.height * 2;
            ctx.fillStyle = '#0d0d1a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);

            canvas.toBlob(blob => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = isMinTab ? 'minimized_dfa.png' : 'original_dfa.png';
                a.click();
            }, 'image/png');
        };
        img.src = url;
    }

    function download(filename, content, mime) {
        const blob = new Blob([content], { type: mime });
        const a    = document.createElement('a');
        a.href     = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
    }

    /* ============================================================
       RESET
       ============================================================ */
    function resetAll() {
        stopPlaying();
        state.dfa          = null;
        state.minimization = null;
        state.currentStep  = 0;

        state.originalViz.clear();
        state.minimizedViz.clear();

        dom.statesInput.value       = '';
        dom.alphabetInput.value     = '';
        dom.acceptStatesInput.value = '';
        dom.startStateSelect.innerHTML = '<option value="">—</option>';
        dom.sampleSelect.value = '';
        dom.transitionTableWrap.innerHTML =
            '<p class="placeholder-text">Enter states & alphabet, then click <em>Generate Table</em>.</p>';

        dom.originalPlaceholder.style.display = '';
        dom.visualizeBtn.disabled  = true;
        dom.minimizeBtn.disabled   = true;
        dom.tabMinimized.disabled  = true;
        switchTab('original');

        dom.stepsPanel.classList.add('hidden');
        dom.resultsPanel.classList.add('hidden');
        dom.partitionLegend.innerHTML = '';
        hideError();
    }

    /* ============================================================
       EVENT BINDING
       ============================================================ */
    function bindEvents() {
        // Sample selector
        dom.sampleSelect.addEventListener('change', e => {
            if (e.target.value !== '') loadSample(parseInt(e.target.value));
        });

        // Generate transition table from current inputs
        dom.generateTableBtn.addEventListener('click', () => {
            const states   = parseCSV(dom.statesInput.value);
            const alphabet = parseCSV(dom.alphabetInput.value);
            if (!states.length || !alphabet.length) {
                showError(['Provide at least one state and one alphabet symbol.']);
                return;
            }
            hideError();
            populateStartStateDropdown(states, dom.startStateSelect.value);
            generateTransitionTable(states, alphabet, null);
            dom.visualizeBtn.disabled = false;
        });

        // Auto-update start-state dropdown when states change
        dom.statesInput.addEventListener('change', () => {
            const states = parseCSV(dom.statesInput.value);
            populateStartStateDropdown(states, dom.startStateSelect.value);
        });

        // Main action buttons
        dom.visualizeBtn.addEventListener('click', visualize);
        dom.minimizeBtn.addEventListener('click', minimize);
        dom.resetBtn.addEventListener('click', resetAll);

        // Tabs
        dom.tabOriginal.addEventListener('click', () => switchTab('original'));
        dom.tabMinimized.addEventListener('click', () => {
            if (!dom.tabMinimized.disabled) switchTab('minimized');
        });

        // Step navigation
        dom.stepFirst.addEventListener('click', goFirst);
        dom.stepPrev.addEventListener('click', goPrev);
        dom.stepPlay.addEventListener('click', togglePlay);
        dom.stepNext.addEventListener('click', goNext);
        dom.stepLast.addEventListener('click', goLast);

        // Speed slider
        dom.speedSlider.addEventListener('input', e => {
            dom.speedValue.textContent = e.target.value + '×';
            // If currently playing, restart with new speed
            if (state.isPlaying) { stopPlaying(); startPlaying(); }
        });

        // Toggle sidebar collapse
        dom.toggleInputBtn.addEventListener('click', () => {
            dom.inputPanel.classList.toggle('collapsed');
            // Re-render graphs after layout change
            setTimeout(() => {
                if (state.dfa) state.originalViz.render(state.dfa);
                if (state.minimization && state.minimization.minimizedDFA) {
                    state.minimizedViz.render(state.minimization.minimizedDFA);
                }
                // Re-apply partition colours for current step
                if (state.minimization && state.minimization.steps[state.currentStep]) {
                    const step = state.minimization.steps[state.currentStep];
                    if (step.partition) state.originalViz.updatePartitionColors(step.partition);
                }
            }, 500);
        });

        // Export
        dom.exportJsonBtn.addEventListener('click', exportJSON);
        dom.exportPngBtn.addEventListener('click', exportPNG);

        // Keyboard shortcuts
        document.addEventListener('keydown', e => {
            if (!state.minimization) return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
            switch (e.key) {
                case 'ArrowLeft':  e.preventDefault(); goPrev(); break;
                case 'ArrowRight': e.preventDefault(); goNext(); break;
                case ' ':          e.preventDefault(); togglePlay(); break;
                case 'Home':       e.preventDefault(); goFirst(); break;
                case 'End':        e.preventDefault(); goLast(); break;
            }
        });

        // Responsive: re-render on resize (debounced)
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (state.dfa) {
                    state.originalViz.render(state.dfa);
                    if (state.minimization) {
                        const step = state.minimization.steps[state.currentStep];
                        if (step && step.partition) state.originalViz.updatePartitionColors(step.partition);
                    }
                }
                if (state.minimization && state.minimization.minimizedDFA) {
                    state.minimizedViz.render(state.minimization.minimizedDFA);
                }
            }, 300);
        });
    }

    /* ============================================================
       BOOT
       ============================================================ */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
