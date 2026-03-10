import { useState, useRef } from "react";
import { Sparkles, Eye, EyeOff, ArrowRight } from "lucide-react";
import { getDb } from "../db/database";
import LogoImage from "../components/LogoImage";

interface OnboardingProps {
  onComplete: () => void;
}

// ── Galaxy palette (hardcoded — renders before theme) ──────────────────────────
const G = {
  bg:           "linear-gradient(160deg, #06060e 0%, #080918 45%, #09061a 75%, #06060e 100%)",
  nebula1:      "radial-gradient(ellipse 70% 50% at 15% 20%, rgba(80,40,160,0.18) 0%, transparent 70%)",
  nebula2:      "radial-gradient(ellipse 60% 50% at 85% 80%, rgba(40,80,200,0.14) 0%, transparent 70%)",
  card:         "rgba(10, 11, 28, 0.97)",
  cardBorder:   "rgba(80, 144, 224, 0.22)",
  cardShadow:   "0 8px 56px rgba(50, 70, 200, 0.25), 0 0 0 1px rgba(80, 144, 224, 0.10), 0 0 80px rgba(40, 60, 180, 0.08)",
  inputBg:      "rgba(6, 7, 20, 0.90)",
  inputBorder:  "rgba(80, 144, 224, 0.20)",
  inputFocus:   "#5090e0",
  inputText:    "#d0d8f0",
  label:        "#6878a8",
  textPrimary:  "#e8eeff",
  textMuted:    "#4a5888",
  textSub:      "#8898c8",
  accent:       "#5090e0",
  accentGrad:   "linear-gradient(135deg, #5090e0 0%, #8060d0 100%)",
  divider:      "rgba(80, 144, 224, 0.12)",
  error:        "#ff5060",
  success:      "#40d080",
  pinDot:       "rgba(80, 144, 224, 0.18)",
  pinDotFull:   "#5090e0",
};

// ── Country list ───────────────────────────────────────────────────────────────
const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda",
  "Argentina","Armenia","Australia","Austria","Azerbaijan","Bahamas","Bahrain",
  "Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan",
  "Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria",
  "Burkina Faso","Burundi","Cabo Verde","Cambodia","Cameroon","Canada",
  "Central African Republic","Chad","Chile","China","Colombia","Comoros",
  "Congo (DRC)","Congo (Republic)","Costa Rica","Croatia","Cuba","Cyprus",
  "Czech Republic","Denmark","Djibouti","Dominica","Dominican Republic",
  "Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia",
  "Eswatini","Ethiopia","Fiji","Finland","France","Gabon","Gambia","Georgia",
  "Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau",
  "Guyana","Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran",
  "Iraq","Ireland","Israel","Italy","Jamaica","Japan","Jordan","Kazakhstan",
  "Kenya","Kiribati","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho",
  "Liberia","Libya","Liechtenstein","Lithuania","Luxembourg","Madagascar",
  "Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania",
  "Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro",
  "Morocco","Mozambique","Myanmar","Namibia","Nauru","Nepal","Netherlands",
  "New Zealand","Nicaragua","Niger","Nigeria","North Korea","North Macedonia",
  "Norway","Oman","Pakistan","Palau","Palestine","Panama","Papua New Guinea",
  "Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania",
  "Russia","Rwanda","Saint Kitts and Nevis","Saint Lucia",
  "Saint Vincent and the Grenadines","Samoa","San Marino","Saudi Arabia",
  "Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia",
  "Slovenia","Solomon Islands","Somalia","South Africa","South Korea",
  "South Sudan","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland",
  "Syria","Taiwan","Tajikistan","Tanzania","Thailand","Timor-Leste","Togo",
  "Tonga","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Tuvalu",
  "Uganda","Ukraine","United Arab Emirates","United Kingdom","United States",
  "Uruguay","Uzbekistan","Vanuatu","Vatican City","Venezuela","Vietnam",
  "Yemen","Zambia","Zimbabwe",
];

// ── Sub-components ─────────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: "block", color: G.label, fontSize: "0.72rem",
      fontWeight: 700, marginBottom: 7, letterSpacing: "0.09em" }}>
      {children}
    </label>
  );
}

function TextInput({
  inputRef, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { inputRef?: React.Ref<HTMLInputElement> }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      ref={inputRef}
      {...props}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e)  => { setFocused(false); props.onBlur?.(e); }}
      style={{
        width: "100%", boxSizing: "border-box",
        padding: "11px 14px",
        borderRadius: 10,
        border: `1px solid ${focused ? G.inputFocus : G.inputBorder}`,
        background: G.inputBg,
        color: G.inputText,
        fontSize: "0.9rem",
        outline: "none",
        boxShadow: focused ? "0 0 0 3px rgba(80,144,224,0.12)" : "none",
        transition: "border-color 0.15s, box-shadow 0.15s",
        ...props.style,
      }}
    />
  );
}

function PinDots({ value }: { value: string }) {
  return (
    <div className="flex gap-3 justify-center mt-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-full" style={{
          width: 10, height: 10,
          background: i < value.length ? G.pinDotFull : G.pinDot,
          border: `1.5px solid ${i < value.length ? G.accent : "rgba(80,144,224,0.25)"}`,
          boxShadow: i < value.length ? `0 0 8px ${G.accent}88` : "none",
          transition: "all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)",
          transform: i < value.length ? "scale(1.2)" : "scale(1)",
        }} />
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Onboarding({ onComplete }: OnboardingProps) {
  const firstRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    first_name: "", last_name: "", username: "",
    email: "", country: "", pin: "", confirm_pin: "",
  });
  const [showPin, setShowPin]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [errors, setErrors]           = useState<Record<string, string>>({});

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => { const n = { ...e }; delete n[field]; return n; });
  }

  function updatePin(field: "pin" | "confirm_pin", value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    update(field, digits);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.first_name.trim())  e.first_name  = "First name is required.";
    if (!form.last_name.trim())   e.last_name   = "Last name is required.";
    if (!form.username.trim())    e.username    = "Username is required.";
    if (!form.email.trim())       e.email       = "Email is required.";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email address.";
    if (!form.pin)                e.pin         = "PIN is required.";
    else if (form.pin.length < 4) e.pin         = "PIN must be 4 digits.";
    if (!form.confirm_pin)        e.confirm_pin = "Please confirm your PIN.";
    else if (form.pin !== form.confirm_pin) e.confirm_pin = "PINs do not match.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    try {
      const db = await getDb();
      const now = new Date().toISOString().replace("T", " ").slice(0, 19);
      await db.execute(
        `INSERT OR REPLACE INTO profile
           (id, first_name, last_name, username, email, pin, country, updated_at)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?)`,
        [
          form.first_name.trim(),
          form.last_name.trim() || null,
          form.username.trim() || null,
          form.email.trim(),
          form.pin,
          form.country || null,
          now,
        ]
      );
      onComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrors({ _global: "Something went wrong. Please try again." });
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  }

  const pinMatch = form.pin.length === 4 && form.confirm_pin.length === 4 && form.pin === form.confirm_pin;

  return (
    <div
      className="flex items-center justify-center h-full overflow-y-auto"
      style={{ background: G.bg, position: "relative" }}
    >
      {/* Nebula overlays */}
      <div style={{ position: "fixed", inset: 0, background: G.nebula1, pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", inset: 0, background: G.nebula2, pointerEvents: "none", zIndex: 0 }} />

      {/* Card */}
      <div
        className="rounded-3xl relative"
        style={{
          width: "100%", maxWidth: 520,
          margin: "32px 20px",
          background: G.card,
          border: `1px solid ${G.cardBorder}`,
          boxShadow: G.cardShadow,
          zIndex: 1,
        }}
      >
        {/* ── Header ── */}
        <div className="flex flex-col items-center" style={{
          padding: "36px 36px 26px",
          borderBottom: `1px solid ${G.divider}`,
        }}>
          <LogoImage size={110} style={{ marginBottom: 16, filter: "drop-shadow(0 6px 20px rgba(80,144,224,0.45))" }} />
          <h1 style={{ color: G.textPrimary, fontSize: "1.65rem", fontWeight: 800, marginBottom: 5, textAlign: "center" }}>
            Welcome to AscendOne
          </h1>
          <p style={{ color: G.textSub, fontSize: "0.85rem" }}>
            Your Law of Attraction journey starts here
          </p>
        </div>

        {/* ── Form body ── */}
        <div style={{ padding: "28px 36px 36px" }}>
          <div className="flex flex-col gap-5">

            {/* First + Last name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>FIRST NAME *</FieldLabel>
                <TextInput
                  inputRef={firstRef}
                  autoFocus
                  placeholder="First name"
                  value={form.first_name}
                  onChange={(e) => update("first_name", e.target.value)}
                />
                {errors.first_name && <p style={{ color: G.error, fontSize: "0.72rem", marginTop: 4 }}>{errors.first_name}</p>}
              </div>
              <div>
                <FieldLabel>LAST NAME *</FieldLabel>
                <TextInput
                  placeholder="Last name"
                  value={form.last_name}
                  onChange={(e) => update("last_name", e.target.value)}
                />
                {errors.last_name && <p style={{ color: G.error, fontSize: "0.72rem", marginTop: 4 }}>{errors.last_name}</p>}
              </div>
            </div>

            {/* Username */}
            <div>
              <FieldLabel>USERNAME *</FieldLabel>
              <TextInput
                placeholder="Choose a username"
                value={form.username}
                onChange={(e) => update("username", e.target.value)}
                autoCapitalize="none"
              />
              {errors.username && <p style={{ color: G.error, fontSize: "0.72rem", marginTop: 4 }}>{errors.username}</p>}
            </div>

            {/* Email */}
            <div>
              <FieldLabel>EMAIL *</FieldLabel>
              <TextInput
                type="email"
                placeholder="your@email.com"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
              {errors.email && <p style={{ color: G.error, fontSize: "0.72rem", marginTop: 4 }}>{errors.email}</p>}
            </div>

            {/* Country */}
            <div style={{ position: "relative" }}>
              <FieldLabel>COUNTRY</FieldLabel>
              <select
                value={form.country}
                onChange={(e) => update("country", e.target.value)}
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "11px 36px 11px 14px",
                  borderRadius: 10,
                  border: `1px solid ${G.inputBorder}`,
                  background: G.inputBg,
                  color: form.country ? G.inputText : G.label,
                  fontSize: "0.9rem",
                  outline: "none",
                  cursor: "pointer",
                  appearance: "none",
                  WebkitAppearance: "none",
                }}
              >
                <option value="">Select your country</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c} style={{ background: "#0a0b1c", color: G.inputText }}>
                    {c}
                  </option>
                ))}
              </select>
              <div style={{
                position: "absolute", right: 13, top: "calc(50% + 10px)",
                transform: "translateY(-50%)", pointerEvents: "none",
                color: G.label, fontSize: "0.8rem",
              }}>▾</div>
            </div>

            {/* Divider */}
            <div style={{ borderTop: `1px solid ${G.divider}` }} />

            {/* PIN section */}
            <div>
              <p style={{ color: G.textSub, fontSize: "0.82rem", fontWeight: 600, marginBottom: 3 }}>
                🔒 Security PIN
              </p>
              <p style={{ color: G.textMuted, fontSize: "0.75rem" }}>
                A 4-digit PIN locks your journal at startup to protect your personal entries.
              </p>
            </div>

            {/* PIN + Confirm */}
            <div className="grid grid-cols-2 gap-4">
              {/* PIN */}
              <div>
                <FieldLabel>CREATE PIN *</FieldLabel>
                <div style={{ position: "relative" }}>
                  <TextInput
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    placeholder="••••"
                    value={form.pin}
                    onChange={(e) => updatePin("pin", e.target.value)}
                    style={{ paddingRight: 38 }}
                  />
                  <button type="button" onClick={() => setShowPin((v) => !v)}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", color: G.label, padding: 2, display: "flex" }}>
                    {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <PinDots value={form.pin} />
                {errors.pin && <p style={{ color: G.error, fontSize: "0.72rem", marginTop: 5 }}>{errors.pin}</p>}
              </div>

              {/* Confirm PIN */}
              <div>
                <FieldLabel>VERIFY PIN *</FieldLabel>
                <div style={{ position: "relative" }}>
                  <TextInput
                    type={showConfirm ? "text" : "password"}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    placeholder="••••"
                    value={form.confirm_pin}
                    onChange={(e) => updatePin("confirm_pin", e.target.value)}
                    style={{
                      paddingRight: 38,
                      borderColor: form.confirm_pin.length === 4
                        ? pinMatch ? G.success : G.error
                        : undefined,
                    }}
                  />
                  <button type="button" onClick={() => setShowConfirm((v) => !v)}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", color: G.label, padding: 2, display: "flex" }}>
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <PinDots value={form.confirm_pin} />
                {errors.confirm_pin && <p style={{ color: G.error, fontSize: "0.72rem", marginTop: 5 }}>{errors.confirm_pin}</p>}
                {pinMatch && !errors.confirm_pin && (
                  <p style={{ color: G.success, fontSize: "0.72rem", marginTop: 5 }}>✓ PINs match</p>
                )}
              </div>
            </div>

            {/* Global error */}
            {errors._global && (
              <p style={{ color: G.error, fontSize: "0.8rem", textAlign: "center" }}>{errors._global}</p>
            )}

            {/* Submit */}
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center justify-center gap-2 w-full rounded-xl py-3 font-semibold"
              style={{
                background: saving ? "rgba(80,144,224,0.35)" : G.accentGrad,
                color: "#fff",
                fontSize: "0.95rem",
                border: "none",
                cursor: saving ? "not-allowed" : "pointer",
                boxShadow: saving ? "none" : "0 4px 20px rgba(80,144,224,0.35)",
                transition: "all 0.15s",
                marginTop: 4,
              }}
            >
              {saving ? "Setting up your journey…" : "Begin My Journey"}
              {!saving && <ArrowRight size={17} />}
            </button>

            {/* Footer note */}
            <div className="flex items-center justify-center gap-1.5"
              style={{ color: G.textMuted, fontSize: "0.72rem" }}>
              <Sparkles size={11} style={{ color: G.accent }} />
              Country is optional · All data stays on your device
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
