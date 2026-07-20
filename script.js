const canvas = document.getElementById('circuitCanvas');
const ctx = canvas.getContext('2d');

let components = [];
let wires = [];
let currentTool = 'AND';
let activeWireStartPin = null; // Stores the first clicked pin ID
let currentMousePos = { x: 0, y: 0 };

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class Pin {
    constructor(parent, xOffset, yOffset, type, id) {
        this.parent = parent;
        this.xOffset = xOffset;
        this.yOffset = yOffset;
        this.type = type;
        this.id = id;
        this.value = 0;
    }
    get absoluteX() { return this.parent.x + this.xOffset; }
    get absoluteY() { return this.parent.y + this.yOffset; }
}

class Component {
    constructor(x, y, type, id = null, label = "") {
        this.x = x;
        this.y = y;
        this.type = type;
        this.id = id || type + '_' + Math.random().toString(36).substr(2, 9);
        this.label = label;
        this.width = 60;
        this.height = 40;
        this.pins = [];
        this.state = 0; 
        this.initPins();
    }

    initPins() {
        if (this.type === 'INPUT') {
            this.pins.push(new Pin(this, 60, 20, 'OUT', 'out'));
        } else if (this.type === 'OUTPUT') {
            this.pins.push(new Pin(this, 0, 20, 'IN', 'in'));
        } else if (this.type === 'NOT') {
            this.pins.push(new Pin(this, 0, 20, 'IN', 'in'));
            this.pins.push(new Pin(this, 60, 20, 'OUT', 'out'));
        } else {
            this.pins.push(new Pin(this, 0, 10, 'IN', 'in1'));
            this.pins.push(new Pin(this, 0, 30, 'IN', 'in2'));
            this.pins.push(new Pin(this, 60, 20, 'OUT', 'out'));
        }
    }

    evaluate() {
        if (this.type === 'INPUT') return; 

        const inputs = this.pins.filter(p => p.type === 'IN');
        const outPin = this.pins.find(p => p.type === 'OUT');

        if (this.type === 'OUTPUT') {
            this.state = inputs[0].value;
            return;
        }

        const i1 = inputs[0]?.value || 0;
        const i2 = inputs[1]?.value || 0;

        switch (this.type) {
            case 'AND':  outPin.value = (i1 && i2) ? 1 : 0; break;
            case 'NAND': outPin.value = !(i1 && i2) ? 1 : 0; break;
            case 'OR':   outPin.value = (i1 || i2) ? 1 : 0; break;
            case 'NOR':  outPin.value = !(i1 || i2) ? 1 : 0; break;
            case 'XOR':  outPin.value = (i1 !== i2) ? 1 : 0; break;
            case 'XNOR': outPin.value = (i1 === i2) ? 1 : 0; break;
            case 'NOT':  outPin.value = (!i1) ? 1 : 0; break;
        }
    }

    draw(ctx) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#64748b'; 
        const x = this.x;
        const y = this.y;

        this.pins.forEach(pin => {
            ctx.beginPath();
            ctx.strokeStyle = pin.value ? '#34d399' : '#334155';
            if (pin.type === 'IN') {
                ctx.moveTo(pin.absoluteX, pin.absoluteY);
                ctx.lineTo(pin.absoluteX + 10, pin.absoluteY);
            } else {
                ctx.moveTo(pin.absoluteX - 10, pin.absoluteY);
                ctx.lineTo(pin.absoluteX, pin.absoluteY);
            }
            ctx.stroke();

            // Highlight the pin if it is currently selected for wiring
            if (activeWireStartPin === this.id + '_' + pin.id) {
                ctx.fillStyle = '#10b981';
                ctx.beginPath();
                ctx.arc(pin.absoluteX, pin.absoluteY, 7, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.fillStyle = pin.value ? '#34d399' : '#1e293b';
            ctx.beginPath();
            ctx.arc(pin.absoluteX, pin.absoluteY, 4, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
        });

        ctx.strokeStyle = '#94a3b8';
        ctx.fillStyle = '#1e293b';

        if (this.type === 'INPUT') {
            ctx.fillStyle = this.state ? '#10b981' : '#1e293b';
            ctx.fillRect(x + 10, y, 40, 40);
            ctx.strokeRect(x + 10, y, 40, 40);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px "Fira Code", monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(this.state ? '1' : '0', x + 30, y + 20);
        }
        else if (this.type === 'OUTPUT') {
            ctx.beginPath();
            ctx.arc(x + 30, y + 20, 18, 0, Math.PI * 2);
            ctx.fillStyle = this.state ? '#10b981' : '#1e293b';
            if (this.state) { ctx.shadowBlur = 15; ctx.shadowColor = '#10b981'; }
            ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
        }
        else if (this.type === 'AND' || this.type === 'NAND') {
            ctx.beginPath();
            ctx.moveTo(x + 10, y);
            ctx.lineTo(x + 35, y);
            ctx.arc(x + 35, y + 20, 20, -Math.PI / 2, Math.PI / 2, false);
            ctx.lineTo(x + 10, y + 40); ctx.closePath();
            ctx.fill(); ctx.stroke();
            if (this.type === 'NAND') drawBubble(x + 55, y + 20);
        }
        else if (this.type === 'OR' || this.type === 'NOR') {
            ctx.beginPath();
            ctx.moveTo(x + 10, y);
            ctx.quadraticCurveTo(x + 22, y + 20, x + 10, y + 40);
            ctx.quadraticCurveTo(x + 30, y + 40, x + 50, y + 20);
            ctx.quadraticCurveTo(x + 30, y, x + 10, y); ctx.closePath();
            ctx.fill(); ctx.stroke();
            if (this.type === 'NOR') drawBubble(x + 54, y + 20);
        }
        else if (this.type === 'XOR' || this.type === 'XNOR') {
            ctx.beginPath();
            ctx.moveTo(x + 5, y);
            ctx.quadraticCurveTo(x + 17, y + 20, x + 5, y + 40);
            ctx.strokeStyle = '#94a3b8'; ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x + 10, y);
            ctx.quadraticCurveTo(x + 22, y + 20, x + 10, y + 40);
            ctx.quadraticCurveTo(x + 30, y + 40, x + 50, y + 20);
            ctx.quadraticCurveTo(x + 30, y, x + 10, y); ctx.closePath();
            ctx.fill(); ctx.stroke();
            if (this.type === 'XNOR') drawBubble(x + 54, y + 20);
        }
        else if (this.type === 'NOT') {
            ctx.beginPath();
            ctx.moveTo(x + 10, y + 5);
            ctx.lineTo(x + 45, y + 20);
            ctx.lineTo(x + 10, y + 35); ctx.closePath();
            ctx.fill(); ctx.stroke();
            drawBubble(x + 49, y + 20);
        }

        if (this.label) {
            ctx.fillStyle = '#cbd5e1';
            ctx.font = 'bold 12px "Fira Code", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(this.label, x + 30, y - 10);
        }
    }
}

function drawBubble(cx, cy) {
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b'; ctx.fill(); ctx.stroke();
}

function propagateCircuit() {
    for (let iterations = 0; iterations < 15; iterations++) {
        wires.forEach(wire => {
            const startPin = findPinById(wire.startPinId);
            const endPin = findPinById(wire.endPinId);
            if (startPin && endPin) endPin.value = startPin.value;
        });
        components.forEach(c => c.evaluate());
    }
}

function findPinById(id) {
    for (let c of components) {
        for (let p of c.pins) if (c.id + '_' + p.id === id) return p;
    }
    return null;
}

// --- Modified Two-Click Interaction Logic ---
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mX = e.clientX - rect.left;
    const mY = e.clientY - rect.top;

    for (let c of components) {
        // 1. Toggle inputs (only if not wiring)
        if (!activeWireStartPin && c.type === 'INPUT' && mX >= c.x + 10 && mX <= c.x + 50 && mY >= c.y && mY <= c.y + 40) {
            c.state = c.state === 1 ? 0 : 1;
            c.pins[0].value = c.state;
            propagateCircuit();
            return;
        }

        // 2. Pin Selection (Two-Click System)
        for (let p of c.pins) {
            const dist = Math.hypot(p.absoluteX - mX, p.absoluteY - mY);
            if (dist < 10 && currentTool === 'WIRE') {
                const clickedPinId = c.id + '_' + p.id;

                if (!activeWireStartPin) {
                    // First click: select this pin
                    activeWireStartPin = clickedPinId;
                } else {
                    // Second click: try to connect
                    const startPin = findPinById(activeWireStartPin);
                    if (activeWireStartPin !== clickedPinId && startPin && startPin.type !== p.type) {
                        wires.push({
                            startPinId: startPin.type === 'OUT' ? activeWireStartPin : clickedPinId,
                            endPinId: startPin.type === 'IN' ? activeWireStartPin : clickedPinId
                        });
                        propagateCircuit();
                    }
                    activeWireStartPin = null; // Reset selection
                }
                return;
            }
        }
    }

    // Cancel selection if you click on the empty background while wiring
    if (activeWireStartPin && currentTool === 'WIRE') {
        activeWireStartPin = null;
        return;
    }

    // 3. Place component
    if (currentTool !== 'WIRE') {
        const snapX = Math.round((mX - 30) / 20) * 20;
        const snapY = Math.round((mY - 20) / 20) * 20;
        components.push(new Component(snapX, snapY, currentTool));
        propagateCircuit();
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    currentMousePos.x = e.clientX - rect.left;
    currentMousePos.y = e.clientY - rect.top;
});

document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active'); 
        currentTool = e.currentTarget.dataset.type;
        activeWireStartPin = null; // Reset selection if switching tools
    });
});

// --- Render Loop ---
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0f141e';
    for (let x = 0; x < canvas.width; x += 20) {
        for (let y = 0; y < canvas.height; y += 20) ctx.fillRect(x - 1, y - 1, 2, 2);
    }

    wires.forEach(w => {
        const p1 = findPinById(w.startPinId);
        const p2 = findPinById(w.endPinId);
        if (p1 && p2) {
            ctx.beginPath();
            const isActive = p1.value === 1;
            ctx.strokeStyle = isActive ? '#34d399' : '#334155';
            ctx.lineWidth = 3;
            if (isActive) { ctx.shadowBlur = 10; ctx.shadowColor = '#10b981'; } 
            else { ctx.shadowBlur = 0; }
            
            ctx.moveTo(p1.absoluteX, p1.absoluteY);
            const midX = p1.absoluteX + (p2.absoluteX - p1.absoluteX) / 2;
            ctx.lineTo(midX, p1.absoluteY);
            ctx.lineTo(midX, p2.absoluteY);
            ctx.lineTo(p2.absoluteX, p2.absoluteY);
            ctx.stroke(); ctx.shadowBlur = 0; 
        }
    });

    // Draw routing guideline from selected pin to cursor position
    if (activeWireStartPin) {
        const p1 = findPinById(activeWireStartPin);
        if (p1) {
            ctx.beginPath();
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.moveTo(p1.absoluteX, p1.absoluteY);
            ctx.lineTo(currentMousePos.x, currentMousePos.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    components.forEach(c => c.draw(ctx));

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 24px "Fira Code", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('SimpleCircuit', canvas.width - 30, canvas.height - 30);

    requestAnimationFrame(render);
}

// --- File IO ---
document.getElementById('btn-save').addEventListener('click', () => {
    const saveObject = {
        components: components.map(c => ({ id: c.id, x: c.x, y: c.y, type: c.type, state: c.state, label: c.label })),
        wires: wires
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(saveObject));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", "logic_circuit.json");
    dlAnchor.click();
});

document.getElementById('btn-load').addEventListener('click', () => document.getElementById('file-input').click());
document.getElementById('file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        const data = JSON.parse(event.target.result);
        components = data.components.map(c => {
            const comp = new Component(c.x, c.y, c.type, c.id, c.label || "");
            comp.state = c.state || 0;
            if (comp.type === 'INPUT') comp.pins[0].value = comp.state;
            return comp;
        });
        wires = data.wires;
        propagateCircuit();
    };
    reader.readAsText(file);
    e.target.value = '';
});

// --- Tutorial System Logic ---
const tutData = [
    { title: "Welcome to SimpleCircuit", text: "This is a gate-level simulator. Let's learn how to design logic circuits." },
    { title: "Placing Components", text: "1. Select a tool from the sidebar (like a Switch or an AND gate).<br>2. Click anywhere on the grid canvas to place it." },
    { title: "Wiring Nodes", text: "1. Select the 'Draw Wire Mode' at the bottom of the sidebar.<br>2. Click once on an origin pin, then click a second time on the target pin to connect them." },
    { title: "Running the Simulation", text: "Click directly on any 'Switch (Input)' block on your canvas to toggle it between 0 and 1. Watch the signal flow!" }
];

let currentTutStep = 0;
const overlay = document.getElementById('tutorial-overlay');
const tutTitle = document.getElementById('tut-title');
const tutText = document.getElementById('tut-text');
const tutProgress = document.getElementById('tut-progress');
const tutNext = document.getElementById('tut-next');
const tutSkip = document.getElementById('tut-skip');

function updateTutorial() {
    tutTitle.innerHTML = tutData[currentTutStep].title;
    tutText.innerHTML = tutData[currentTutStep].text;
    tutProgress.innerText = `${currentTutStep + 1}/${tutData.length}`;
    if (currentTutStep === tutData.length - 1) {
        tutNext.innerText = "Finish";
    } else {
        tutNext.innerText = "Next";
    }
}

document.getElementById('btn-tutorial').addEventListener('click', () => {
    currentTutStep = 0;
    updateTutorial();
    overlay.classList.remove('hidden');
});

tutNext.addEventListener('click', () => {
    if (currentTutStep < tutData.length - 1) {
        currentTutStep++;
        updateTutorial();
    } else {
        overlay.classList.add('hidden');
    }
});

tutSkip.addEventListener('click', () => {
    overlay.classList.add('hidden');
});

// --- Testbench ---
const testbenchChallenges = {
    'not': {
        inputs: ['A'], outputs: ['Out'],
        table: [
            { in: {'A': 0}, out: {'Out': 1} },
            { in: {'A': 1}, out: {'Out': 0} }
        ],
        diagnostics: {
            'Out': "NAND gates output 0 only when both inputs are 1. If you split input A into both pins of a NAND, it acts like a NOT gate."
        }
    },
    'half-adder': {
        inputs: ['A', 'B'], outputs: ['Sum', 'Carry'],
        table: [
            { in: {'A': 0, 'B': 0}, out: {'Sum': 0, 'Carry': 0} },
            { in: {'A': 0, 'B': 1}, out: {'Sum': 1, 'Carry': 0} },
            { in: {'A': 1, 'B': 0}, out: {'Sum': 1, 'Carry': 0} },
            { in: {'A': 1, 'B': 1}, out: {'Sum': 0, 'Carry': 1} }
        ],
        diagnostics: {
            'Sum': "Sum failed. In binary addition, 1+1=0 (with carry). The Sum should only be 1 when inputs are DIFFERENT. Did you use an XOR gate?",
            'Carry': "Carry failed. The Carry should only be 1 when BOTH inputs are 1. Did you use an AND gate?"
        }
    },
    'xor': {
        inputs: ['A', 'B'], outputs: ['Out'],
        table: [
            { in: {'A': 0, 'B': 0}, out: {'Out': 0} },
            { in: {'A': 0, 'B': 1}, out: {'Out': 1} },
            { in: {'A': 1, 'B': 0}, out: {'Out': 1} },
            { in: {'A': 1, 'B': 1}, out: {'Out': 0} }
        ],
        diagnostics: {
            'Out': "XOR outputs 1 only when inputs mismatch. If using basic gates, try constructing: (A OR B) AND NOT (A AND B)."
        }
    }
};

let activeChallenge = null;

document.getElementById('btn-load-challenge').addEventListener('click', () => {
    const sel = document.getElementById('challenge-select').value;
    if (sel === 'none') return;
    
    activeChallenge = testbenchChallenges[sel];
    components = []; wires = []; activeWireStartPin = null;

    activeChallenge.inputs.forEach((name, idx) => {
        components.push(new Component(100, 100 + (idx * 80), 'INPUT', `IN_${name}`, `Input ${name}`));
    });

    activeChallenge.outputs.forEach((name, idx) => {
        components.push(new Component(600, 100 + (idx * 80), 'OUTPUT', `OUT_${name}`, `Output ${name}`));
    });

    propagateCircuit();
    document.getElementById('btn-run-test').style.display = 'block';
});

document.getElementById('btn-run-test').addEventListener('click', () => {
    const term = document.getElementById('test-results');
    const overlay = document.getElementById('test-overlay');
    const card = overlay.querySelector('.test-card');
    
    term.innerHTML = "Initializing Testbench...\n";
    overlay.classList.remove('hidden');
    card.className = 'tutorial-card test-card';

    const inComps = {};
    const outComps = {};
    activeChallenge.inputs.forEach(n => inComps[n] = components.find(c => c.id === `IN_${n}`));
    activeChallenge.outputs.forEach(n => outComps[n] = components.find(c => c.id === `OUT_${n}`));

    let allPassed = true;

    activeChallenge.table.forEach((row, index) => {
        term.innerHTML += `\n[T=${index}] Applying Inputs: ` + JSON.stringify(row.in) + "\n";
        
        Object.keys(row.in).forEach(key => {
            inComps[key].state = row.in[key];
            inComps[key].pins[0].value = row.in[key];
        });

        propagateCircuit();

        Object.keys(row.out).forEach(key => {
            const expected = row.out[key];
            const actual = outComps[key].state;
            
            if (expected === actual) {
                term.innerHTML += `<span class="term-pass">  ↳ ${key}: PASS (Got ${actual})</span>\n`;
            } else {
                allPassed = false;
                term.innerHTML += `<span class="term-fail">  ↳ ${key}: FAIL (Expected ${expected}, Got ${actual})</span>\n`;
                term.innerHTML += `<span class="term-warn">    Diagnostic: ${activeChallenge.diagnostics[key]}</span>\n`;
            }
        });
    });

    if (allPassed) {
        term.innerHTML += `\n<span class="term-pass">>> TESTBENCH COMPLETED: 0 ERRORS. CIRCUIT VALID.</span>`;
        card.classList.add('success');
    } else {
        term.innerHTML += `\n<span class="term-fail">>> TESTBENCH FAILED: LOGIC ERRORS DETECTED.</span>`;
        card.classList.add('fail');
    }
});

document.getElementById('test-close').addEventListener('click', () => {
    document.getElementById('test-overlay').classList.add('hidden');
    if (activeChallenge) {
        activeChallenge.inputs.forEach(n => {
            let c = components.find(comp => comp.id === `IN_${n}`);
            if (c) { c.state = 0; c.pins[0].value = 0; }
        });
        propagateCircuit();
    }
});

document.getElementById('btn-clear').addEventListener('click', () => {
    if (confirm("Clear the entire circuit canvas?")) {
        components = []; wires = []; activeWireStartPin = null; 
        document.getElementById('btn-run-test').style.display = 'none';
        document.getElementById('challenge-select').value = 'none';
        propagateCircuit();
    }
});

render();
