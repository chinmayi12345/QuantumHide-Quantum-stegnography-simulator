# QuantumHide — Quantum Steganography Simulator

A visual, interactive simulator of quantum steganography using the BB84 protocol, quantum error correction, and 6 real-world Eve attack strategies.

## How to Run

```bash
npm install
npm start
```

Opens at http://localhost:3000

## Features

- BB84 quantum encoding with live polarization animation
- 6 Eve attack strategies (Intercept & Resend, Beam Splitting, Selective, Basis Guessing, MITM, None)
- Redundancy levels 1x to 9x (Repetition, 5-Qubit, Steane, Shor codes)
- Live photon animation through quantum channel
- Majority vote error correction visualizer
- Full result dashboard with qubits, errors, stolen bits, detection status

## Stack

- React 18
- Pure JavaScript quantum logic (Qiskit-compatible)
- No backend required — runs entirely in the browser
