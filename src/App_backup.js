import { useState, useRef } from "react";

const delay = ms => new Promise(r => setTimeout(r, ms));
function toBinary(str) {
  return str.split("").map(c => c.charCodeAt(0).toString(2).padStart(8, "0"));
}
function randomBase() { return Math.random() > 0.5 ? "rect" : "diag"; }
function encodePol(bit, base) {
  return base === "rect" ? (bit === "0" ? "↕" : "↔") : (bit === "0" ? "↗" : "↘");
}
function flipBit(b) { return b === "0" ? "1" : "0"; }
function majorityVote(bits) {
  return bits.filter(b => b === "1").length > bits.length / 2 ? "1" : "0";
}
function applyNoise(bit, rate) { return Math.random() < rate ? flipBit(bit) : bit; }

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

const STEPS = ["Message", "Binary", "Qubits", "Encode", "Channel", "Vote", "Result"];

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

function QubitGrid({ qubits, activeIdx, showPol, polProgress }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {qubits.slice(0, 72).map((q, i) => {
        const isActive = activeIdx === i;
        return (
          <div key={i} style={{
            width: showPol ? 46 : 34, height: showPol ? 54 : 34, borderRadius: 6,
            background: isActive ? C.accent : q.val === "1" ? `${C.purple}25` : `${C.accent}15`,
            border: `1px solid ${isActive ? "#fff" : q.val === "1" ? C.purple + "66" : C.accent + "44"}`,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
            transition: "all 0.08s",
            boxShadow: isActive ? `0 0 20px ${C.accent}, 0 0 10px #fff` : "none",
            animation: `jumpIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards`,
            opacity: 0,
            transform: isActive ? "scale(1.15)" : "scale(1)",
            zIndex: isActive ? 10 : 1,
            position: isActive ? "relative" : "static",
          }}>
            {showPol && (polProgress === undefined || i <= polProgress) && <div style={{ fontSize: 16, lineHeight: 1, color: isActive ? "#000" : "inherit" }}>{q.pol}</div>}
            {showPol && (polProgress === undefined || i <= polProgress) && <div style={{ fontSize: 8, color: isActive ? "#000" : C.yellow, fontWeight: isActive ? 900 : "normal" }}>{q.base === "rect" ? "⊕" : "⊗"}</div>}
            <div style={{ fontSize: showPol ? 8 : 10, fontWeight: 800, color: isActive ? "#000" : (q.val === "1" ? C.purple : C.accent) }}>
              {q.val === "1" ? "|1⟩" : "|0⟩"}
            </div>
          </div>
        );
      })}
      {qubits.length > 72 && <div style={{ fontSize: 10, color: C.muted, alignSelf: "center", animation: showPol ? "none" : `jumpIn 0.4s forwards`, opacity: showPol ? 1 : 0 }}>+{qubits.length - 72} more</div>}
    </div>
  );
}

export default function App() {
  const [msg, setMsg] = useState("");
  const [step, setStep] = useState(-1);
  const [running, setRunning] = useState(false);
  const [chars, setChars] = useState([]);
  const [activeChar, setActiveChar] = useState(-1);
  const [qubits, setQubits] = useState([]);
  const [activeQubit, setActiveQubit] = useState(-1);
  const [polProgress, setPolProgress] = useState(-1);
  const [photons, setPhotons] = useState([]);
  const [intercepted, setIntercepted] = useState(false);
  const [detected, setDetected] = useState(false);
  const [stolenBits, setStolenBits] = useState(0);
  const [voteLog, setVoteLog] = useState([]);
  const [decoded, setDecoded] = useState("");
  const [errorBits, setErrorBits] = useState(0);
  const [noise, setNoise] = useState(0.08);
  const [redundancy, setRedundancy] = useState(1);
  const [eveId, setEveId] = useState("none");
  const [bins, setBins] = useState([]);
  const [decodedBins, setDecodedBins] = useState([]);
  const [stepAnimating, setStepAnimating] = useState(false);
  const stopRef = useRef(false);

  const eve = EVE_STRATEGIES.find(s => s.id === eveId);
  const redInfo = REDUNDANCY_INFO[redundancy];

  const reset = () => {
    stopRef.current = true;
    setStep(-1); setRunning(false); setChars([]); setQubits([]);
    setActiveChar(-1); setActiveQubit(-1); setPolProgress(-1); setPhotons([]); setIntercepted(false);
    setDetected(false); setStolenBits(0); setVoteLog([]);
    setDecoded(""); setErrorBits(0); setBins([]); setDecodedBins([]);
    setStepAnimating(false);
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
    const cData = msg.split("").map((c, i) => ({ char: c, bin: generatedBins[i] }));
    for (let i = 0; i < cData.length; i++) {
      if (stopRef.current) return;
      setChars(cData.slice(0, i + 1));
      setActiveChar(i);
      await delay(120);
    }
    setActiveChar(-1);
    setStepAnimating(false);
  };

  const runStep2 = async () => {
    setStep(2); setStepAnimating(true);
    const allBits = bins.join("").split("");
    const overheadBitsCount = Math.floor(allBits.length * (eve.overheadMult - 1.0));
    const extraBits = Array.from({ length: overheadBitsCount }, () => Math.random() > 0.5 ? "1" : "0");
    const combinedBits = [...allBits, ...extraBits];
    const qData = combinedBits.map((b, i) => { const base = randomBase(); return { val: b, base, pol: encodePol(b, base), isDecoy: i >= allBits.length }; });

    setQubits([]);
    const SHOW = Math.min(qData.length, 60);
    for (let i = 0; i < SHOW; i++) {
      if (stopRef.current) return;
      setQubits(qData.slice(0, i + 1));
      setActiveQubit(i);
      await delay(40);
    }
    setQubits(qData);
    setActiveQubit(-1);
    setStepAnimating(false);
  };

  const runStep3 = async () => {
    setStep(3); setStepAnimating(true);
    const SHOW = Math.min(qubits.length, 60);
    setPolProgress(-1);
    for (let i = 0; i < SHOW; i++) {
      if (stopRef.current) return;
      setActiveQubit(i);
      setPolProgress(i);
      await delay(42);
    }
    setActiveQubit(-1);
    setPolProgress(9999);
    setStepAnimating(false);
  };

  const runStep4 = async () => {
    setStep(4); setStepAnimating(true);
    const allBits = bins.join("").split("");
    const SHOW = Math.min(qubits.length, 60);
    const PH = Math.min(26, SHOW);
    setPhotons(Array.from({ length: PH }, (_, i) => ({
      id: i, delayS: i * 0.07,
      speed: 1.3 + Math.random() * 0.5,
      corrupted: eveId !== "none" && Math.random() < eve.stolenFrac,
    })));

    let caught = false, wasDetected = false;
    if (eveId !== "none") {
      caught = Math.random() < 0.85;
      wasDetected = caught && Math.random() < eve.detectionChance;
    }
    setIntercepted(caught);
    setDetected(wasDetected);
    const totalQbs = Math.floor(msg.length * 8 * redundancy * eve.overheadMult);
    setStolenBits(Math.round(totalQbs * eve.stolenFrac));

    await delay(1900);
    if (!stopRef.current) setPhotons([]);
    setStepAnimating(false);
  };

  const runStep5 = async () => {
    setStep(5); setStepAnimating(true);
    const effectiveNoise = noise + (intercepted ? eve.noiseBoost : 0);
    const log = [];
    let errors = 0;

    const computedDecodedBins = bins.map(bin =>
      bin.split("").map(bit => {
        const copies = Array.from({ length: redundancy }, () => applyNoise(bit, effectiveNoise));
        const voted = majorityVote(copies);
        if (voted !== bit) errors++;
        log.push({ bit, copies, voted });
        return voted;
      }).join("")
    );

    setDecodedBins(computedDecodedBins);
    setVoteLog(log.slice(0, 32));
    setErrorBits(errors);
    await delay(500);
    setStepAnimating(false);
  };

  const runStep6 = async () => {
    setStep(6); setStepAnimating(true);
    const decodedMsg = decodedBins.map(b => {
      const code = parseInt(b, 2);
      return code >= 32 && code < 127 ? String.fromCharCode(code) : "?";
    }).join("");
    setDecoded(decodedMsg);
    setRunning(false);
    setStepAnimating(false);
  };

  const success = step === 6 && decoded === msg;
  const totalQubits = Math.floor(msg.length > 0 ? msg.length * 8 * redundancy * eve.overheadMult : 0);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'JetBrains Mono','Fira Mono',monospace", paddingBottom: 60 }}>

      {/* header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 5, color: C.accent, textTransform: "uppercase", marginBottom: 3 }}>Quantum Steganography</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>QuantumHide — Secret Message Simulator</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["BB84 Protocol", "QEC Redundancy", "Eve Attacks"].map(t => (
            <div key={t} style={{ fontSize: 9, padding: "4px 10px", borderRadius: 20, border: `1px solid ${C.border}`, color: C.muted }}>{t}</div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 940, margin: "0 auto", padding: "20px 14px" }}>

        {/* config */}
        <Card label="Configuration">

          {/* message */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: C.muted, marginBottom: 6, textTransform: "uppercase" }}>Secret Message</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                value={msg}
                onChange={e => setMsg(e.target.value.slice(0, 16))}
                onKeyDown={e => e.key === "Enter" && startSimulation()}
                placeholder="Type your secret (max 16 chars)…"
                disabled={running}
                style={{ flex: 1, minWidth: 200, background: "#060d1a", border: `1px solid ${C.border}`, borderRadius: 6, padding: "11px 14px", color: C.accent, fontFamily: "inherit", fontSize: 15, outline: "none" }}
              />
              <Btn onClick={startSimulation} disabled={running || !msg.trim()} color={C.accent}>
                {running ? "● In Progress…" : "▶  Start"}
              </Btn>
              <Btn onClick={reset} color={C.muted}>↺</Btn>
            </div>
          </div>

          {/* redundancy */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: C.muted, marginBottom: 8, textTransform: "uppercase" }}>
              Redundancy · <span style={{ color: C.purple }}>{redInfo.name}</span>
              <span style={{ color: C.muted }}> · survives up to {redInfo.maxNoise} noise</span>
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
                Physical qubits needed: <span style={{ color: C.accent }}>{totalQubits}</span>
                &nbsp;({msg.length} chars × 8 bits × {redundancy}x × {eve.overheadMult}x sifting overhead)
              </div>
            )}
          </div>

          {/* noise */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: C.muted, marginBottom: 6, textTransform: "uppercase" }}>
              Channel Noise · <span style={{ color: noise > 0.2 ? C.red : C.yellow }}>{Math.round(noise * 100)}%</span>
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
            {eveId !== "none" && (
              <div style={{ padding: "10px 14px", borderRadius: 7, background: `${eve.color}12`, border: `1px solid ${eve.color}33`, fontSize: 11, color: eve.color, lineHeight: 1.6 }}>
                {eve.icon} &nbsp;<strong>{eve.name}</strong> — {eve.desc}
              </div>
            )}
          </div>
        </Card>

        {/* step progress */}
        {step >= 0 && (
          <div style={{ display: "flex", gap: 4, marginBottom: 14, overflowX: "auto", paddingBottom: 2 }}>
            {STEPS.map((s, i) => {
              const done = step > i, active = step === i;
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
        {step >= 1 && chars.length > 0 && (
          <Card label="Step 1 — Text → Binary (ASCII)" color={C.yellow}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 10 }}>Each character → ASCII code → 8 binary digits</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {chars.map((c, i) => {
                const isActive = activeChar === i;
                return (
                  <div key={i} style={{ background: isActive ? `${C.accent}30` : "#060e1a", border: `1px solid ${isActive ? C.accent : C.border}`, boxShadow: isActive ? `0 0 16px ${C.accent}` : "none", transition: "all 0.08s", borderRadius: 8, padding: "8px 10px", textAlign: "center", minWidth: 58, animation: "jumpIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards", opacity: 0 }}>
                    <div style={{ fontSize: 20, color: isActive ? "#fff" : C.accent, fontWeight: 900, marginBottom: 4 }}>{c.char === " " ? "·" : c.char}</div>
                    <div style={{ fontSize: 9, color: isActive ? "#fff" : C.yellow, letterSpacing: 1, fontWeight: 700 }}>
                      {c.bin.slice(0, 4)}<span style={{ color: isActive ? "#fff" : C.orange }}>{c.bin.slice(4)}</span>
                    </div>
                    <div style={{ fontSize: 9, color: isActive ? "#fff" : C.muted, marginTop: 2 }}>{c.char.charCodeAt(0)}</div>
                  </div>
                )
              })}
            </div>
            {step === 1 && (
              <div style={{ marginTop: 14, textAlign: "right", borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                <Btn onClick={runStep2} disabled={stepAnimating} color={C.accent}>Next: Generate Qubits</Btn>
              </div>
            )}
          </Card>
        )}

        {/* Step 2 */}
        {step >= 2 && qubits.length > 0 && (
          <Card label={`Step 2 — ${qubits.length} Qubits Generated`} color={C.accent}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 10 }}>Each bit → quantum state. Cyan = |0⟩ · Purple = |1⟩</div>
            <QubitGrid qubits={qubits} activeIdx={step === 2 ? activeQubit : -1} showPol={false} />
            {step === 2 && (
              <div style={{ marginTop: 14, textAlign: "right", borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                <Btn onClick={runStep3} disabled={stepAnimating} color={C.accent}>Next: BB84 Encoding</Btn>
              </div>
            )}
          </Card>
        )}

        {/* Step 3 */}
        {step >= 3 && qubits.length > 0 && (
          <Card label="Step 3 — BB84 Polarization Encoding" color={C.orange}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 10 }}>Random basis assigned. ⊕ rectilinear (↕↔) · ⊗ diagonal (↗↘). Watch qubits light up.</div>
            <QubitGrid qubits={qubits} activeIdx={step === 3 ? activeQubit : -1} showPol={true} polProgress={step === 3 ? polProgress : 9999} />
            <div style={{ marginTop: 8, fontSize: 9, color: C.muted }}>↕=0(⊕) · ↔=1(⊕) · ↗=0(⊗) · ↘=1(⊗)</div>
            {step === 3 && (
              <div style={{ marginTop: 14, textAlign: "right", borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                <Btn onClick={runStep4} disabled={stepAnimating} color={C.accent}>Next: Channel Transmission</Btn>
              </div>
            )}
          </Card>
        )}

        {/* Step 4 */}
        {step >= 4 && (
          <Card label="Step 4 — Quantum Channel Transmission" color={C.purple}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 10 }}>Photons travel from Alice to Bob. Any measurement disturbs the quantum state.</div>

            <div style={{ position: "relative", height: 110, margin: "8px 0 14px" }}>
              <div style={{ position: "absolute", top: "50%", left: 68, right: 68, height: 2, background: `linear-gradient(90deg,${C.accent}66,${eve.color}66)`, transform: "translateY(-50%)" }} />
              {eveId !== "none" && (
                <div style={{ position: "absolute", top: "50%", left: 68, right: 68, height: 2, transform: "translateY(-50%)", background: `repeating-linear-gradient(90deg,transparent 0,transparent 8px,${eve.color}88 8px,${eve.color}88 16px)`, animation: "scanline 1.2s linear infinite" }} />
              )}
              <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)" }}>
                <NodeCircle label="ALICE" sub="Sender" color={C.accent} />
              </div>
              <div style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)" }}>
                <NodeCircle label="BOB" sub="Receiver" color={C.green} />
              </div>
              {eveId !== "none" && (
                <div style={{ position: "absolute", left: "50%", top: 6, transform: "translateX(-50%)", textAlign: "center" }}>
                  <div style={{ background: `${eve.color}22`, border: `1px solid ${eve.color}`, borderRadius: 8, padding: "5px 14px", fontSize: 11, color: eve.color, fontWeight: 800, whiteSpace: "nowrap", boxShadow: intercepted ? `0 0 18px ${eve.color}66` : "none", animation: intercepted && step === 4 ? "pulse 0.9s ease infinite" : "none" }}>
                    {eve.icon} EVE — {eve.name}
                  </div>
                  {intercepted && step === 4 && <div style={{ fontSize: 9, color: eve.color, marginTop: 3, animation: "blink 0.5s step-end infinite" }}>⚡ ACTIVE</div>}
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

            {step >= 5 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {eveId !== "none" && intercepted && (
                  <div style={{ flex: 1, padding: "8px 12px", borderRadius: 7, background: `${eve.color}18`, border: `1px solid ${eve.color}`, fontSize: 11, color: eve.color, fontWeight: 700 }}>
                    {eve.icon} {eve.name} executed · ~{stolenBits} bits accessed
                  </div>
                )}
                {detected ? (
                  <div style={{ flex: 1, padding: "8px 12px", borderRadius: 7, background: `${C.red}18`, border: `1px solid ${C.red}`, fontSize: 11, color: C.red, fontWeight: 700 }}>
                    ⚠️ DETECTED — Error rate exceeded safe threshold. Bob flagged the channel.
                  </div>
                ) : intercepted && eveId !== "none" ? (
                  <div style={{ flex: 1, padding: "8px 12px", borderRadius: 7, background: `${C.yellow}18`, border: `1px solid ${C.yellow}`, fontSize: 11, color: C.yellow }}>
                    ⚡ Undetected this round — Eve stayed below detection threshold.
                  </div>
                ) : eveId === "none" ? (
                  <div style={{ flex: 1, padding: "8px 12px", borderRadius: 7, background: `${C.green}18`, border: `1px solid ${C.green}`, fontSize: 11, color: C.green }}>
                    ✓ No attacker — channel clean.
                  </div>
                ) : null}
              </div>
            )}
            {step === 4 && (
              <div style={{ marginTop: 14, textAlign: "right", borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                <Btn onClick={runStep5} disabled={stepAnimating} color={C.accent}>Next: Check Errors & Decrypt</Btn>
              </div>
            )}
          </Card>
        )}

        {/* Step 5 */}
        {step >= 5 && voteLog.length > 0 && (
          <Card label={`Step 5 — Majority Vote · ${redundancy}x Redundancy`} color={C.green}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 10 }}>
              {redundancy === 1 ? "No redundancy — each bit accepted as-is. Noise errors are permanent." : `Each bit was sent as ${redundancy} copies. Majority vote corrects flipped bits.`}
            </div>
            {redundancy > 1 && (
              <div style={{ maxHeight: 180, overflowY: "auto", padding: 10, background: C.card, borderRadius: 7, border: `1px solid ${C.border}`, marginBottom: 12 }}>
                {voteLog.map((v, i) => <VoteRow key={i} index={i} bit={v.bit} copies={v.copies} voted={v.voted} />)}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", opacity: 0, animation: "slideFadeIn 0.5s ease-out forwards", animationDelay: "0.2s" }}>
              <Stat label="Physical Qubits" value={totalQubits} color={C.accent} />
              <Stat label="Logical Bits" value={msg.length * 8} color={C.purple} />
              <Stat label="Bit Errors" value={errorBits} color={errorBits === 0 ? C.green : C.red} />
              <Stat label="Effective Noise" value={`${Math.round((noise + (intercepted ? eve.noiseBoost : 0)) * 100)}%`} color={C.yellow} />
            </div>
            {step === 5 && (
              <div style={{ marginTop: 14, textAlign: "right", borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                <Btn onClick={runStep6} disabled={stepAnimating} color={C.accent}>Next: Final Result</Btn>
              </div>
            )}
          </Card>
        )}

        {/* Step 6 */}
        {step === 6 && decoded && (
          <Card label="Step 6 — Final Result" color={success ? C.green : C.red}>
            <div style={{ display: "flex", gap: 14, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 100, opacity: 0, animation: "slideFadeIn 0.5s forwards", animationDelay: "0.1s" }}>
                <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>Sent by Alice</div>
                <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 2, color: C.accent, background: `${C.accent}12`, border: `1px solid ${C.accent}33`, borderRadius: 7, padding: "10px 14px", animation: "jumpIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards", opacity: 0, animationDelay: "0.4s" }}>{msg}</div>
              </div>
              <div style={{ fontSize: 22, color: C.muted, opacity: 0, animation: "scaleUpOut 0.4s forwards", animationDelay: "0.6s" }}>→</div>
              <div style={{ flex: 1, minWidth: 100, opacity: 0, animation: "slideFadeIn 0.5s forwards", animationDelay: "0.3s" }}>
                <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>Received by Bob</div>
                <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 2, color: success ? C.green : C.red, background: success ? `${C.green}12` : `${C.red}12`, border: `1px solid ${success ? C.green : C.red}33`, borderRadius: 7, padding: "10px 14px", animation: "jumpIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards", opacity: 0, animationDelay: "0.8s" }}>{decoded}</div>
              </div>
            </div>
            <div style={{ padding: "12px 16px", borderRadius: 8, fontWeight: 800, fontSize: 13, marginBottom: 14, background: success ? `${C.green}18` : `${C.red}18`, border: `1px solid ${success ? C.green : C.red}`, color: success ? C.green : C.red, opacity: 0, animation: "scaleUpOut 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards", animationDelay: "1.2s", transform: "scale(0.8)" }}>
              {success ? "✅ Transmission successful — message arrived intact and secure!" : "❌ Transmission compromised — message corrupted by noise or attack!"}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", opacity: 0, animation: "slideFadeIn 0.6s ease-out forwards", animationDelay: "1.4s" }}>
              <Stat label="Characters" value={msg.length} />
              <Stat label="Total Qubits" value={totalQubits} color={C.purple} />
              <Stat label="Redundancy" value={`${redundancy}x`} color={C.purple} />
              <Stat label="Noise" value={`${Math.round(noise * 100)}%`} color={noise > 0.2 ? C.red : C.yellow} />
              <Stat label="Eve Strategy" value={eve.icon} color={eve.color} />
              <Stat label="Eve Detected" value={detected ? "YES" : eveId === "none" ? "N/A" : "NO"} color={detected ? C.red : eveId === "none" ? C.muted : C.yellow} />
              <Stat label="Bits Stolen" value={stolenBits || 0} color={stolenBits > 0 ? C.red : C.green} />
              <Stat label="Status" value={success ? "SECURE" : "FAILED"} color={success ? C.green : C.red} />
            </div>
          </Card>
        )}

        {/* landing */}
        {step === -1 && (
          <Card label="How It Works" color={C.muted}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(195px,1fr))", gap: 10 }}>
              {[
                [C.yellow, "1. Type a Message", "Your secret text is the payload"],
                [C.accent, "2. ASCII → Binary", "Each character → 8 bits"],
                [C.purple, "3. Bits → Qubits", "|0⟩ and |1⟩ quantum states"],
                [C.orange, "4. BB84 Encoding", "Random polarization per qubit"],
                [C.purple, "5. Quantum Channel", "Photons fly from Alice to Bob"],
                [C.red, "6. Eve's Attack", "Pick her strategy, watch the damage"],
                [C.green, "7. Majority Vote", "Redundancy corrects noisy bits"],
                [C.green, "8. Final Result", "Did the message survive intact?"],
              ].map(([col, title, sub], i) => (
                <div key={i} style={{ padding: "10px 12px", background: C.card, borderRadius: 7, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: col, marginBottom: 3 }}>{title}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{sub}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, textAlign: "center", fontSize: 12, color: C.muted }}>
              Configure above and hit <span style={{ color: C.accent }}>▶ Start</span> to start the simulation
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
