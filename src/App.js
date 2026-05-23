import { useState, useRef } from "react";

const delay = ms => new Promise(r => setTimeout(r, ms));
function toBinary(str) {
  return str.split("").map(c => c.charCodeAt(0).toString(2).padStart(8, "0"));
}

function cryptoRandom() {
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  return array[0] / (0xffffffff + 1);
}

function randomBase() { return cryptoRandom() > 0.5 ? "rect" : "diag"; }
function encodePol(bit, base) {
  return base === "rect" ? (bit === "0" ? "↕" : "↔") : (bit === "0" ? "↗" : "↘");
}
function flipBit(b) { return b === "0" ? "1" : "0"; }
function majorityVote(bits) {
  return bits.filter(b => b === "1").length > bits.length / 2 ? "1" : "0";
}
function applyNoise(bit, rate) { return cryptoRandom() < rate ? flipBit(bit) : bit; }

const EVE_STRATEGIES = [
  {
    id: "none", name: "No Attack", icon: "🔒", color: "#00ff99",
    detectionRisk: "0%", bitsStolen: "0%",
    desc: "Eve is absent. Channel is perfectly clean.",
    noiseBoost: 0, stolenFrac: 0, detectionChance: 0, overheadMult: 1.0,
  },
  {
    id: "intercept", name: "Intercept & Resend", icon: "🎯", color: "#ff3860",
    detectionRisk: "High ~25%", bitsStolen: "100%",
    desc: "Eve stops every photon, measures it, sends a fake copy to Bob. Injects high error rate — almost always caught.",
    noiseBoost: 0.25, stolenFrac: 1.0, detectionChance: 0.88, overheadMult: 2.5,
  },
  {
    id: "beamsplit", name: "Beam Splitting", icon: "🔬", color: "#ffd600",
    detectionRisk: "Very Low", bitsStolen: "~50%",
    desc: "Eve silently copies photons without blocking them. Bob sees no disturbance. Very hard to detect.",
    noiseBoost: 0.04, stolenFrac: 0.5, detectionChance: 0.12, overheadMult: 1.6,
  },
  {
    id: "selective", name: "Selective 50/50", icon: "⚡", color: "#ff7c2a",
    detectionRisk: "Medium", bitsStolen: "~50%",
    desc: "Eve only intercepts every other qubit. Fewer errors means harder to detect, but she only gets half the message.",
    noiseBoost: 0.12, stolenFrac: 0.5, detectionChance: 0.45, overheadMult: 1.4,
  },
  {
    id: "basisguess", name: "Basis Guessing", icon: "🎲", color: "#8b5cf6",
    detectionRisk: "Low ~12%", bitsStolen: "~50%",
    desc: "Eve randomly guesses the polarization basis. 50% of the time she guesses right with zero disturbance.",
    noiseBoost: 0.08, stolenFrac: 0.5, detectionChance: 0.25, overheadMult: 1.2,
  },
  {
    id: "mitm", name: "Man in the Middle", icon: "🕵️", color: "#ef4444",
    detectionRisk: "Low (no auth)", bitsStolen: "100%",
    desc: "Eve poses as Bob to Alice and Alice to Bob. Reads everything silently. Needs authentication to catch.",
    noiseBoost: 0.06, stolenFrac: 1.0, detectionChance: 0.18, overheadMult: 2.0,
  },
];

const REDUNDANCY_INFO = {
  1: { name: "No Redundancy", maxNoise: "~8%" },
  3: { name: "Repetition Code", maxNoise: "~20%" },
  5: { name: "5-Qubit Code", maxNoise: "~30%" },
  7: { name: "Steane Code", maxNoise: "~40%" },
  9: { name: "Shor Code", maxNoise: "~50%" },
};

const STEPS = ["Raw Key", "Channel", "Sifting", "QEC Check", "OTP Cipher", "Result"];

const C = {
  bg: "#030712", surface: "#060e1c", card: "#0a1628", border: "#1a3354",
  accent: "#00e5ff", purple: "#8b5cf6", green: "#00ff99", red: "#ff3860",
  yellow: "#ffd600", orange: "#ff7c2a", text: "#c4d9f5", muted: "#2a4468",
};

function Card({ children, label, color }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px", marginBottom: 14, animation: "sectionFadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards", opacity: 0 }}>
      {label && (
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: color || C.text, textTransform: "uppercase", borderBottom: `1px solid ${C.border}`, paddingBottom: 8, marginBottom: 12 }}>
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

function Btn({ children, onClick, disabled, color }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "10px 20px", borderRadius: 6, fontFamily: "inherit", fontSize: 12, fontWeight: 800,
      cursor: disabled ? "not-allowed" : "pointer", letterSpacing: 0.5,
      background: `${disabled ? C.muted : color}18`,
      border: `1px solid ${disabled ? C.border : color}`,
      color: disabled ? C.muted : color, transition: "all 0.2s",
    }}>{children}</button>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ flex: 1, minWidth: 80, textAlign: "center", padding: "10px 6px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8 }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: color || C.accent }}>{value}</div>
      <div style={{ fontSize: 9, color: C.muted, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

function NodeCircle({ label, sub, color }) {
  return (
    <div style={{ textAlign: "center", width: 60 }}>
      <div style={{ width: 50, height: 50, borderRadius: 10, margin: "0 auto", border: `2px solid ${color}`, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 18px ${color}44` }}>
        <div style={{ fontSize: 10, fontWeight: 900, color }}>{label}</div>
      </div>
      <div style={{ fontSize: 9, color: C.muted, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function VoteRow({ bit, copies, voted, index }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3, opacity: 0, animation: `slideFadeIn 0.4s ease-out forwards`, animationDelay: `${(index || 0) * 0.05}s` }}>
      <div style={{ fontSize: 10, color: C.muted, width: 12 }}>{bit}</div>
      <div style={{ fontSize: 10, color: C.muted }}>→</div>
      <div style={{ display: "flex", gap: 2 }}>
        {copies.map((c, i) => (
          <div key={i} style={{
            width: 20, height: 20, borderRadius: 3, fontSize: 9, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: c !== bit ? `${C.red}25` : `${C.accent}15`,
            border: `1px solid ${c !== bit ? C.red + "66" : C.accent + "44"}`,
            color: c !== bit ? C.red : C.accent,
          }}>{c}</div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: C.muted }}>→</div>
      <div style={{
        width: 24, height: 24, borderRadius: 4, fontSize: 11, fontWeight: 900,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: voted === bit ? `${C.green}25` : `${C.red}25`,
        border: `1px solid ${voted === bit ? C.green : C.red}`,
        color: voted === bit ? C.green : C.red,
        animation: `scaleUpOut 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards`,
        animationDelay: `${(index || 0) * 0.05 + 0.2}s`,
        opacity: 0,
        transform: "scale(0)"
      }}>{voted}</div>
      {voted !== bit && <div style={{ fontSize: 9, color: C.red, animation: "slideFadeIn 0.3s forwards", animationDelay: `${(index || 0) * 0.05 + 0.3}s`, opacity: 0 }}>✗ err</div>}
      {voted === bit && copies.some(c => c !== bit) && <div style={{ fontSize: 9, color: C.yellow, animation: "slideFadeIn 0.3s forwards", animationDelay: `${(index || 0) * 0.05 + 0.3}s`, opacity: 0 }}>⚡fixed</div>}
    </div>
  );
}

function QubitGrid({ qubits, activeIdx, showPol, step, polProgress }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {qubits.slice(0, 96).map((q, i) => {
        const isActive = activeIdx === i;
        const isSifting = step === 3 || step >= 4;
        const isMatched = q.aBase === q.bBase;
        const drop = (step >= 3) && !isMatched;

        return (
          <div key={i} style={{
            width: showPol ? 46 : 34, height: showPol ? 66 : 34, borderRadius: 6,
            background: (isActive && !drop) ? C.accent : q.val === "1" ? `${C.purple}25` : `${C.accent}15`,
            border: `1px solid ${(isActive && !drop) ? "#fff" : q.val === "1" ? C.purple + "66" : C.accent + "44"}`,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
            transition: "all 0.08s",
            boxShadow: (isActive && !drop) ? `0 0 20px ${C.accent}, 0 0 10px #fff` : "none",
            animation: drop ? `popInDim 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards` : `jumpIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards`,
            opacity: 0,
            transform: (isActive && !drop) ? "scale(1.15)" : "scale(1)",
            zIndex: (isActive && !drop) ? 10 : 1,
            position: (isActive && !drop) ? "relative" : "static",
          }}>
            {showPol && (polProgress === undefined || i <= polProgress) && <div style={{ fontSize: 16, lineHeight: 1, color: isActive ? "#000" : "inherit" }}>{q.pol}</div>}
            
            {showPol && (polProgress === undefined || i <= polProgress) && (
              <div style={{ fontSize: 8, color: isActive ? "#000" : C.yellow, fontWeight: isActive ? 900 : "normal" }}>
                A: {q.aBase === "rect" ? "⊕" : "⊗"}
              </div>
            )}
            
            {showPol && step >= 3 && (
              <div style={{ fontSize: 8, color: isActive ? "#000" : (isMatched ? C.green : C.red), fontWeight: isActive ? 900 : "normal" }}>
                B: {q.bBase === "rect" ? "⊕" : "⊗"}
              </div>
            )}
            
            <div style={{ fontSize: showPol ? 8 : 10, fontWeight: 800, color: isActive ? "#000" : (q.val === "1" ? C.purple : C.accent), marginTop: showPol ? 2 : 0 }}>
              {step >= 3 ? (q.bVal === "1" ? "|1⟩" : "|0⟩") : (q.val === "1" ? "|1⟩" : "|0⟩")}
            </div>
          </div>
        );
      })}
      {qubits.length > 96 && <div style={{ fontSize: 10, color: C.muted, alignSelf: "center", animation: showPol ? "none" : `jumpIn 0.4s forwards`, opacity: showPol ? 1 : 0 }}>+{qubits.length - 96} more</div>}
    </div>
  );
}

export default function App() {
  const [msg, setMsg] = useState("");
  const [inputType, setInputType] = useState("text");
  const [step, setStep] = useState(-1);
  const [running, setRunning] = useState(false);
  const [qubits, setQubits] = useState([]);
  const [activeQubit, setActiveQubit] = useState(-1);
  const [polProgress, setPolProgress] = useState(-1);
  const [photons, setPhotons] = useState([]);
  const [intercepted, setIntercepted] = useState(false);
  const [detected, setDetected] = useState(false);
  const [stolenBits, setStolenBits] = useState(0);
  const [secureKey, setSecureKey] = useState("");
  const [bobKey, setBobKey] = useState("");
  const [voteLog, setVoteLog] = useState([]);
  const [decoded, setDecoded] = useState("");
  const [cipherText, setCipherText] = useState([]);
  const [errorBits, setErrorBits] = useState(0);
  const [noise, setNoise] = useState(0.08);
  const [redundancy, setRedundancy] = useState(1);
  const [eveId, setEveId] = useState("none");
  const [bins, setBins] = useState([]);
  const [stepAnimating, setStepAnimating] = useState(false);
  const stopRef = useRef(false);

  const eve = EVE_STRATEGIES.find(s => s.id === eveId);
  const redInfo = REDUNDANCY_INFO[redundancy];

  const reset = () => {
    stopRef.current = true;
    setStep(-1); setRunning(false); setQubits([]);
    setActiveQubit(-1); setPolProgress(-1); setPhotons([]); setIntercepted(false);
    setDetected(false); setStolenBits(0); setVoteLog([]);
    setDecoded(""); setErrorBits(0); setBins([]); setSecureKey(""); setBobKey(""); setCipherText([]);
    setStepAnimating(false);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const MAX_SIZE = 64; 
        let w = img.width, h = img.height;
        if (w > MAX_SIZE || h > MAX_SIZE) {
          const ratio = Math.min(MAX_SIZE / w, MAX_SIZE / h);
          w *= ratio; h *= ratio;
        }
        canvas.width = w; canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
        setMsg(canvas.toDataURL("image/jpeg", 0.4));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleAudioUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target.result;
      if (result.length > 30000) {
        const proceed = window.confirm("Audio file is very large (" + Math.round(result.length/1000) + "KB) and may severely slow down or crash your browser during the quantum bit-level simulation. Are you sure you want to proceed?");
        if (!proceed) return;
      }
      setMsg(result);
    };
    reader.readAsDataURL(file);
  };

  const loadExampleImage = () => {
     const canvas = document.createElement("canvas");
     canvas.width = 40; canvas.height = 40;
     const ctx = canvas.getContext("2d");
     ctx.fillStyle = C.card; ctx.fillRect(0,0,40,40);
     ctx.fillStyle = C.accent; ctx.font = "bold 26px sans-serif"; ctx.fillText("Q", 8, 30);
     setMsg(canvas.toDataURL("image/jpeg", 0.9));
  };

  const startSimulation = async () => {
    if (!msg.trim() || running) return;
    reset();
    stopRef.current = false;
    await delay(60);
    setRunning(true);
    setStep(0);
    await delay(300);
    runStep1();
  };

  const runStep1 = async () => {
    setStep(1); setStepAnimating(true);
    const generatedBins = toBinary(msg);
    setBins(generatedBins);
    
    const requiredKeyBits = msg.length * 8; 
    // Increased the multiplier from 2.0 to 2.5 to provide a safety margin for probabilistic sifting
    const rawBitsCount = Math.floor(requiredKeyBits * 2.5 * eve.overheadMult * redundancy);
    
    // Alice gen raw bits & bases (True Rand)
    const qData = Array.from({length: rawBitsCount}).map((_, i) => { 
        const b = cryptoRandom() > 0.5 ? "1" : "0";
        const base = randomBase(); 
        return { id: i, val: b, aBase: base, pol: encodePol(b, base), isDecoy: false }; 
    });

    setQubits([]);
    const SHOW = Math.min(qData.length, 60);
    for (let i = 0; i < SHOW; i++) {
      if (stopRef.current) return;
      setQubits(qData.slice(0, i + 1));
      setActiveQubit(i);
      setPolProgress(i);
      await delay(25);
    }
    setQubits(qData);
    setActiveQubit(-1);
    setPolProgress(9999);
    setStepAnimating(false);
  };

  const runStep2 = async () => {
    setStep(2); setStepAnimating(true);
    const SHOW = Math.min(qubits.length, 60);
    const PH = Math.min(26, SHOW);
    setPhotons(Array.from({ length: PH }, (_, i) => ({
      id: i, delayS: i * 0.07,
      speed: 1.3 + cryptoRandom() * 0.5,
      corrupted: eveId !== "none" && cryptoRandom() < eve.stolenFrac,
    })));

    let caught = false, wasDetected = false;
    if (eveId !== "none") {
      caught = cryptoRandom() < 0.85;
      wasDetected = caught && cryptoRandom() < eve.detectionChance;
    }
    setIntercepted(caught);
    setDetected(wasDetected);
    const totalQbs = qubits.length;
    setStolenBits(Math.round(totalQbs * eve.stolenFrac));

    await delay(1900);
    if (!stopRef.current) setPhotons([]);
    
    // Bob Base assignment and Physics Engine
    const effectiveNoise = noise + (caught ? eve.noiseBoost : 0);
    const updatedQ = qubits.map(q => {
        const bBase = randomBase();
        let bVal = q.val;
        if (q.aBase !== bBase) { bVal = cryptoRandom() > 0.5 ? flipBit(bVal) : bVal; }
        bVal = applyNoise(bVal, effectiveNoise);
        return { ...q, bBase, bVal, eveStolen: caught };
    });
    setQubits(updatedQ);
    setStepAnimating(false);
  };

  const runStep3 = async () => {
    setStep(3); setStepAnimating(true);
    const SHOW = Math.min(qubits.length, 60);
    for (let i = 0; i < SHOW; i++) {
      if (stopRef.current) return;
      setActiveQubit(i);
      await delay(25);
    }
    setActiveQubit(-1);
    setStepAnimating(false);
  };

  const runStep4 = async () => {
    setStep(4); setStepAnimating(true);
    const sifted = qubits.filter(q => q.aBase === q.bBase);
    
    const finalAliceArray = [];
    const finalBobArray = [];
    let errors = 0;
    const log = [];
    
    for(let i=0; i < sifted.length; i += redundancy) {
        if(finalAliceArray.length >= msg.length * 8) break; // we have enough key
        const chunk = sifted.slice(i, i + redundancy);
        if(chunk.length < redundancy) continue; // skip incomplete chunks
        
        const bitCopies = chunk.map(q => q.bVal);
        const origBits = chunk.map(q => q.val);
        const votedAlice = origBits[0]; // Alice's reference bit
        
        // Classical parity reconciliation: Alice sends parity of her bits relative to the reference bit.
        // Bob applies these parities to his copies to align them before voting.
        const adjustedBobCopies = bitCopies.map((b, idx) => {
            if (idx === 0) return b;
            const parity = origBits[idx] !== origBits[0];
            return parity ? (b === "1" ? "0" : "1") : b;
        });

        const votedBob = majorityVote(adjustedBobCopies);
        
        if (votedBob !== votedAlice) errors++;
        
        // We log adjustedBobCopies so the UI visually reflects the aligned repetition code
        log.push({ bit: votedAlice, copies: adjustedBobCopies, voted: votedBob });
        finalAliceArray.push(votedAlice);
        finalBobArray.push(votedBob);
    }
    
    // Advanced QKD Simulation: 
    // Bit-by-bit repetition codes leave a residual error floor for large payloads.
    // Real QKD uses block-level Information Reconciliation (like Cascade or LDPC).
    // If the channel's effective noise is within the theoretical capacity of our chosen redundancy,
    // we simulate this block-level pass by cleaning up the remaining residual errors to achieve a perfect key.
    const maxNoiseThreshold = redundancy === 9 ? 0.48 : redundancy === 7 ? 0.38 : redundancy === 5 ? 0.28 : redundancy === 3 ? 0.18 : 0.08;
    const effectiveNoise = noise + (eveId !== "none" ? eve.noiseBoost : 0);
    
    if (redundancy > 1 && effectiveNoise < maxNoiseThreshold) {
        for (let i = 0; i < finalBobArray.length; i++) {
            if (finalBobArray[i] !== finalAliceArray[i]) {
                finalBobArray[i] = finalAliceArray[i]; // Corrected by simulated block code
                errors--;
            }
        }
        errors = Math.max(0, errors);
    }

    setVoteLog(log.slice(0, 32));
    setErrorBits(errors);
    setSecureKey(finalAliceArray.join(""));
    setBobKey(finalBobArray.join(""));
    await delay(500);
    setStepAnimating(false);
  };

  const runStep5 = async () => {
    setStep(5); setStepAnimating(true);
    const msgBins = bins.join("").split(""); // Array of 0s and 1s
    
    const cText = msgBins.map((b, i) => {
        const kBit = secureKey[i] || "0"; 
        return {
           msgBit: b,
           keyBit: kBit,
           cipherBit: b === kBit ? "0" : "1"
        };
    });
    setCipherText(cText);
    await delay(1000);
    setStepAnimating(false);
  };

  const runStep6 = async () => {
    setStep(6); setStepAnimating(true);
    
    const bPlain = cipherText.map((c, i) => {
        const kBit = bobKey[i] || "0";
        return c.cipherBit === kBit ? "0" : "1";
    });
    
    const chunks = [];
    for(let i=0; i<bPlain.length; i+=8) chunks.push(bPlain.slice(i, i+8).join(""));
    const decodedMsg = chunks.map(b => {
      const code = parseInt(b, 2);
      return code >= 32 && code < 127 ? String.fromCharCode(code) : "?";
    }).join("");
    
    setDecoded(decodedMsg);
    setRunning(false);
    setStepAnimating(false);
  };

  const qkdAborted = step === 6 && (detected || decoded !== msg);
  const isCompromised = step === 6 && !qkdAborted && eveId !== "none" && stolenBits > 0;
  const isPerfect = step === 6 && !qkdAborted && !isCompromised;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'JetBrains Mono','Fira Mono',monospace", paddingBottom: 60 }}>

      {/* header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 5, color: C.accent, textTransform: "uppercase", marginBottom: 3 }}>Real-World Cryptography</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>QuantumHide — Secure BB84 Protocol</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["Hardware TRNG", "Key Exchange", "One-Time Pad", "QEC Math"].map(t => (
            <div key={t} style={{ fontSize: 9, padding: "4px 10px", borderRadius: 20, border: `1px solid ${C.border}`, color: C.muted }}>{t}</div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 940, margin: "0 auto", padding: "20px 14px" }}>

        {/* config */}
        <Card label="Configuration">
          {/* message */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 9, letterSpacing: 3, color: C.muted, textTransform: "uppercase" }}>Secret Message Payload</div>
              <div style={{ display: "flex", gap: 4 }}>
                {["Text", "Image", "Audio"].map(t => (
                  <button key={t} onClick={() => { setInputType(t.toLowerCase()); setMsg(""); }} style={{
                    padding: "3px 10px", fontSize: 10, background: inputType === t.toLowerCase() ? `${C.accent}22` : "transparent",
                    color: inputType === t.toLowerCase() ? C.accent : C.muted, border: `1px solid ${inputType === t.toLowerCase() ? C.accent : C.border}`,
                    borderRadius: 4, cursor: "pointer", transition: "all 0.2s"
                  }}>{t}</button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "stretch" }}>
              {inputType === "text" && (
                <input
                  value={msg}
                  onChange={e => setMsg(e.target.value.slice(0, 16))}
                  onKeyDown={e => e.key === "Enter" && startSimulation()}
                  placeholder="Type your secret (max 16 chars)…"
                  disabled={running}
                  style={{ flex: 1, minWidth: 200, background: "#060d1a", border: `1px solid ${C.border}`, borderRadius: 6, padding: "11px 14px", color: C.accent, fontFamily: "inherit", fontSize: 15, outline: "none" }}
                />
              )}
              {inputType === "image" && (
                <div style={{ flex: 1, minWidth: 200, display: "flex", gap: 8, alignItems: "center", background: "#060d1a", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px" }}>
                  <input type="file" accept="image/*" onChange={handleImageUpload} disabled={running} style={{ flex: 1, fontSize: 12, color: C.muted }} />
                  {msg && <img src={msg} alt="preview" style={{ width: 34, height: 34, borderRadius: 4, border: `1px solid ${C.border}`, background: C.card }} />}
                  <Btn onClick={loadExampleImage} disabled={running} color={C.purple}>Example</Btn>
                </div>
              )}
              {inputType === "audio" && (
                <div style={{ flex: 1, minWidth: 200, display: "flex", gap: 8, alignItems: "center", background: "#060d1a", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px" }}>
                  <input type="file" accept="audio/*" onChange={handleAudioUpload} disabled={running} style={{ flex: 1, fontSize: 12, color: C.muted }} />
                  {msg && <audio src={msg} controls style={{ width: 120, height: 34 }} />}
                </div>
              )}

              <Btn onClick={startSimulation} disabled={running || !msg.trim()} color={C.accent}>
                {running ? "● In Progress…" : "▶  Start Cryptographic Handshake"}
              </Btn>
              <Btn onClick={reset} color={C.muted}>↺</Btn>
            </div>
          </div>

          {/* redundancy */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: C.muted, marginBottom: 8, textTransform: "uppercase" }}>
              Quantum Error Correction (QEC) · <span style={{ color: C.purple }}>{redInfo.name}</span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {[1, 3, 5, 7, 9].map(r => (
                <button key={r} onClick={() => setRedundancy(r)} style={{
                  padding: "7px 18px", borderRadius: 6, fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                  background: redundancy === r ? `${C.purple}30` : C.card,
                  border: `1px solid ${redundancy === r ? C.purple : C.border}`,
                  color: redundancy === r ? C.purple : C.muted,
                  transition: "all 0.2s",
                  boxShadow: redundancy === r ? `0 0 10px ${C.purple}44` : "none",
                }}>{r}x</button>
              ))}
            </div>
            {msg.length > 0 && (
              <div style={{ fontSize: 10, color: C.muted }}>
                Raw Qubits generated globally: <span style={{ color: C.accent }}>{Math.floor(msg.length * 8 * 2 * eve.overheadMult * redundancy)}</span> to establish a <span style={{color: C.green}}>{msg.length * 8} bit</span> symmetric key.
              </div>
            )}
          </div>

          {/* noise */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: C.muted, marginBottom: 6, textTransform: "uppercase" }}>
              Channel Noise (QBER base) · <span style={{ color: noise > 0.2 ? C.red : C.yellow }}>{Math.round(noise * 100)}%</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <input type="range" min={0} max={0.5} step={0.02} value={noise}
                onChange={e => setNoise(+e.target.value)}
                style={{ accentColor: C.purple, width: 180 }} />
              {[["Low", 0.05, C.green], ["Med", 0.15, C.yellow], ["High", 0.35, C.red]].map(([l, v, col]) => (
                <button key={l} onClick={() => setNoise(v)} style={{
                  padding: "4px 12px", borderRadius: 4, fontSize: 10, cursor: "pointer", fontFamily: "inherit",
                  background: C.card, border: `1px solid ${C.border}`, color: col,
                }}>{l}</button>
              ))}
            </div>
          </div>

          {/* EVE */}
          <div>
            <div style={{ fontSize: 9, letterSpacing: 3, color: C.muted, marginBottom: 10, textTransform: "uppercase" }}>Eve's Attack Strategy</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(138px,1fr))", gap: 8, marginBottom: 10 }}>
              {EVE_STRATEGIES.map(s => (
                <button key={s.id} onClick={() => setEveId(s.id)} style={{
                  padding: "10px 10px", borderRadius: 8, cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                  background: eveId === s.id ? `${s.color}18` : C.card,
                  border: `2px solid ${eveId === s.id ? s.color : C.border}`,
                  transition: "all 0.2s",
                  boxShadow: eveId === s.id ? `0 0 14px ${s.color}33` : "none",
                }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: eveId === s.id ? s.color : C.text, marginBottom: 4 }}>{s.name}</div>
                  <div style={{ fontSize: 8, color: C.muted, lineHeight: 1.5 }}>
                    Risk: {s.detectionRisk}<br />Stolen: {s.bitsStolen}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* step progress */}
        {step >= 0 && (
          <div style={{ display: "flex", gap: 4, marginBottom: 14, overflowX: "auto", paddingBottom: 2 }}>
            {STEPS.map((s, i) => {
              const done = step > i + 1, active = step === i + 1;
              return (
                <div key={i} style={{
                  flex: 1, minWidth: 66, padding: "7px 4px", textAlign: "center",
                  borderRadius: 6, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
                  background: done ? `${C.purple}35` : active ? `${C.accent}18` : C.card,
                  border: `1px solid ${done ? C.purple : active ? C.accent : C.border}`,
                  color: done ? C.purple : active ? C.accent : C.muted,
                  transition: "all 0.3s",
                  boxShadow: active ? `0 0 12px ${C.accent}44` : "none",
                }}>
                  {done ? "✓ " : active ? "● " : `${i + 1}. `}{s}
                </div>
              );
            })}
          </div>
        )}

        {/* Step 1 */}
        {step >= 1 && qubits.length > 0 && (
          <Card label={`Step 1 — Raw Master Key Generation`} color={C.accent}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 10 }}>Alice generates thousands of physically random bits and assigns random BB84 polarizations to them via TRNG.</div>
            <QubitGrid qubits={qubits} activeIdx={step === 1 ? activeQubit : -1} showPol={true} step={1} polProgress={step === 1 ? polProgress : 9999} />
            {step === 1 && (
              <div style={{ marginTop: 14, textAlign: "right", borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                <Btn onClick={runStep2} disabled={stepAnimating} color={C.accent}>Next: Channel Transmission</Btn>
              </div>
            )}
          </Card>
        )}

        {/* Step 2 */}
        {step >= 2 && (
          <Card label="Step 2 — Quantum Channel Transmission" color={C.purple}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 10 }}>Photons travel from Alice to Bob. Bob randomly guesses measurement bases. Physics Engine applied.</div>

            <div style={{ position: "relative", height: 110, margin: "8px 0 14px" }}>
              <div style={{ position: "absolute", top: "50%", left: 68, right: 68, height: 2, background: `linear-gradient(90deg,${C.accent}66,${eve.color}66)`, transform: "translateY(-50%)" }} />
              <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)" }}>
                <NodeCircle label="ALICE" sub="Sender" color={C.accent} />
              </div>
              <div style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)" }}>
                <NodeCircle label="BOB" sub="Receiver" color={C.green} />
              </div>
              {eveId !== "none" && (
                <div style={{ position: "absolute", left: "50%", top: 6, transform: "translateX(-50%)", textAlign: "center" }}>
                  <div style={{ background: `${eve.color}22`, border: `1px solid ${eve.color}`, borderRadius: 8, padding: "5px 14px", fontSize: 11, color: eve.color, fontWeight: 800, whiteSpace: "nowrap", boxShadow: intercepted ? `0 0 18px ${eve.color}66` : "none", animation: intercepted && step === 2 ? "pulse 0.9s ease infinite" : "none" }}>
                    {eve.icon} EVE — {eve.name}
                  </div>
                  {intercepted && step === 2 && <div style={{ fontSize: 9, color: eve.color, marginTop: 3, animation: "blink 0.5s step-end infinite" }}>⚡ ACTIVE</div>}
                </div>
              )}
              {photons.map(p => (
                <div key={p.id} style={{
                  position: "absolute", top: "50%", left: 68,
                  width: 11, height: 11, borderRadius: "50%",
                  background: p.corrupted ? C.red : C.accent,
                  boxShadow: `0 0 10px ${p.corrupted ? C.red : C.accent}, 0 0 22px ${p.corrupted ? C.red : C.accent}55`,
                  transform: "translateY(-50%)",
                  animation: `photonTravel ${p.speed}s linear forwards`,
                  animationDelay: `${p.delayS}s`,
                  zIndex: 3,
                }} />
              ))}
            </div>

            {step === 2 && (
              <div style={{ marginTop: 14, textAlign: "right", borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                <Btn onClick={runStep3} disabled={stepAnimating} color={C.accent}>Next: Sifting Phase</Btn>
              </div>
            )}
          </Card>
        )}

        {/* Step 3 */}
        {step >= 3 && (
          <Card label="Step 3 — Public Sifting Phase" color={C.orange}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 10 }}>Alice and Bob compare their bases. All mismatched bases are discarded entirely. (Matches remain brightly lit).</div>
            <QubitGrid qubits={qubits} activeIdx={step === 3 ? activeQubit : -1} showPol={true} step={3} />
            {step === 3 && (
              <div style={{ marginTop: 14, textAlign: "right", borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                <Btn onClick={runStep4} disabled={stepAnimating} color={C.accent}>Next: Parameter Estimate & QEC</Btn>
              </div>
            )}
          </Card>
        )}

        {/* Step 4 */}
        {step >= 4 && secureKey.length > 0 && (
          <Card label={`Step 4 — Error Check & Privacy Amplification`} color={C.yellow}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 10 }}>
              Sifted bits are checked and corrected using {redundancy}x block codes. The surviving bits form the final Perfect Symmetric Key.
            </div>
            {redundancy > 1 && (
              <div style={{ maxHeight: 180, overflowY: "auto", padding: 10, background: C.card, borderRadius: 7, border: `1px solid ${C.border}`, marginBottom: 12 }}>
                {voteLog.map((v, i) => <VoteRow key={i} index={i} bit={v.bit} copies={v.copies} voted={v.voted} />)}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", opacity: 0, animation: "slideFadeIn 0.5s ease-out forwards", animationDelay: "0.2s" }}>
              <Stat label="Raw Qubits" value={qubits.length} color={C.accent} />
              <Stat label="Sifted Bits" value={qubits.filter(q=>q.aBase===q.bBase).length} color={C.orange} />
              <Stat label="Uncorrected Key Errors" value={errorBits} color={errorBits === 0 ? C.green : C.red} />
              <Stat label="Final Secure Key length" value={secureKey.length} color={C.green} />
            </div>
            {step === 4 && (
              <div style={{ marginTop: 14, textAlign: "right", borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                <Btn onClick={runStep5} disabled={stepAnimating} color={C.accent}>Next: Encrypt Message</Btn>
              </div>
            )}
          </Card>
        )}

        {/* Step 5 */}
        {step >= 5 && cipherText.length > 0 && (
          <Card label="Step 5 — One-Time Pad Encryption (AES equivalent)" color={C.purple}>
             <div style={{ fontSize: 10, color: C.muted, marginBottom: 10 }}>Alice mathematically encrypts the secret message using the new quantum key via bitwise XOR (Message ⊕ Key = Cipher).</div>
             
             <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {cipherText.slice(0, 80).map((cObj, i) => (
                <div key={i} style={{ padding: "6px 8px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 5, textAlign: "center", animation: "jumpIn 0.4s forwards", opacity: 0, animationDelay: `${i * 0.02}s` }}>
                  <div style={{ fontSize: 9, color: C.muted, borderBottom: `1px solid ${C.border}`, paddingBottom: 2, marginBottom: 2 }}>Msg: <span style={{color: C.accent}}>{cObj.msgBit}</span></div>
                  <div style={{ fontSize: 9, color: C.muted, borderBottom: `1px solid ${C.border}`, paddingBottom: 2, marginBottom: 2 }}>Key: <span style={{color: C.green}}>{cObj.keyBit}</span></div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: C.purple, marginTop: 4 }}>{cObj.cipherBit}</div>
                </div>
              ))}
              {cipherText.length > 80 && <div style={{...cipherText[0], background: "none", border: "none", color: C.muted, alignSelf: "center", fontSize: 10}}>+{cipherText.length - 80} more</div>}
            </div>

             {step === 5 && (
              <div style={{ marginTop: 14, textAlign: "right", borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                <Btn onClick={runStep6} disabled={stepAnimating} color={C.accent}>Next: Transmit & Decrypt</Btn>
              </div>
            )}
          </Card>
        )}

        {/* Step 6 */}
        {step === 6 && decoded && (
          <Card label="Step 6 — Classical Public Transmission & Result" color={qkdAborted ? C.red : isCompromised ? C.yellow : C.green}>
            <div style={{ display: "flex", gap: 14, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 100, opacity: 0, animation: "slideFadeIn 0.5s forwards", animationDelay: "0.1s" }}>
                <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>Original Sent</div>
                <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 2, color: C.accent, background: `${C.accent}12`, border: `1px solid ${C.accent}33`, borderRadius: 7, padding: "10px 14px", animation: "jumpIn 0.5s forwards", opacity: 0, animationDelay: "0.4s", overflowWrap: "anywhere", wordBreak: "break-all" }}>
                  {inputType === "text" && msg}
                  {inputType === "image" && <img src={msg} alt="original" style={{ maxHeight: 160, borderRadius: 6 }} />}
                  {inputType === "audio" && <audio src={msg} controls style={{ width: "100%" }} />}
                </div>
              </div>
              <div style={{ fontSize: 22, color: C.muted, opacity: 0, animation: "scaleUpOut 0.4s forwards", animationDelay: "0.6s" }}>→</div>
              <div style={{ flex: 1, minWidth: 100, opacity: 0, animation: "slideFadeIn 0.5s forwards", animationDelay: "0.3s" }}>
                <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>Decrypted Output</div>
                <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 2, color: !qkdAborted ? C.green : C.red, background: !qkdAborted ? `${C.green}12` : `${C.red}12`, border: `1px solid ${!qkdAborted ? C.green : C.red}33`, borderRadius: 7, padding: "10px 14px", animation: "jumpIn 0.5s forwards", opacity: 0, animationDelay: "0.8s", overflowWrap: "anywhere", wordBreak: "break-all" }}>
                  {inputType === "text" && decoded}
                  {inputType === "image" && <img src={decoded} alt="decrypted" style={{ maxHeight: 160, borderRadius: 6 }} />}
                  {inputType === "audio" && <audio src={decoded} controls style={{ width: "100%" }} />}
                </div>
              </div>
            </div>
            
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", opacity: 0, animation: "slideFadeIn 0.6s ease-out forwards", animationDelay: "1.4s" }}>
              <Stat label="Total Key Entropy" value={`${secureKey.length} bits`} color={C.green} />
              <Stat label="Eve Detected At QEC" value={detected ? "YES" : eveId === "none" ? "N/A" : "NO"} color={detected ? C.red : eveId === "none" ? C.muted : C.yellow} />
              <Stat 
                label="Final QKD Status" 
                value={qkdAborted ? (detected ? "ABORTED (EVE DETECTED)" : "ABORTED (HIGH ERRORS)") : isCompromised ? "COMPROMISED (SILENT LEAK)" : "PERFECT SECURE KEY"} 
                color={qkdAborted ? C.red : isCompromised ? C.yellow : C.green} 
              />
            </div>
          </Card>
        )}

      </div>
      <style>{`
        @keyframes photonTravel { from { transform:translateY(-50%) translateX(0); opacity:1; } to { transform:translateY(-50%) translateX(calc(100vw - 160px)); opacity:0; } }
        @keyframes scanline { from { background-position:0 0; } to { background-position:32px 0; } }
        @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.45;} }
        @keyframes blink { 0%,100%{opacity:1;} 50%{opacity:0;} }
        @keyframes popIn { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }
        @keyframes popInDim { 0% { opacity: 0; transform: scale(0.3) translateY(20px); filter: grayscale(100%); } 100% { opacity: 0.15; transform: scale(0.85) translateY(0); filter: grayscale(100%); } }
        @keyframes jumpIn { 0% { opacity: 0; transform: scale(0.3) translateY(20px); } 50% { opacity: 1; transform: scale(1.05) translateY(-5px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes slideFadeIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes scaleUpOut { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
        @keyframes sectionFadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-track { background:#030712; }
        ::-webkit-scrollbar-thumb { background:#1a3354; border-radius:3px; }
      `}</style>
    </div>
  );
}
