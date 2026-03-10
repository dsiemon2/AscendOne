import { useState, useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import LogoImage from "./LogoImage";

// ── Galaxy palette (hardcoded — renders before theme) ──────────────────────────
const G = {
  bg:          "linear-gradient(160deg, #06060e 0%, #080918 45%, #09061a 75%, #06060e 100%)",
  card:        "rgba(10, 11, 28, 0.97)",
  cardBorder:  "rgba(80, 144, 224, 0.22)",
  cardShadow:  "0 8px 56px rgba(50, 70, 200, 0.25), 0 0 0 1px rgba(80, 144, 224, 0.12), 0 0 80px rgba(40, 60, 180, 0.10)",
  inputBg:     "rgba(6, 7, 20, 0.92)",
  inputBorder: "rgba(80, 144, 224, 0.20)",
  inputFocus:  "#5090e0",
  accent:      "#5090e0",
  accentGrad:  "linear-gradient(135deg, #5090e0 0%, #8060d0 100%)",
  textPrimary: "#e8eeff",
  textMuted:   "#5a6a9a",
  error:       "#ff5060",
  dotFull:     "#5090e0",
  dotEmpty:    "rgba(80, 144, 224, 0.18)",
};

interface PinLockProps {
  firstName: string;
  onUnlock: () => void;
  correctPin: string;
}

export default function PinLock({ firstName, onUnlock, correctPin }: PinLockProps) {
  const [pin, setPin]         = useState("");
  const [error, setError]     = useState("");
  const [shake, setShake]     = useState(false);
  const inputRef              = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus hidden input
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (pin.length === 4) {
      if (pin === correctPin) {
        onUnlock();
      } else {
        setShake(true);
        setError("Incorrect PIN. Try again.");
        setTimeout(() => {
          setPin("");
          setShake(false);
          setError("");
          inputRef.current?.focus();
        }, 700);
      }
    }
  }, [pin, correctPin, onUnlock]);

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      setPin((p) => p.slice(0, -1));
      setError("");
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
    setPin(val);
    if (error) setError("");
  }

  const hour = new Date().getHours();
  const greeting =
    hour < 5  ? "Good night" :
    hour < 12 ? "Good morning" :
    hour < 17 ? "Good afternoon" :
    hour < 21 ? "Good evening" : "Good evening";

  return (
    <div
      className="flex items-center justify-center h-full"
      style={{ background: G.bg }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Hidden input captures keyboard */}
      <input
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        value={pin}
        onChange={handleChange}
        onKeyDown={handleKey}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 1, height: 1 }}
        aria-label="PIN entry"
      />

      {/* Card */}
      <div
        className="rounded-3xl flex flex-col items-center"
        style={{
          width: 340,
          padding: "44px 36px",
          background: G.card,
          border: `1px solid ${G.cardBorder}`,
          boxShadow: G.cardShadow,
        }}
      >
        {/* Logo */}
        <LogoImage
          size={90}
          style={{ marginBottom: 20, filter: "drop-shadow(0 6px 18px rgba(80,144,224,0.50))" }}
        />

        {/* Greeting */}
        <p style={{ color: G.textMuted, fontSize: "0.78rem", letterSpacing: "0.08em", marginBottom: 6 }}>
          {greeting.toUpperCase()}
        </p>
        <h2 style={{ color: G.textPrimary, fontSize: "1.4rem", fontWeight: 700, marginBottom: 4, textAlign: "center" }}>
          {firstName}
        </h2>
        <p style={{ color: G.textMuted, fontSize: "0.82rem", marginBottom: 32, textAlign: "center" }}>
          Enter your PIN to continue
        </p>

        {/* PIN dots */}
        <div
          className="flex gap-4 mb-3"
          style={{
            animation: shake ? "shake 0.4s ease" : "none",
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: 18,
                height: 18,
                background: i < pin.length ? G.dotFull : G.dotEmpty,
                border: `2px solid ${i < pin.length ? G.accent : "rgba(80, 144, 224, 0.25)"}`,
                boxShadow: i < pin.length ? `0 0 12px ${G.accent}80` : "none",
                transition: "all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)",
                transform: i < pin.length ? "scale(1.15)" : "scale(1)",
              }}
            />
          ))}
        </div>

        {/* Error */}
        <div style={{ minHeight: 20, marginBottom: 8 }}>
          {error && (
            <p style={{ color: G.error, fontSize: "0.78rem", textAlign: "center" }}>
              {error}
            </p>
          )}
        </div>

        <p style={{ color: G.textMuted, fontSize: "0.72rem", marginTop: 8 }}>
          Click anywhere and type your PIN
        </p>

        {/* Sparkle accent */}
        <div className="flex items-center gap-1.5 mt-6" style={{ color: G.textMuted, fontSize: "0.68rem" }}>
          <Sparkles size={10} style={{ color: G.accent }} />
          AscendOne · Your LOA Journal
        </div>
      </div>

      {/* Shake keyframe */}
      <style>{`
        @keyframes shake {
          0%   { transform: translateX(0); }
          20%  { transform: translateX(-8px); }
          40%  { transform: translateX(8px); }
          60%  { transform: translateX(-6px); }
          80%  { transform: translateX(6px); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
