const canvas = document.getElementById('circuitCanvas');
const ctx = canvas.getContext('2d');

// State management
let gates = [];
let currentTool = 'AND';

// Canvas resize
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth
    canvas.height = canvas.parentElement.clientHeight
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas(); //start size

//basic gate class
class Gate {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = 60;
        this.height = 40;
    }

    draw(ctx) {
        //draw gate body
        ctx.fillStyle = '#333333';
        ctx.strokeStyle = '#007fd4';
        ctx.lineWidth = 2;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        
        // draw gate labeel
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.type, this.x + this.width / 2, this.y + this.height / 2);
    }
}

// mouse interaction
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    if (currentTool !=='WIRE') {
        //snap grid
        const snapX = Math.round(mouseX / 20) * 20;
        const snapY = Math.round(mouseY / 20) * 20;
        gates.push(new Gate(snapX, snapY, currentTool));
    }
});

//toolbar interaction
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentTool = e.target.dataset.type;
    });
});

// default active set tool
function drawGrid() {
    ctx.fillStyle = '#2a2a2a';
    for (let x = 0; x < canvas.width; x += 20) {
        for (let y = 0; y < canvas.height; y += 20) {
            ctx.fillRect(x - 1, y - 1, 2, 2);
        }
    }
}

//main loop
function render() {
    //clear screen
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    //background
    drawGrid();

    // draw gates
    gates.forEach(gate =>gate.draw(ctx));

    requestAnimationFrame(render);
}

render();