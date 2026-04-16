/* ===================================================================
   visualizer.js — D3.js-based DFA Graph Renderer
   
   Renders a DFA as a force-directed state diagram inside an SVG.
   Features:
     • Force-directed node layout with drag & zoom
     • Self-loops, curved bi-directional edges
     • Merged edge labels (a, b)
     • Start-state arrow, double-circle accept states
     • Partition-based colour coding with smooth transitions
   =================================================================== */

window.DFAApp = window.DFAApp || {};

class DFAVisualizer {
    /**
     * @param {string} svgSelector  — CSS selector like '#originalSvg'
     */
    constructor(svgSelector) {
        this.svgSelector = svgSelector;
        this.svg         = null;
        this.gRoot       = null;   // zoom container
        this.simulation  = null;
        this.nodeRadius  = 26;
        this.nodes       = [];
        this.links       = [];
        this.currentDFA  = null;
    }

    /* ============================================================
       RENDER  — draw a DFA graph from scratch
       ============================================================ */
    render(dfa) {
        this.clear();
        this.currentDFA = dfa;

        const container = document.querySelector(this.svgSelector).parentElement;
        const width     = container.clientWidth  || 600;
        const height    = container.clientHeight || 400;

        /* ---- SVG setup ---- */
        this.svg = d3.select(this.svgSelector)
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', `0 0 ${width} ${height}`);

        // Arrowhead marker (normal)
        const defs = this.svg.append('defs');
        defs.append('marker')
            .attr('id', `arrow-${this.svgSelector.replace('#', '')}`)
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 10).attr('refY', 0)
            .attr('markerWidth', 7).attr('markerHeight', 7)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', 'hsl(225, 15%, 40%)');

        // Start-state marker (colored)
        defs.append('marker')
            .attr('id', `arrow-start-${this.svgSelector.replace('#', '')}`)
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 10).attr('refY', 0)
            .attr('markerWidth', 7).attr('markerHeight', 7)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', '#22d3ee');

        // Zoom & pan
        this.gRoot = this.svg.append('g').attr('class', 'zoom-root');
        const zoom = d3.zoom()
            .scaleExtent([0.3, 3])
            .on('zoom', e => this.gRoot.attr('transform', e.transform));
        this.svg.call(zoom);

        /* ---- Prepare nodes ---- */
        const R = this.nodeRadius;
        const angleStep = (2 * Math.PI) / dfa.states.length;
        const layoutR   = Math.min(width, height) * 0.32;

        this.nodes = dfa.states.map((id, i) => ({
            id,
            isAccept: dfa.acceptStates.includes(id),
            isStart:  id === dfa.startState,
            x: width  / 2 + layoutR * Math.cos(angleStep * i - Math.PI / 2),
            y: height / 2 + layoutR * Math.sin(angleStep * i - Math.PI / 2)
        }));

        /* ---- Prepare links (merge same src→tgt) ---- */
        const linkMap = {};
        for (const state of dfa.states) {
            for (const sym of dfa.alphabet) {
                const target = dfa.getTransition(state, sym);
                if (!target) continue;
                const key = `${state}→${target}`;
                if (!linkMap[key]) {
                    linkMap[key] = { source: state, target: target, labels: [] };
                }
                linkMap[key].labels.push(sym);
            }
        }
        this.links = Object.values(linkMap).map(l => ({
            ...l,
            label: l.labels.join(', '),
            isSelfLoop: l.source === l.target,
            isBidirectional: false
        }));

        // Mark bidirectional pairs
        for (const link of this.links) {
            if (link.isSelfLoop) continue;
            link.isBidirectional = this.links.some(
                other => other.source === link.target && other.target === link.source && !other.isSelfLoop
            );
        }

        // Node lookup
        const nodeById = {};
        this.nodes.forEach(n => { nodeById[n.id] = n; });

        // Resolve link source/target to node objects
        this.links.forEach(l => {
            l.sourceNode = nodeById[l.source];
            l.targetNode = nodeById[l.target];
        });

        /* ---- Draw layers ---- */
        const gLinks  = this.gRoot.append('g').attr('class', 'links-layer');
        const gNodes  = this.gRoot.append('g').attr('class', 'nodes-layer');
        const gLabels = this.gRoot.append('g').attr('class', 'labels-layer');

        /* -- Start-state arrow -- */
        const startNode = nodeById[dfa.startState];
        const startArrow = this.gRoot.append('path')
            .attr('class', 'start-arrow-path')
            .attr('marker-end', `url(#arrow-start-${this.svgSelector.replace('#', '')})`);

        /* -- Edges -- */
        const markerUrl = `url(#arrow-${this.svgSelector.replace('#', '')})`;

        const linkGroups = gLinks.selectAll('g.link-group')
            .data(this.links)
            .enter().append('g').attr('class', 'link-group');

        const linkPaths = linkGroups.append('path')
            .attr('class', 'link-path')
            .attr('marker-end', d => d.isSelfLoop ? markerUrl : markerUrl);

        /* -- Edge label backgrounds + labels -- */
        const linkLabelGs = gLabels.selectAll('g.link-label-g')
            .data(this.links)
            .enter().append('g').attr('class', 'link-label-g');

        const linkLabelBgs = linkLabelGs.append('rect')
            .attr('class', 'link-label-bg')
            .attr('rx', 3).attr('ry', 3);

        const linkLabelTexts = linkLabelGs.append('text')
            .attr('class', 'link-label')
            .text(d => d.label);

        /* -- Nodes -- */
        const nodeGroups = gNodes.selectAll('g.node-group')
            .data(this.nodes, d => d.id)
            .enter().append('g').attr('class', 'node-group')
            .call(d3.drag()
                .on('start', (e, d) => { if (!e.active) this.simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
                .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y; })
                .on('end',   (e, d) => { if (!e.active) this.simulation.alphaTarget(0); d.fx = null; d.fy = null; })
            );

        // Outer circle
        nodeGroups.append('circle')
            .attr('class', 'node-circle')
            .attr('r', R)
            .attr('fill', 'hsl(228, 25%, 15%)')
            .attr('stroke', d => d.isAccept ? '#34d399' : 'hsl(225, 20%, 35%)');

        // Inner circle (accept states only)
        nodeGroups.filter(d => d.isAccept)
            .append('circle')
            .attr('class', 'node-circle-inner')
            .attr('r', R - 5)
            .attr('stroke', '#34d399');

        // State label
        nodeGroups.append('text')
            .attr('class', 'node-label')
            .text(d => d.id);

        /* ---- Force simulation ---- */
        this.simulation = d3.forceSimulation(this.nodes)
            .force('link', d3.forceLink(this.links.filter(l => !l.isSelfLoop))
                .id(d => d.id).distance(160).strength(0.4))
            .force('charge', d3.forceManyBody().strength(-500))
            .force('center', d3.forceCenter(width / 2, height / 2).strength(0.06))
            .force('collision', d3.forceCollide(R + 20))
            .force('x', d3.forceX(width / 2).strength(0.04))
            .force('y', d3.forceY(height / 2).strength(0.04))
            .alphaDecay(0.025)
            .on('tick', tick);

        const self = this;

        function tick() {
            // --- Edge paths ---
            linkPaths.attr('d', d => {
                const s = d.sourceNode;
                const t = d.targetNode;

                if (d.isSelfLoop) return selfLoopPath(s.x, s.y, R);

                const dx   = t.x - s.x;
                const dy   = t.y - s.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;

                const targetR = t.isAccept ? R + 2 : R;
                const sx = s.x + (dx / dist) * R;
                const sy = s.y + (dy / dist) * R;
                const tx = t.x - (dx / dist) * (targetR + 6);
                const ty = t.y - (dy / dist) * (targetR + 6);

                if (d.isBidirectional) {
                    const dr = dist * 0.55;
                    return `M ${sx} ${sy} A ${dr} ${dr} 0 0 1 ${tx} ${ty}`;
                }
                return `M ${sx} ${sy} L ${tx} ${ty}`;
            });

            // --- Edge labels ---
            linkLabelGs.attr('transform', d => {
                const s = d.sourceNode;
                const t = d.targetNode;

                if (d.isSelfLoop) {
                    return `translate(${s.x}, ${s.y - R - 38})`;
                }

                let mx = (s.x + t.x) / 2;
                let my = (s.y + t.y) / 2;

                if (d.isBidirectional) {
                    const dx = t.x - s.x;
                    const dy = t.y - s.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const nx = -dy / dist;
                    const ny =  dx / dist;
                    mx += nx * 22;
                    my += ny * 22;
                } else {
                    const dx = t.x - s.x;
                    const dy = t.y - s.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const nx = -dy / dist;
                    const ny =  dx / dist;
                    mx += nx * 12;
                    my += ny * 12;
                }

                return `translate(${mx}, ${my})`;
            });

            // Size the label bg rectangles
            linkLabelTexts.each(function () {
                const bbox = this.getBBox();
                d3.select(this.previousSibling)
                    .attr('x', bbox.x - 4)
                    .attr('y', bbox.y - 2)
                    .attr('width', bbox.width + 8)
                    .attr('height', bbox.height + 4);
            });

            // --- Nodes ---
            nodeGroups.attr('transform', d => `translate(${d.x}, ${d.y})`);

            // --- Start arrow ---
            if (startNode) {
                const sx = startNode.x - R - 40;
                const sy = startNode.y;
                const tx = startNode.x - R - 6;
                const ty = startNode.y;
                startArrow.attr('d', `M ${sx} ${sy} L ${tx} ${ty}`);
            }
        }
    }

    /* ============================================================
       UPDATE PARTITION COLOURS  — colour-code nodes by group
       ============================================================ */
    updatePartitionColors(partition) {
        if (!this.svg) return;
        const colors = window.DFAApp.PARTITION_COLORS;

        // Build state→colour map
        const colorMap = {};
        partition.forEach((group, idx) => {
            group.forEach(s => { colorMap[s] = colors[idx % colors.length]; });
        });

        // Update outer circle fill & stroke
        this.svg.selectAll('.node-circle')
            .transition().duration(450)
            .attr('fill', d => {
                const c = colorMap[d.id];
                return c ? hexToFill(c, 0.2) : 'hsl(228, 25%, 15%)';
            })
            .attr('stroke', d => colorMap[d.id] || (d.isAccept ? '#34d399' : 'hsl(225, 20%, 35%)'));

        // Update inner circle for accept states
        this.svg.selectAll('.node-circle-inner')
            .transition().duration(450)
            .attr('stroke', d => colorMap[d.id] || '#34d399');
    }

    /* ============================================================
       CLEAR  — tear down the current visualization
       ============================================================ */
    clear() {
        if (this.simulation) { this.simulation.stop(); this.simulation = null; }
        d3.select(this.svgSelector).selectAll('*').remove();
        this.nodes = [];
        this.links = [];
        this.currentDFA = null;
    }
}

/* ---------- Helpers ---------- */

/** Generates the SVG path for a self-loop above the node. */
function selfLoopPath(cx, cy, r) {
    const topY = cy - r;
    const loopH = r * 1.6;
    const loopW = r * 0.9;
    return `M ${cx - 8} ${topY}
            C ${cx - loopW - 10} ${topY - loopH},
              ${cx + loopW + 10} ${topY - loopH},
              ${cx + 8} ${topY}`;
}

/** Converts a hex colour + alpha into an rgba fill string. */
function hexToFill(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* Export */
window.DFAApp.DFAVisualizer = DFAVisualizer;
