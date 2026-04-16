/* ═══════════════════════════════════════════════════════════════════════
   NFA → DFA Visualizer — Stylesheet
   Dark theme · Glassmorphism · Grid / Flexbox Layout · Responsive
   ═══════════════════════════════════════════════════════════════════════ */

/* ─── CSS Custom Properties ──────────────────────────────────────────── */
:root {
  --bg-primary:    #0b0e17;
  --bg-card:       rgba(17, 21, 35, 0.75);
  --bg-card-hover: rgba(25, 30, 52, 0.85);
  --glass-border:  rgba(99, 102, 241, 0.18);
  --glass-shadow:  0 8px 32px rgba(0, 0, 0, 0.45);

  --accent-1: #818cf8;
  --accent-2: #6366f1;
  --accent-3: #4f46e5;
  --accent-glow: rgba(99, 102, 241, 0.35);

  --success:  #34d399;
  --danger:   #f87171;
  --warning:  #fbbf24;
  --info:     #60a5fa;

  --text-primary:   #e2e8f0;
  --text-secondary: #94a3b8;
  --text-muted:     #64748b;

  --font-sans:  'Inter', system-ui, -apple-system, sans-serif;
  --font-mono:  'JetBrains Mono', 'Fira Code', monospace;

  --radius:    12px;
  --radius-sm: 8px;
  --gap:       1.25rem;
}

/* ─── Reset & Base ───────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { font-size: 15px; scroll-behavior: smooth; }

body {
  font-family: var(--font-sans);
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.6;
  min-height: 100vh;
  background-image:
    radial-gradient(ellipse 80% 60% at 50% -20%, rgba(99,102,241,0.12), transparent),
    radial-gradient(ellipse 60% 50% at 80% 110%, rgba(139,92,246,0.08), transparent);
}

/* ─── Hero Header ────────────────────────────────────────────────────── */
.hero {
  text-align: center;
  padding: 3rem 1.5rem 2rem;
}
.hero__badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--accent-1);
  background: rgba(99,102,241,0.12);
  border: 1px solid rgba(99,102,241,0.25);
  border-radius: 100px;
  padding: 0.3em 1em;
  margin-bottom: 1rem;
}
.hero__title {
  font-size: clamp(2rem, 5vw, 3.2rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.15;
}
.hero__accent {
  background: linear-gradient(135deg, var(--accent-1), #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.hero__subtitle {
  margin-top: 0.5rem;
  color: var(--text-secondary);
  font-size: 1rem;
}

/* ─── App Container ──────────────────────────────────────────────────── */
.app {
  max-width: 1320px;
  margin: 0 auto;
  padding: 0 1.5rem 3rem;
  display: flex;
  flex-direction: column;
  gap: var(--gap);
}

/* ─── Glass Card ─────────────────────────────────────────────────────── */
.card {
  background: var(--bg-card);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  padding: 1.75rem;
  box-shadow: var(--glass-shadow);
  transition: background 0.3s, border-color 0.3s;
}
.card:hover {
  background: var(--bg-card-hover);
  border-color: rgba(99,102,241,0.3);
}
.card__heading {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 1.25rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.card__heading .icon { font-size: 1.25rem; }

/* ─── Form Fields ────────────────────────────────────────────────────── */
.field { margin-bottom: 1rem; }

.field label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.35rem;
  color: var(--text-secondary);
}
.field__hint {
  font-weight: 400;
  color: var(--text-muted);
  font-size: 0.78rem;
}
.field__hint code {
  font-family: var(--font-mono);
  background: rgba(99,102,241,0.12);
  padding: 0.1em 0.4em;
  border-radius: 4px;
  font-size: 0.76rem;
  color: var(--accent-1);
}

input[type="text"],
textarea {
  width: 100%;
  background: rgba(15,18,30,0.7);
  border: 1px solid rgba(99,102,241,0.2);
  border-radius: var(--radius-sm);
  padding: 0.65rem 0.85rem;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.88rem;
  transition: border-color 0.25s, box-shadow 0.25s;
  outline: none;
}
input[type="text"]:focus,
textarea:focus {
  border-color: var(--accent-2);
  box-shadow: 0 0 0 3px var(--accent-glow);
}
textarea { resize: vertical; }

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

/* ─── Error Box ──────────────────────────────────────────────────────── */
.error-box {
  background: rgba(248,113,113,0.1);
  border: 1px solid rgba(248,113,113,0.35);
  color: var(--danger);
  border-radius: var(--radius-sm);
  padding: 0.7rem 1rem;
  font-size: 0.85rem;
  margin-bottom: 1rem;
  animation: fadeIn 0.3s ease;
}

/* ─── Buttons ────────────────────────────────────────────────────────── */
.btn-group {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.btn-group--controls { justify-content: center; }

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1.2rem;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.25s, background 0.25s, opacity 0.25s;
  outline: none;
}
.btn:active { transform: scale(0.96); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

.btn--primary {
  background: linear-gradient(135deg, var(--accent-2), var(--accent-3));
  color: #fff;
  box-shadow: 0 4px 14px rgba(99,102,241,0.35);
}
.btn--primary:hover:not(:disabled) { box-shadow: 0 6px 20px rgba(99,102,241,0.5); }

.btn--accent {
  background: linear-gradient(135deg, #34d399, #059669);
  color: #fff;
  box-shadow: 0 4px 14px rgba(52,211,153,0.3);
}
.btn--accent:hover:not(:disabled) { box-shadow: 0 6px 20px rgba(52,211,153,0.45); }

.btn--ghost {
  background: rgba(99,102,241,0.08);
  color: var(--accent-1);
  border: 1px solid rgba(99,102,241,0.25);
}
.btn--ghost:hover:not(:disabled) { background: rgba(99,102,241,0.15); }

.btn--outline {
  background: transparent;
  color: var(--accent-1);
  border: 1px solid var(--accent-2);
}
.btn--outline:hover:not(:disabled) { background: rgba(99,102,241,0.1); }

.btn--danger {
  background: rgba(248,113,113,0.12);
  color: var(--danger);
  border: 1px solid rgba(248,113,113,0.3);
}
.btn--danger:hover:not(:disabled) { background: rgba(248,113,113,0.22); }

/* ─── Step Counter ───────────────────────────────────────────────────── */
.step-counter {
  text-align: center;
  margin-top: 0.75rem;
  font-family: var(--font-mono);
  font-size: 0.82rem;
  color: var(--text-muted);
}

/* ─── Graph Section (CSS Grid, 2 columns) ────────────────────────────── */
.graph-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--gap);
}

.graph-container {
  background: var(--bg-card);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--glass-shadow);
}

.graph-label {
  text-align: center;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent-1);
  padding: 0.65rem 0 0;
}

.graph-canvas {
  width: 100%;
  height: 400px;
}

/* ─── Explanation Panel ──────────────────────────────────────────────── */
.explanation-content {
  font-size: 0.92rem;
  line-height: 1.75;
  color: var(--text-secondary);
}
.explanation-content strong { color: var(--text-primary); }
.explanation-content code {
  font-family: var(--font-mono);
  background: rgba(99,102,241,0.1);
  padding: 0.15em 0.45em;
  border-radius: 4px;
  font-size: 0.84rem;
  color: var(--accent-1);
}
.explanation-placeholder {
  color: var(--text-muted);
  font-style: italic;
}

.step-highlight {
  background: rgba(99,102,241,0.07);
  border-left: 3px solid var(--accent-2);
  padding: 0.75rem 1rem;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  margin: 0.75rem 0;
}
.step-highlight.complete {
  border-left-color: var(--success);
}

/* ─── Transition Table ───────────────────────────────────────────────── */
.table-wrapper { overflow-x: auto; }

.table-wrapper table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-mono);
  font-size: 0.82rem;
}
.table-wrapper th,
.table-wrapper td {
  padding: 0.55rem 0.8rem;
  text-align: center;
  border: 1px solid rgba(99,102,241,0.15);
}
.table-wrapper th {
  background: rgba(99,102,241,0.12);
  color: var(--accent-1);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.76rem;
  position: sticky;
  top: 0;
}
.table-wrapper td { color: var(--text-secondary); }
.table-wrapper tr:hover td { background: rgba(99,102,241,0.05); }

/* Start state marker */
.table-wrapper .row-start td:first-child { color: var(--success); font-weight: 700; }
/* Accept state marker */
.table-wrapper .row-accept td:first-child::after {
  content: ' ★';
  color: var(--warning);
}

/* ─── Footer ─────────────────────────────────────────────────────────── */
.footer {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--text-muted);
  font-size: 0.78rem;
  letter-spacing: 0.02em;
}

/* ─── Animations ─────────────────────────────────────────────────────── */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fade-in          { animation: fadeIn 0.4s ease both; }
.fade-in-delay-1  { animation: fadeIn 0.4s 0.1s ease both; }
.fade-in-delay-2  { animation: fadeIn 0.4s 0.2s ease both; }

/* ─── Responsive ─────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .graph-section { grid-template-columns: 1fr; }
  .field-row     { grid-template-columns: 1fr; }
  .hero__title   { font-size: 1.8rem; }
  .card          { padding: 1.25rem; }
  .graph-canvas  { height: 320px; }
}
@media (max-width: 480px) {
  html { font-size: 14px; }
  .btn-group { flex-direction: column; }
  .btn { width: 100%; justify-content: center; }
}
