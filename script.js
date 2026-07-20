const canvas = document.getElementById('circuitCanvas');
const ctx = canvas.getContext('2d');

let components = [];
let wires = [];
let currentTool = 'AND';
let activeWireStartPin = null; // Stores the first clicked pin ID
let currentMousePos = { x: 0, y: 0 };

// --- Selection & Undo State ---
let undoStack = [];
let selectedComponents = []; // Multi-select array
let selectedWire = null;
let dragMode = null; // 'move', 'select', or null
let dragStartPos = { x: 0, y: 0 };
let initialDragPositions = []; // To store pre-drag coordinates

const selectionPanel = document.getElementById('selection-panel');
const selectionText = document.getElementById('selection-text');
const btnDeleteSelected = document.getElementById('btn-delete-selected');

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
        if (this.type === 'TEXT') {
            this.width = 160;
            this.height = 30;
            return;
        }
        if (this.type === 'STICKY') {
            this.width = 150;
            this.height = 120;
            return;
        }
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
        if (this.type === 'INPUT' || this.type === 'TEXT' || this.type === 'STICKY') return; 

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
        if (this.type === 'TEXT') {
            ctx.save();
            ctx.fillStyle = 'rgba(226, 232, 240, 0.95)';
            ctx.font = '600 13px "JetBrains Mono", monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            
            // Draw a subtle selection highlight border if selected
            if (selectedComponents.includes(this)) {
                ctx.strokeStyle = '#00f0ff';
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);
                ctx.strokeRect(this.x - 6, this.y - 2, this.width + 12, this.height + 4);
                ctx.setLineDash([]);
            }
            
            ctx.fillText(this.label || "📝 Text Label (Edit left panel)", this.x, this.y + 4);
            ctx.restore();
            return;
        }

        if (this.type === 'STICKY') {
            ctx.save();
            const x = this.x;
            const y = this.y;
            
            // Draw sticky paper
            const stickyGrad = ctx.createLinearGradient(x, y, x, y + this.height);
            stickyGrad.addColorStop(0, '#fef08a');
            stickyGrad.addColorStop(1, '#fde047');
            ctx.fillStyle = stickyGrad;
            
            ctx.strokeStyle = '#eab308';
            ctx.lineWidth = 1.5;
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
            
            ctx.beginPath();
            ctx.roundRect(x, y, this.width, this.height, 6);
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;
            
            // Draw a pin icon/handle
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(x + this.width / 2, y + 8, 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Text on sticky
            ctx.fillStyle = '#1c1917';
            ctx.font = '500 11px "JetBrains Mono", monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            
            const text = this.label || "📌 Sticky Note\n(Edit text in the left panel)";
            const lines = text.split('\n');
            let currentY = y + 20;
            const maxWidth = this.width - 20;
            const lineHeight = 15;
            
            lines.forEach(lineText => {
                const words = lineText.split(' ');
                let currentLine = '';
                for (let n = 0; n < words.length; n++) {
                    let testLine = currentLine + words[n] + ' ';
                    let metrics = ctx.measureText(testLine);
                    if (metrics.width > maxWidth && n > 0) {
                        ctx.fillText(currentLine, x + 10, currentY);
                        currentLine = words[n] + ' ';
                        currentY += lineHeight;
                    } else {
                        currentLine = testLine;
                    }
                }
                ctx.fillText(currentLine, x + 10, currentY);
                currentY += lineHeight;
            });
            ctx.restore();
            return;
        }

        ctx.lineWidth = 2;
        const x = this.x;
        const y = this.y;

        // Draw Pins and Connection Lines
        this.pins.forEach(pin => {
            ctx.beginPath();
            const pinActive = pin.value === 1;
            ctx.strokeStyle = pinActive ? '#10b981' : '#334155';
            ctx.lineWidth = pinActive ? 2.5 : 1.5;
            
            if (pin.type === 'IN') {
                ctx.moveTo(pin.absoluteX, pin.absoluteY);
                ctx.lineTo(pin.absoluteX + 10, pin.absoluteY);
            } else {
                ctx.moveTo(pin.absoluteX - 10, pin.absoluteY);
                ctx.lineTo(pin.absoluteX, pin.absoluteY);
            }
            ctx.stroke();

            // Draw Pin Node Circle
            ctx.fillStyle = pinActive ? '#10b981' : '#111827';
            ctx.strokeStyle = pinActive ? '#34d399' : '#475569';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(pin.absoluteX, pin.absoluteY, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Highlight the pin if it is currently selected for wiring
            if (activeWireStartPin === this.id + '_' + pin.id) {
                ctx.save();
                ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
                ctx.beginPath();
                ctx.arc(pin.absoluteX, pin.absoluteY, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        });

        // Setup Component Body Gradients
        const bodyGrad = ctx.createLinearGradient(x, y, x + 60, y + 40);
        bodyGrad.addColorStop(0, '#141c2f');
        bodyGrad.addColorStop(1, '#0b0f19');
        ctx.fillStyle = bodyGrad;
        ctx.strokeStyle = '#384f7c';
        ctx.lineWidth = 2;

        if (this.type === 'INPUT') {
            // Draw a gorgeous digital toggle switch
            const btnGrad = ctx.createLinearGradient(x + 10, y, x + 50, y + 40);
            if (this.state) {
                btnGrad.addColorStop(0, '#10b981');
                btnGrad.addColorStop(1, '#047857');
                ctx.strokeStyle = '#34d399';
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'rgba(16, 185, 129, 0.4)';
            } else {
                btnGrad.addColorStop(0, '#1e293b');
                btnGrad.addColorStop(1, '#0f172a');
                ctx.strokeStyle = '#475569';
                ctx.shadowBlur = 0;
            }
            
            ctx.fillStyle = btnGrad;
            // Draw rounded button rectangle
            ctx.beginPath();
            ctx.roundRect(x + 10, y, 40, 40, 6);
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Text display
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.state ? '1' : '0', x + 30, y + 20);
        }
        else if (this.type === 'OUTPUT') {
            // Draw professional glowing terminal LED lamp
            ctx.fillStyle = '#0f172a';
            ctx.strokeStyle = this.state ? '#10b981' : '#334155';
            ctx.beginPath();
            ctx.arc(x + 30, y + 20, 18, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Inner bulb glowing
            const ledGrad = ctx.createRadialGradient(x + 30, y + 20, 2, x + 30, y + 20, 14);
            if (this.state) {
                ledGrad.addColorStop(0, '#34d399');
                ledGrad.addColorStop(0.6, '#10b981');
                ledGrad.addColorStop(1, '#064e3b');
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#10b981';
            } else {
                ledGrad.addColorStop(0, '#475569');
                ledGrad.addColorStop(1, '#1e293b');
                ctx.shadowBlur = 0;
            }
            ctx.fillStyle = ledGrad;
            ctx.beginPath();
            ctx.arc(x + 30, y + 20, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        else if (this.type === 'AND' || this.type === 'NAND') {
            ctx.beginPath();
            ctx.moveTo(x + 10, y);
            ctx.lineTo(x + 35, y);
            ctx.arc(x + 35, y + 20, 20, -Math.PI / 2, Math.PI / 2, false);
            ctx.lineTo(x + 10, y + 40); 
            ctx.closePath();
            ctx.fill(); 
            ctx.stroke();
            
            if (this.type === 'NAND') drawBubble(x + 55, y + 20);

            // Sub-label inside gate
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.type, x + 28, y + 20);
        }
        else if (this.type === 'OR' || this.type === 'NOR') {
            ctx.beginPath();
            ctx.moveTo(x + 10, y);
            ctx.quadraticCurveTo(x + 22, y + 20, x + 10, y + 40);
            ctx.quadraticCurveTo(x + 30, y + 40, x + 50, y + 20);
            ctx.quadraticCurveTo(x + 30, y, x + 10, y); 
            ctx.closePath();
            ctx.fill(); 
            ctx.stroke();
            
            if (this.type === 'NOR') drawBubble(x + 54, y + 20);

            // Sub-label inside gate
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.type, x + 26, y + 20);
        }
        else if (this.type === 'XOR' || this.type === 'XNOR') {
            ctx.beginPath();
            ctx.moveTo(x + 5, y);
            ctx.quadraticCurveTo(x + 17, y + 20, x + 5, y + 40);
            ctx.strokeStyle = '#384f7c'; 
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(x + 10, y);
            ctx.quadraticCurveTo(x + 22, y + 20, x + 10, y + 40);
            ctx.quadraticCurveTo(x + 30, y + 40, x + 50, y + 20);
            ctx.quadraticCurveTo(x + 30, y, x + 10, y); 
            ctx.closePath();
            ctx.fill(); 
            ctx.stroke();
            
            if (this.type === 'XNOR') drawBubble(x + 54, y + 20);

            // Sub-label inside gate
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.font = 'bold 8px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.type, x + 28, y + 20);
        }
        else if (this.type === 'NOT') {
            ctx.beginPath();
            ctx.moveTo(x + 10, y + 5);
            ctx.lineTo(x + 45, y + 20);
            ctx.lineTo(x + 10, y + 35); 
            ctx.closePath();
            ctx.fill(); 
            ctx.stroke();
            drawBubble(x + 49, y + 20);

            // Sub-label inside gate
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('NOT', x + 24, y + 20);
        }

        // Beautiful monospace typography for custom labels below components
        if (this.label) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = '600 11px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(this.label, x + 30, y - 8);
        }
    }
}

function drawBubble(cx, cy) {
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b'; ctx.fill(); ctx.stroke();
}

function propagateCircuit() {
    // Reset all input pins to 0 before propagation to ensure disconnected/rewired pins don't retain stale state
    components.forEach(c => {
        c.pins.forEach(p => {
            if (p.type === 'IN') {
                p.value = 0;
            }
        });
    });

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

// --- State Serialization & Undo System ---
function getCircuitState() {
    return {
        components: components.map(c => ({
            id: c.id,
            x: c.x,
            y: c.y,
            type: c.type,
            state: c.state,
            label: c.label
        })),
        wires: wires.map(w => ({
            startPinId: w.startPinId,
            endPinId: w.endPinId
        }))
    };
}

function restoreCircuitState(state) {
    components = state.components.map(c => {
        const comp = new Component(c.x, c.y, c.type, c.id, c.label || "");
        comp.state = c.state || 0;
        if (comp.type === 'INPUT') comp.pins[0].value = comp.state;
        return comp;
    });
    wires = state.wires.map(w => ({
        startPinId: w.startPinId,
        endPinId: w.endPinId
    }));
    selectedComponents = [];
    selectedWire = null;
    activeWireStartPin = null;
    updateDeleteButtonState();
    propagateCircuit();
}

function pushToUndo() {
    if (undoStack.length >= 50) {
        undoStack.shift();
    }
    undoStack.push(JSON.stringify(getCircuitState()));
}

function undo() {
    if (undoStack.length > 0) {
        const prevStateStr = undoStack.pop();
        const prevState = JSON.parse(prevStateStr);
        restoreCircuitState(prevState);
    }
}

// --- Canvas Element Detection & Helper Operations ---
function getComponentAt(x, y) {
    for (let i = components.length - 1; i >= 0; i--) {
        const c = components[i];
        if (x >= c.x && x <= c.x + c.width && y >= c.y && y <= c.y + c.height) {
            return c;
        }
    }
    return null;
}

function getWireAt(mX, mY) {
    const threshold = 8; // Max distance in pixels to select a wire
    for (let w of wires) {
        const p1 = findPinById(w.startPinId);
        const p2 = findPinById(w.endPinId);
        if (p1 && p2) {
            const midX = p1.absoluteX + (p2.absoluteX - p1.absoluteX) / 2;
            
            // Segment 1: Horizontal from p1.absoluteX to midX at p1.absoluteY
            const minX1 = Math.min(p1.absoluteX, midX);
            const maxX1 = Math.max(p1.absoluteX, midX);
            if (mX >= minX1 - threshold && mX <= maxX1 + threshold && Math.abs(mY - p1.absoluteY) <= threshold) {
                return w;
            }
            
            // Segment 2: Vertical from p1.absoluteY to p2.absoluteY at midX
            const minY2 = Math.min(p1.absoluteY, p2.absoluteY);
            const maxY2 = Math.max(p1.absoluteY, p2.absoluteY);
            if (mY >= minY2 - threshold && mY <= maxY2 + threshold && Math.abs(mX - midX) <= threshold) {
                return w;
            }
            
            // Segment 3: Horizontal from midX to p2.absoluteX at p2.absoluteY
            const minX3 = Math.min(midX, p2.absoluteX);
            const maxX3 = Math.max(midX, p2.absoluteX);
            if (mX >= minX3 - threshold && mX <= maxX3 + threshold && Math.abs(mY - p2.absoluteY) <= threshold) {
                return w;
            }
        }
    }
    return null;
}

function deleteComponent(comp) {
    if (!comp) return;
    if (activeChallenge && (comp.id.startsWith('IN_') || comp.id.startsWith('OUT_'))) {
        alert("Challenge input/output pins cannot be deleted.");
        return;
    }
    pushToUndo();
    components = components.filter(c => c !== comp);
    const pinIds = comp.pins.map(p => comp.id + '_' + p.id);
    wires = wires.filter(w => !pinIds.includes(w.startPinId) && !pinIds.includes(w.endPinId));
    selectedComponents = selectedComponents.filter(c => c !== comp);
    updateDeleteButtonState();
    propagateCircuit();
}

function deleteSelectedComponents() {
    if (selectedComponents.length === 0) return;
    pushToUndo();
    
    // Filter out challenge pins that shouldn't be deleted
    let deletable = selectedComponents;
    if (activeChallenge) {
        deletable = selectedComponents.filter(c => !c.id.startsWith('IN_') && !c.id.startsWith('OUT_'));
        if (deletable.length < selectedComponents.length) {
            alert("Challenge input/output pins cannot be deleted.");
        }
    }
    
    if (deletable.length === 0) return;
    
    components = components.filter(c => !deletable.includes(c));
    
    const allPinIds = [];
    deletable.forEach(comp => {
        comp.pins.forEach(p => {
            allPinIds.push(comp.id + '_' + p.id);
        });
    });
    
    wires = wires.filter(w => !allPinIds.includes(w.startPinId) && !allPinIds.includes(w.endPinId));
    selectedComponents = selectedComponents.filter(c => !deletable.includes(c));
    updateDeleteButtonState();
    propagateCircuit();
}

function deleteWire(wire) {
    if (!wire) return;
    pushToUndo();
    wires = wires.filter(w => w !== wire);
    if (selectedWire === wire) {
        selectedWire = null;
    }
    updateDeleteButtonState();
    propagateCircuit();
}

function updateDeleteButtonState() {
    if (!selectionPanel) return;
    const labelContainer = document.getElementById('selection-label-container');
    const labelInput = document.getElementById('selection-label-input');
    
    if (selectedComponents.length === 1) {
        const sc = selectedComponents[0];
        selectionPanel.style.display = 'block';
        selectionText.innerHTML = `Selected Gate: <strong style="color: var(--accent);">${sc.type}</strong><br><span style="font-size: 9px; color: var(--text-muted);">ID: ${sc.id}</span>`;
        if (labelContainer && labelInput) {
            labelContainer.style.display = 'block';
            labelInput.value = sc.label || "";
            if (sc.type === 'TEXT') {
                labelInput.placeholder = "Enter text content...";
            } else if (sc.type === 'STICKY') {
                labelInput.placeholder = "Enter sticky note text (use \\n for newline)...";
            } else if (sc.type === 'INPUT') {
                labelInput.placeholder = "Input label (e.g., A, B, Carry In)...";
            } else {
                labelInput.placeholder = "Enter custom label...";
            }
        }
    } else if (selectedComponents.length > 1) {
        selectionPanel.style.display = 'block';
        selectionText.innerHTML = `Selected: <strong style="color: var(--accent);">${selectedComponents.length} Gates</strong><br><span style="font-size: 9px; color: var(--text-muted);">Group Selection</span>`;
        if (labelContainer) labelContainer.style.display = 'none';
    } else if (selectedWire) {
        selectionPanel.style.display = 'block';
        selectionText.innerHTML = `<strong style="color: var(--accent);">Selected Wire</strong><br><span style="font-size: 9px; color: var(--text-muted);">Connects: ${selectedWire.startPinId.split('_').slice(-1)[0]} ➔ ${selectedWire.endPinId.split('_').slice(-1)[0]}</span>`;
        if (labelContainer) labelContainer.style.display = 'none';
    } else {
        selectionPanel.style.display = 'none';
        if (labelContainer) labelContainer.style.display = 'none';
    }
}

// --- Modified Two-Click Interaction Logic & Multi-Drag ---
function selectTool(toolType) {
    currentTool = toolType;
    document.querySelectorAll('.tool-btn').forEach(b => {
        b.classList.remove('active');
        if (b.dataset.type === toolType) {
            b.classList.add('active');
        }
    });
    activeWireStartPin = null;
}

canvas.addEventListener('mousedown', (e) => {
    // We only care about left click (button === 0). Right clicks are handled by 'contextmenu'.
    if (e.button !== 0) return;

    const rect = canvas.getBoundingClientRect();
    const mX = e.clientX - rect.left;
    const mY = e.clientY - rect.top;

    // 1. Check if we clicked on a pin (Only relevant for WIRE mode)
    if (currentTool === 'WIRE') {
        for (let c of components) {
            for (let p of c.pins) {
                const dist = Math.hypot(p.absoluteX - mX, p.absoluteY - mY);
                if (dist < 10) {
                    const clickedPinId = c.id + '_' + p.id;

                    if (!activeWireStartPin) {
                        // First click: select this pin
                        activeWireStartPin = clickedPinId;
                    } else {
                        // Second click: try to connect
                        const startPin = findPinById(activeWireStartPin);
                        if (activeWireStartPin !== clickedPinId && startPin && startPin.type !== p.type) {
                            const targetInPinId = startPin.type === 'IN' ? activeWireStartPin : clickedPinId;
                            
                            pushToUndo();
                            
                            // Remove any existing wire connected to this IN pin
                            wires = wires.filter(w => w.endPinId !== targetInPinId);
                            
                            wires.push({
                                startPinId: startPin.type === 'OUT' ? activeWireStartPin : clickedPinId,
                                endPinId: targetInPinId
                            });
                            propagateCircuit();
                        }
                        activeWireStartPin = null; // Reset selection
                    }
                    return;
                }
            }
        }
        
        // Cancel pin selection if you click on empty space while wiring
        if (activeWireStartPin) {
            activeWireStartPin = null;
            return;
        }
    }

    // 2. Check if we clicked on a component
    const clickedComp = getComponentAt(mX, mY);
    if (clickedComp) {
        // Toggling input is higher priority than selection/delete if the tool isn't DELETE and we are clicking the active area
        if (currentTool !== 'DELETE' && clickedComp.type === 'INPUT' && mX >= clickedComp.x + 10 && mX <= clickedComp.x + 50 && mY >= clickedComp.y && mY <= clickedComp.y + 40) {
            clickedComp.state = clickedComp.state === 1 ? 0 : 1;
            clickedComp.pins[0].value = clickedComp.state;
            propagateCircuit();
            return;
        }

        // Handle DELETE mode
        if (currentTool === 'DELETE') {
            deleteComponent(clickedComp);
            return;
        }

        // Selection (only if not drawing wires)
        if (currentTool !== 'DELETE') {
            if (e.shiftKey) {
                // Toggle selection
                if (selectedComponents.includes(clickedComp)) {
                    selectedComponents = selectedComponents.filter(c => c !== clickedComp);
                } else {
                    selectedComponents.push(clickedComp);
                }
            } else {
                // If clicked component is not already selected, make it the sole selection
                if (!selectedComponents.includes(clickedComp)) {
                    selectedComponents = [clickedComp];
                }
            }
            selectedWire = null;
            
            // Start drag move of all selected components
            dragMode = 'move';
            dragStartPos = { x: mX, y: mY };
            initialDragPositions = selectedComponents.map(c => ({
                component: c,
                startX: c.x,
                startY: c.y
            }));
            
            updateDeleteButtonState();
            return;
        }
    }

    // 3. Check if we clicked on a wire
    const clickedWire = getWireAt(mX, mY);
    if (clickedWire) {
        if (currentTool === 'DELETE') {
            deleteWire(clickedWire);
            return;
        }

        if (currentTool !== 'WIRE') {
            selectedWire = clickedWire;
            selectedComponents = [];
            updateDeleteButtonState();
            return;
        }
    }

    // 4. Place component or Start Box Selection
    if (currentTool !== 'WIRE' && currentTool !== 'DELETE') {
        const snapX = Math.round((mX - 30) / 20) * 20;
        const snapY = Math.round((mY - 20) / 20) * 20;
        
        pushToUndo();
        let defaultLabel = "";
        if (currentTool === 'TEXT') {
            defaultLabel = "Custom Text Label";
        } else if (currentTool === 'STICKY') {
            defaultLabel = "Sticky Note content...\nClick here to edit!";
        }
        
        const newComp = new Component(snapX, snapY, currentTool, null, defaultLabel);
        components.push(newComp);
        propagateCircuit();
        
        // Deselect previous, but auto-select if text/sticky to let them edit immediately
        if (currentTool === 'TEXT' || currentTool === 'STICKY') {
            selectedComponents = [newComp];
        } else {
            selectedComponents = [];
        }
        selectedWire = null;
        updateDeleteButtonState();
        
        // One-time add: revert back to WIRE mode after placement
        selectTool('WIRE');
    } else {
        // Start Box Selection dragging
        dragMode = 'select';
        dragStartPos = { x: mX, y: mY };
        if (!e.shiftKey) {
            selectedComponents = [];
            selectedWire = null;
        }
        updateDeleteButtonState();
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    currentMousePos.x = e.clientX - rect.left;
    currentMousePos.y = e.clientY - rect.top;

    if (dragMode === 'move') {
        const dx = currentMousePos.x - dragStartPos.x;
        const dy = currentMousePos.y - dragStartPos.y;
        
        initialDragPositions.forEach(item => {
            const targetX = item.startX + dx;
            const targetY = item.startY + dy;
            item.component.x = Math.round(targetX / 20) * 20;
            item.component.y = Math.round(targetY / 20) * 20;
        });
        propagateCircuit();
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (dragMode === 'select') {
        const x1 = Math.min(dragStartPos.x, currentMousePos.x);
        const y1 = Math.min(dragStartPos.y, currentMousePos.y);
        const x2 = Math.max(dragStartPos.x, currentMousePos.x);
        const y2 = Math.max(dragStartPos.y, currentMousePos.y);

        const dx = x2 - x1;
        const dy = y2 - y1;

        if (dx > 5 || dy > 5) {
            components.forEach(c => {
                const compCenterX = c.x + c.width / 2;
                const compCenterY = c.y + c.height / 2;
                if (compCenterX >= x1 && compCenterX <= x2 && compCenterY >= y1 && compCenterY <= y2) {
                    if (!selectedComponents.includes(c)) {
                        selectedComponents.push(c);
                    }
                }
            });
            if (selectedComponents.length > 0) {
                selectedWire = null;
            }
        } else {
            // Tiny click on background: clear if not shift
            if (!e.shiftKey) {
                selectedComponents = [];
                selectedWire = null;
            }
        }
        updateDeleteButtonState();
    } else if (dragMode === 'move') {
        let hasMoved = false;
        initialDragPositions.forEach(item => {
            if (item.component.x !== item.startX || item.component.y !== item.startY) {
                hasMoved = true;
            }
        });
        
        if (hasMoved) {
            // Save state prior to movement
            const currentState = getCircuitState();
            initialDragPositions.forEach(item => {
                item.component.x = item.startX;
                item.component.y = item.startY;
            });
            const preMoveState = getCircuitState();
            
            // Restore actual location
            currentState.components.forEach(sc => {
                const comp = components.find(c => c.id === sc.id);
                if (comp) {
                    comp.x = sc.x;
                    comp.y = sc.y;
                }
            });
            
            if (undoStack.length >= 50) {
                undoStack.shift();
            }
            undoStack.push(JSON.stringify(preMoveState));
        }
    }
    
    dragMode = null;
    initialDragPositions = [];
});

document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        selectTool(e.currentTarget.dataset.type);
    });
});

// --- Render Loop ---
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Premium Technical Grid Background (Blueprint Style)
    ctx.fillStyle = '#060913';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Minor Grid Lines (20px intervals)
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.25)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = 0; x < canvas.width; x += 20) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
    }
    for (let y = 0; y < canvas.height; y += 20) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();

    // Major Grid Lines (100px intervals)
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < canvas.width; x += 100) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
    }
    for (let y = 0; y < canvas.height; y += 100) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();

    // Draw Wires with Glow Effects
    wires.forEach(w => {
        const p1 = findPinById(w.startPinId);
        const p2 = findPinById(w.endPinId);
        if (p1 && p2) {
            ctx.beginPath();
            const isActive = p1.value === 1;
            const isSelected = selectedWire === w;
            
            if (isSelected) {
                ctx.strokeStyle = '#00f0ff'; // Selection cyan
                ctx.lineWidth = 4;
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#00f0ff';
            } else {
                ctx.strokeStyle = isActive ? '#10b981' : '#334155'; // Emerald or slate
                ctx.lineWidth = isActive ? 3 : 2;
                if (isActive) {
                    ctx.shadowBlur = 12;
                    ctx.shadowColor = 'rgba(16, 185, 129, 0.7)';
                } else {
                    ctx.shadowBlur = 0;
                }
            }
            
            ctx.moveTo(p1.absoluteX, p1.absoluteY);
            const midX = p1.absoluteX + (p2.absoluteX - p1.absoluteX) / 2;
            ctx.lineTo(midX, p1.absoluteY);
            ctx.lineTo(midX, p2.absoluteY);
            ctx.lineTo(p2.absoluteX, p2.absoluteY);
            ctx.stroke(); 
            ctx.shadowBlur = 0; 
        }
    });

    // Draw Routing Guideline
    if (activeWireStartPin) {
        const p1 = findPinById(activeWireStartPin);
        if (p1) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.moveTo(p1.absoluteX, p1.absoluteY);
            ctx.lineTo(currentMousePos.x, currentMousePos.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    // Draw Selection Box (Box selection dragging)
    if (dragMode === 'select') {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
        ctx.fillStyle = 'rgba(0, 240, 255, 0.05)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        
        const x = dragStartPos.x;
        const y = dragStartPos.y;
        const w = currentMousePos.x - x;
        const h = currentMousePos.y - y;
        
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
    }

    // Draw Components & Selections
    components.forEach(c => {
        c.draw(ctx);
        // Multi-select highlight borders around components
        if (selectedComponents.includes(c)) {
            ctx.beginPath();
            ctx.strokeStyle = '#00f0ff'; // Sleek cyan selection
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 4]);
            ctx.strokeRect(c.x - 6, c.y - 6, c.width + 12, c.height + 12);
            ctx.setLineDash([]);
        }
    });

    // Elegant Canvas watermark
    ctx.fillStyle = 'rgba(30, 41, 59, 0.6)';
    ctx.font = 'bold 22px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('⚡ SimpleCircuit', canvas.width - 30, canvas.height - 30);

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
        pushToUndo(); // Save state before importing a file
        const data = JSON.parse(event.target.result);
        components = data.components.map(c => {
            const comp = new Component(c.x, c.y, c.type, c.id, c.label || "");
            comp.state = c.state || 0;
            if (comp.type === 'INPUT') comp.pins[0].value = comp.state;
            return comp;
        });
        wires = data.wires;
        selectedComponents = [];
        selectedWire = null;
        updateDeleteButtonState();
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
    
    pushToUndo(); // Save state before loading challenge
    activeChallenge = testbenchChallenges[sel];
    components = []; wires = []; activeWireStartPin = null;
    selectedComponents = [];
    selectedWire = null;
    updateDeleteButtonState();

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
        pushToUndo(); // Save state before clearing canvas
        components = []; wires = []; activeWireStartPin = null; 
        selectedComponents = [];
        selectedWire = null;
        activeChallenge = null; // Clear active challenge state so pins can be edited/deleted
        updateDeleteButtonState();
        document.getElementById('btn-run-test').style.display = 'none';
        document.getElementById('challenge-select').value = 'none';
        propagateCircuit();
    }
});

// Reset activeChallenge when select dropdown is manually set back to "none"
document.getElementById('challenge-select').addEventListener('change', (e) => {
    if (e.target.value === 'none') {
        activeChallenge = null;
        document.getElementById('btn-run-test').style.display = 'none';
    }
});

// --- Selection Panel Button & Right Click & Key Shortcuts ---
if (btnDeleteSelected) {
    btnDeleteSelected.addEventListener('click', () => {
        if (selectedComponents.length > 0) {
            deleteSelectedComponents();
        } else if (selectedWire) {
            deleteWire(selectedWire);
        }
    });
}

// --- Custom Context Menu & Label Editing Implementation ---
const contextMenu = document.getElementById('custom-context-menu');
let contextMenuPos = { x: 0, y: 0 };

// Right-click: delete if clicking directly on a component/wire, else open the custom context menu on empty space
canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mX = e.clientX - rect.left;
    const mY = e.clientY - rect.top;

    const clickedComp = getComponentAt(mX, mY);
    if (clickedComp) {
        deleteComponent(clickedComp);
        if (contextMenu) contextMenu.classList.remove('visible');
        return;
    }

    const clickedWire = getWireAt(mX, mY);
    if (clickedWire) {
        deleteWire(clickedWire);
        if (contextMenu) contextMenu.classList.remove('visible');
        return;
    }

    // Right-clicked on background: show custom context menu
    contextMenuPos = { x: mX, y: mY };
    if (contextMenu) {
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.classList.add('visible');
    }
});

// Hide context menu when clicking elsewhere
window.addEventListener('click', (e) => {
    if (contextMenu && !contextMenu.contains(e.target)) {
        contextMenu.classList.remove('visible');
    }
});

// Dispatch context menu item actions
if (contextMenu) {
    contextMenu.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const action = e.currentTarget.dataset.action;
            contextMenu.classList.remove('visible');

            if (action === 'add-text') {
                const txt = prompt("Enter text/label content:");
                if (txt !== null && txt.trim() !== "") {
                    pushToUndo();
                    const snapX = Math.round((contextMenuPos.x - 30) / 20) * 20;
                    const snapY = Math.round((contextMenuPos.y - 15) / 20) * 20;
                    const newComp = new Component(snapX, snapY, 'TEXT', null, txt.trim());
                    components.push(newComp);
                    selectedComponents = [newComp];
                    selectedWire = null;
                    updateDeleteButtonState();
                    propagateCircuit();
                }
            } else if (action === 'add-sticky') {
                const note = prompt("Enter sticky note text (use \\n for new lines):");
                if (note !== null && note.trim() !== "") {
                    pushToUndo();
                    const snapX = Math.round((contextMenuPos.x - 40) / 20) * 20;
                    const snapY = Math.round((contextMenuPos.y - 40) / 20) * 20;
                    // Replace literal \n string with actual newlines
                    const formattedNote = note.replace(/\\n/g, '\n');
                    const newComp = new Component(snapX, snapY, 'STICKY', null, formattedNote.trim());
                    components.push(newComp);
                    selectedComponents = [newComp];
                    selectedWire = null;
                    updateDeleteButtonState();
                    propagateCircuit();
                }
            } else if (action === 'clear-selection') {
                selectedComponents = [];
                selectedWire = null;
                updateDeleteButtonState();
            } else if (action === 'undo') {
                undo();
            } else if (action === 'clear-all') {
                document.getElementById('btn-clear')?.click();
            }
        });
    });
}

// Wiring Selection Label input field
const labelInputEl = document.getElementById('selection-label-input');
if (labelInputEl) {
    labelInputEl.addEventListener('input', (e) => {
        if (selectedComponents.length === 1) {
            // Replace literal \n with actual newlines for sticky note input
            let val = e.target.value;
            if (selectedComponents[0].type === 'STICKY') {
                val = val.replace(/\\n/g, '\n');
            }
            selectedComponents[0].label = val;
            propagateCircuit();
        }
    });
    labelInputEl.addEventListener('change', () => {
        pushToUndo();
    });
}

// Keyboard shortcuts (Ctrl+Z and Delete/Backspace)
window.addEventListener('keydown', (e) => {
    // Ignore hotkeys if user is focusing an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
    }

    // Ctrl+Z / Cmd+Z (Undo)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
    }

    // Delete / Backspace (Delete Selection)
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedComponents.length > 0) {
            e.preventDefault();
            deleteSelectedComponents();
        } else if (selectedWire) {
            e.preventDefault();
            deleteWire(selectedWire);
        }
    }
});

render();
