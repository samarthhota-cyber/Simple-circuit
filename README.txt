# SimpleCircuit ⚡

A lightweight, browser-based digital logic simulator built strictly for gate-level circuit design. 

SimpleCircuit is designed for prototyping core digital logic networks, exploring microelectronics fundamentals, and verifying custom architectures before moving on to Verilog descriptions or hardware implementations like Tiny Tapeout. 

## 🚀 Features

* **Strictly Gate-Level Logic:** No high-level abstractions. Build everything from the ground up using fundamental logic gates (AND, NAND, OR, NOR, XOR, XNOR, NOT).
* **Automated VLSI Testbench:** Built-in diagnostic engine to verify your circuits against predefined truth tables (e.g., Half-Adders, basic multiplexers). It catches logic errors and provides terminal-style debugging feedback.
* **Midnight Mint UI:** A sleek, developer-focused dark mode interface designed for long sessions and low eye strain.
* **Interactive Canvas:** Click-and-drag wiring, real-time signal propagation, and visual state indicators (glowing active wires).
* **Save & Load:** Export your circuit designs as lightweight JSON files and import them later to pick up right where you left off.
* **Zero Dependencies:** Pure HTML, CSS, and Vanilla JavaScript. Runs completely offline in any modern web browser.

## 🛠️ Quick Start

Because SimpleCircuit is a vanilla web application, there are no build steps, package managers, or server requirements.

1. Clone or download this repository.
2. Ensure `index.html`, `style.css`, and `script.js` are in the same folder.
3. Double-click `index.html` to open it in your browser.

## 🎮 How to Use

1. **Place Components:** Select an I/O block (Switch/LED) or a logic gate from the sidebar and click anywhere on the grid to place it.
2. **Wire it Up:** Select the **Draw Wire Mode** (⤡) at the bottom of the sidebar. Click an output pin (right side of a gate) and drag it to an input pin (left side of a gate).
3. **Run the Simulation:** Click directly on an Input Switch on the canvas to toggle its state between `0` and `1`. Watch the signals propagate through your gates in real-time.

## 🧪 Using the Testbench

The built-in VLSI Testbench allows you to test your logic structures against specific challenges:

1. Select a challenge (e.g., "Build a Half-Adder") from the **VLSI Testbench** dropdown in the sidebar.
2. Click **Load Challenge Pins** to spawn the required inputs and outputs.
3. Build your circuit between the spawned I/O blocks.
4. Click **Run Diagnostics**. The engine will automatically cycle through the required truth table, forcing inputs and reading outputs to verify your logic architecture. 

## 🎯 Motivation

This project was built to provide a clean, distraction-free environment for learning and experimenting with digital logic design. Whether logging development hours for coding challenges like Hack Club Stardance, or just sketching out an ALU concept before writing hardware description languages, SimpleCircuit keeps the focus strictly on the gates.

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
