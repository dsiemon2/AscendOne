import { useState, useRef } from "react";
import { User, Lock, Palette, Bell, ChevronRight, Check, Eye, EyeOff, AlertTriangle, Moon } from "lucide-react";
import { useThemeStore, ThemePeriod, ThemeColors, themes } from "../store/themeStore";
import { useAppStore } from "../store/appStore";
import { getDb } from "../db/database";
import {
  type NotifSchedule,
  DEFAULT_NOTIF_PREFS,
  saveNotifPrefs,
} from "../hooks/useNotifications";

// ── Section wrapper ─────────────────────────────────────────────────────────
function Section({
  title, icon, children, theme,
}: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
  theme: ThemeColors;
}) {
  return (
    <div style={{
      background: theme.bgCard,
      border: `1px solid ${theme.bgCardBorder}`,
      borderRadius: 16,
      overflow: "hidden",
      marginBottom: 20,
      boxShadow: `0 4px 24px ${theme.bgCardShadow}`,
    }}>
      <div style={{
        padding: "16px 22px",
        borderBottom: `1px solid ${theme.bgCardBorder}`,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <span style={{ color: theme.accent }}>{icon}</span>
        <span style={{ color: theme.textPrimary, fontWeight: 700, fontSize: "0.95rem" }}>{title}</span>
      </div>
      <div style={{ padding: "20px 22px" }}>{children}</div>
    </div>
  );
}

// ── Field row ───────────────────────────────────────────────────────────────
function Field({
  label, children, theme,
}: {
  label: string; children: React.ReactNode;
  theme: ThemeColors;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: "block",
        color: theme.textMuted,
        fontSize: "0.72rem",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: 6,
      }}>{label}</label>
      {children}
    </div>
  );
}

// ── Input ───────────────────────────────────────────────────────────────────
function Input({
  value, onChange, placeholder, type = "text", theme,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; theme: ThemeColors;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: "100%",
        padding: "10px 14px",
        borderRadius: 10,
        background: theme.bgInput,
        border: `1px solid ${focused ? theme.accent : theme.bgCardBorder}`,
        color: theme.textPrimary,
        fontSize: "0.9rem",
        outline: "none",
        boxSizing: "border-box",
        transition: "border-color 0.2s",
        boxShadow: focused ? `0 0 0 3px ${theme.accent}18` : "none",
      }}
    />
  );
}

// ── Save button ─────────────────────────────────────────────────────────────
function SaveButton({
  onClick, saving, saved, label = "Save Changes", theme,
}: {
  onClick: () => void; saving: boolean; saved: boolean; label?: string;
  theme: ThemeColors;
}) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 22px",
        borderRadius: 10,
        background: saved ? "#22c55e" : theme.accentGradient,
        color: "#fff",
        fontWeight: 600,
        fontSize: "0.88rem",
        border: "none",
        cursor: saving ? "not-allowed" : "pointer",
        opacity: saving ? 0.7 : 1,
        transition: "all 0.2s",
      }}
    >
      {saved ? <Check size={15} /> : null}
      {saving ? "Saving…" : saved ? "Saved!" : label}
    </button>
  );
}

// ── COUNTRIES ───────────────────────────────────────────────────────────────
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
  "Saint Vincent and the Grenadines","Samoa","San Marino","Sao Tome and Principe",
  "Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore",
  "Slovakia","Slovenia","Solomon Islands","Somalia","South Africa","South Korea",
  "South Sudan","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland",
  "Syria","Taiwan","Tajikistan","Tanzania","Thailand","Timor-Leste","Togo",
  "Tonga","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Tuvalu",
  "Uganda","Ukraine","United Arab Emirates","United Kingdom","United States",
  "Uruguay","Uzbekistan","Vanuatu","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe",
];

// ── Theme preview card ──────────────────────────────────────────────────────
const THEME_META: { period: ThemePeriod; label: string; emoji: string; desc: string; gradient: string }[] = [
  { period: "dawn",  label: "Dawn",    emoji: "🌅", desc: "5am – 8am",  gradient: "linear-gradient(135deg, #D81B60, #F06292)" },
  { period: "day",   label: "Sunny Day", emoji: "☀️", desc: "8am – 6pm",  gradient: "linear-gradient(135deg, #FFB300, #0288D1)" },
  { period: "dusk",  label: "Sunset",  emoji: "🌇", desc: "6pm – 9pm",  gradient: "linear-gradient(135deg, #F97316, #A855F7)" },
  { period: "night", label: "Galaxy",  emoji: "🌌", desc: "9pm – 5am",  gradient: "linear-gradient(135deg, #e05070, #5090e0, #7040d0)" },
];

// ── Sleep timer options ─────────────────────────────────────────────────────
const SLEEP_OPTIONS: { label: string; value: number }[] = [
  { label: "Never",    value: 0  },
  { label: "1 min",   value: 1  },
  { label: "5 min",   value: 5  },
  { label: "10 min",  value: 10 },
  { label: "15 min",  value: 15 },
  { label: "30 min",  value: 30 },
  { label: "1 hour",  value: 60 },
];

// ── Main component ──────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { theme, manualOverride, setManualOverride } = useThemeStore();
  const { profile, setProfile, sleepMinutes, setSleepMinutes } = useAppStore();

  // ── Profile form state
  const [profileForm, setProfileForm] = useState({
    first_name: profile?.first_name ?? "",
    last_name:  profile?.last_name  ?? "",
    username:   profile?.username   ?? "",
    email:      profile?.email      ?? "",
    country:    profile?.country    ?? "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved,  setProfileSaved]  = useState(false);
  const [profileError,  setProfileError]  = useState("");

  // ── Avatar state
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const currentAvatar = avatarPreview ?? profile?.avatar_path ?? null;
  const avatarInitials = [profile?.first_name?.[0], profile?.last_name?.[0]]
    .filter(Boolean).join("").toUpperCase() || "A";

  function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    // reset input so the same file can be re-selected if needed
    e.target.value = "";
  }

  async function removeAvatar() {
    setAvatarPreview(null);
    try {
      const db = await getDb();
      await db.execute("UPDATE profile SET avatar_path=NULL WHERE id=1", []);
      const rows = await db.select<Array<{
        id: number; first_name: string; last_name: string; username: string;
        email: string; pin: string; country: string; timezone: string; avatar_path: string;
      }>>("SELECT * FROM profile WHERE id=1 LIMIT 1");
      if (rows.length > 0) setProfile(rows[0]);
    } catch (e) { console.error("Remove avatar error", e); }
  }

  // ── PIN state
  const [pinMode, setPinMode] = useState<"view" | "change" | "remove">("view");
  const [pinForm, setPinForm] = useState({ current: "", newPin: "", verify: "" });
  const [showPins, setShowPins] = useState({ current: false, newPin: false, verify: false });
  const [pinSaving, setPinSaving] = useState(false);
  const [pinSaved,  setPinSaved]  = useState(false);
  const [pinError,  setPinError]  = useState("");

  const hasPin = !!(profile?.pin);

  // ── Notification prefs state ─────────────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState<NotifSchedule>(() => {
    try {
      const raw = localStorage.getItem("ascendone_notif_prefs");
      if (raw) return { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return { ...DEFAULT_NOTIF_PREFS };
  });
  const [notifSaved, setNotifSaved] = useState(false);

  function updateNotif<K extends keyof NotifSchedule>(key: K, value: NotifSchedule[K]) {
    setNotifPrefs(p => ({ ...p, [key]: value }));
  }

  function saveNotifications() {
    saveNotifPrefs(notifPrefs);
    setNotifSaved(true);
    setTimeout(() => setNotifSaved(false), 2500);
  }

  // ── Save profile ────────────────────────────────────────────────────────
  async function saveProfile() {
    setProfileError("");
    if (!profileForm.first_name.trim()) { setProfileError("First name is required."); return; }
    if (!profileForm.email.trim())      { setProfileError("Email is required."); return; }
    setProfileSaving(true);
    try {
      const db = await getDb();
      const now = new Date().toISOString().replace("T", " ").slice(0, 19);
      await db.execute(
        `UPDATE profile SET first_name=?, last_name=?, username=?, email=?, country=?, avatar_path=?, updated_at=? WHERE id=1`,
        [
          profileForm.first_name.trim(),
          profileForm.last_name.trim() || null,
          profileForm.username.trim()  || null,
          profileForm.email.trim(),
          profileForm.country || null,
          avatarPreview !== null ? avatarPreview : (profile?.avatar_path ?? null),
          now,
        ]
      );
      // Refresh profile in store
      const rows = await db.select<Array<{
        id: number; first_name: string; last_name: string; username: string;
        email: string; pin: string; country: string; timezone: string; avatar_path: string;
      }>>("SELECT * FROM profile WHERE id = 1 LIMIT 1");
      if (rows.length > 0) setProfile(rows[0]);
      setAvatarPreview(null); // preview committed — clear staging
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch (e) {
      setProfileError("Failed to save. Please try again.");
      console.error(e);
    } finally {
      setProfileSaving(false);
    }
  }

  // ── Save PIN ─────────────────────────────────────────────────────────────
  async function savePin() {
    setPinError("");
    if (pinMode === "change") {
      if (hasPin && pinForm.current !== profile!.pin) { setPinError("Current PIN is incorrect."); return; }
      if (!/^\d{4}$/.test(pinForm.newPin))           { setPinError("New PIN must be exactly 4 digits."); return; }
      if (pinForm.newPin !== pinForm.verify)          { setPinError("PINs do not match."); return; }
    }
    if (pinMode === "remove") {
      if (pinForm.current !== profile!.pin) { setPinError("Current PIN is incorrect."); return; }
    }
    setPinSaving(true);
    try {
      const db = await getDb();
      const newPin = pinMode === "remove" ? null : pinForm.newPin;
      await db.execute("UPDATE profile SET pin=? WHERE id=1", [newPin]);
      const rows = await db.select<Array<{
        id: number; first_name: string; last_name: string; username: string;
        email: string; pin: string; country: string; timezone: string; avatar_path: string;
      }>>("SELECT * FROM profile WHERE id = 1 LIMIT 1");
      if (rows.length > 0) setProfile(rows[0]);
      setPinSaved(true);
      setPinForm({ current: "", newPin: "", verify: "" });
      setTimeout(() => { setPinSaved(false); setPinMode("view"); }, 2000);
    } catch (e) {
      setPinError("Failed to update PIN. Please try again.");
      console.error(e);
    } finally {
      setPinSaving(false);
    }
  }

  // ── PIN dot display ──────────────────────────────────────────────────────
  function PinInput({ value, onChange, show, onToggleShow, placeholder }: {
    value: string; onChange: (v: string) => void;
    show: boolean; onToggleShow: () => void; placeholder?: string;
  }) {
    const [focused, setFocused] = useState(false);
    return (
      <div style={{ position: "relative" }}>
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 4);
            onChange(v);
          }}
          placeholder={placeholder ?? "••••"}
          inputMode="numeric"
          maxLength={4}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%",
            padding: "10px 40px 10px 14px",
            borderRadius: 10,
            background: theme.bgInput,
            border: `1px solid ${focused ? theme.accent : theme.bgCardBorder}`,
            color: theme.textPrimary,
            fontSize: "1.1rem",
            letterSpacing: "0.3em",
            outline: "none",
            boxSizing: "border-box",
            transition: "border-color 0.2s",
          }}
        />
        <button
          type="button"
          onClick={onToggleShow}
          style={{
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer", color: theme.textMuted, padding: 4,
          }}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 28px 40px", maxWidth: 680, margin: "0 auto" }}>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: theme.textPrimary, fontSize: "1.6rem", fontWeight: 800, margin: 0 }}>
          Settings
        </h1>
        <p style={{ color: theme.textMuted, fontSize: "0.85rem", marginTop: 4 }}>
          Manage your profile, security, and appearance
        </p>
      </div>

      {/* ── PROFILE ─────────────────────────────────────────────────────── */}
      <Section title="Profile" icon={<User size={17} />} theme={theme}>

        {/* Avatar picker */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24,
          padding: "16px", borderRadius: 14, background: theme.bgInput,
          border: `1px solid ${theme.bgCardBorder}` }}>
          {/* Avatar circle */}
          <div style={{ width: 72, height: 72, borderRadius: "50%", flexShrink: 0,
            overflow: "hidden", background: theme.accentGradient,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 4px 16px ${theme.accent}40`,
            border: `3px solid ${theme.bgCard}` }}>
            {currentAvatar
              ? <img src={currentAvatar} alt="avatar"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ color: "#fff", fontSize: "1.6rem", fontWeight: 800 }}>{avatarInitials}</span>
            }
          </div>
          {/* Controls */}
          <div>
            <p style={{ color: theme.textPrimary, fontWeight: 600, fontSize: "0.9rem", margin: "0 0 4px" }}>
              Profile Photo
            </p>
            <p style={{ color: theme.textMuted, fontSize: "0.78rem", margin: "0 0 10px" }}>
              JPG, PNG or GIF — shown on your profile &amp; sidebar
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input ref={avatarInputRef} type="file" accept="image/*"
                style={{ display: "none" }} onChange={handleAvatarFile} />
              <button onClick={() => avatarInputRef.current?.click()}
                style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${theme.bgCardBorder}`,
                  background: theme.accentLight, color: theme.accent,
                  fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>
                {currentAvatar ? "Change Photo" : "Upload Photo"}
              </button>
              {currentAvatar && (
                <button onClick={removeAvatar}
                  style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid #ef444430`,
                    background: "#ef444415", color: "#ef4444",
                    fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>
                  Remove
                </button>
              )}
            </div>
            {avatarPreview && (
              <p style={{ color: theme.accent, fontSize: "0.75rem", marginTop: 6 }}>
                ✓ New photo selected — click Save Changes to apply
              </p>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <Field label="First Name *" theme={theme}>
            <Input value={profileForm.first_name} onChange={(v) => setProfileForm(f => ({ ...f, first_name: v }))} placeholder="First name" theme={theme} />
          </Field>
          <Field label="Last Name" theme={theme}>
            <Input value={profileForm.last_name} onChange={(v) => setProfileForm(f => ({ ...f, last_name: v }))} placeholder="Last name" theme={theme} />
          </Field>
        </div>
        <Field label="Username" theme={theme}>
          <Input value={profileForm.username} onChange={(v) => setProfileForm(f => ({ ...f, username: v }))} placeholder="Username" theme={theme} />
        </Field>
        <Field label="Email *" theme={theme}>
          <Input value={profileForm.email} onChange={(v) => setProfileForm(f => ({ ...f, email: v }))} placeholder="Email address" type="email" theme={theme} />
        </Field>
        <Field label="Country" theme={theme}>
          <select
            value={profileForm.country}
            onChange={(e) => setProfileForm(f => ({ ...f, country: e.target.value }))}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 10,
              background: theme.bgInput, border: `1px solid ${theme.bgCardBorder}`,
              color: profileForm.country ? theme.textPrimary : theme.textMuted,
              fontSize: "0.9rem", outline: "none", boxSizing: "border-box" as const,
            }}
          >
            <option value="">Select country…</option>
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        {profileError && (
          <p style={{ color: "#ef4444", fontSize: "0.83rem", marginBottom: 14 }}>{profileError}</p>
        )}
        <SaveButton onClick={saveProfile} saving={profileSaving} saved={profileSaved} theme={theme} />
      </Section>

      {/* ── SECURITY / PIN ──────────────────────────────────────────────── */}
      <Section title="Security" icon={<Lock size={17} />} theme={theme}>
        {/* Current PIN status */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderRadius: 12,
          background: theme.bgInput, border: `1px solid ${theme.bgCardBorder}`,
          marginBottom: pinMode === "view" ? 0 : 20,
        }}>
          <div>
            <p style={{ color: theme.textPrimary, fontWeight: 600, fontSize: "0.9rem", margin: 0 }}>
              {hasPin ? "App PIN is enabled" : "No PIN set"}
            </p>
            <p style={{ color: theme.textMuted, fontSize: "0.78rem", margin: "2px 0 0" }}>
              {hasPin
                ? "Your journal is locked at startup with a 4-digit PIN."
                : "Add a PIN to lock the app at startup for privacy."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 12 }}>
            <button
              onClick={() => { setPinMode(m => m === "change" ? "view" : "change"); setPinError(""); }}
              style={{
                padding: "7px 14px", borderRadius: 8, fontSize: "0.8rem", fontWeight: 600,
                background: theme.accentGradient, color: "#fff", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {hasPin ? "Change PIN" : "Set PIN"}
              <ChevronRight size={13} />
            </button>
            {hasPin && (
              <button
                onClick={() => { setPinMode(m => m === "remove" ? "view" : "remove"); setPinError(""); }}
                style={{
                  padding: "7px 14px", borderRadius: 8, fontSize: "0.8rem", fontWeight: 600,
                  background: theme.bgCard, color: "#ef4444",
                  border: `1px solid rgba(239,68,68,0.35)`, cursor: "pointer",
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Change PIN form */}
        {pinMode === "change" && (
          <div style={{
            padding: "18px", borderRadius: 12,
            background: theme.bgInput, border: `1px solid ${theme.bgCardBorder}`,
          }}>
            <div style={{ display: "grid", gridTemplateColumns: hasPin ? "1fr 1fr 1fr" : "1fr 1fr", gap: 12, marginBottom: 16 }}>
              {hasPin && (
                <Field label="Current PIN" theme={theme}>
                  <PinInput value={pinForm.current} onChange={(v) => setPinForm(f => ({ ...f, current: v }))}
                    show={showPins.current} onToggleShow={() => setShowPins(s => ({ ...s, current: !s.current }))} />
                </Field>
              )}
              <Field label="New PIN" theme={theme}>
                <PinInput value={pinForm.newPin} onChange={(v) => setPinForm(f => ({ ...f, newPin: v }))}
                  show={showPins.newPin} onToggleShow={() => setShowPins(s => ({ ...s, newPin: !s.newPin }))} />
              </Field>
              <Field label="Verify PIN" theme={theme}>
                <PinInput value={pinForm.verify} onChange={(v) => setPinForm(f => ({ ...f, verify: v }))}
                  show={showPins.verify} onToggleShow={() => setShowPins(s => ({ ...s, verify: !s.verify }))} />
              </Field>
            </div>
            {pinForm.newPin.length === 4 && pinForm.verify.length === 4 && (
              <p style={{
                fontSize: "0.78rem", fontWeight: 600, marginBottom: 12,
                color: pinForm.newPin === pinForm.verify ? "#22c55e" : "#ef4444",
              }}>
                {pinForm.newPin === pinForm.verify ? "✓ PINs match" : "✗ PINs do not match"}
              </p>
            )}
            {pinError && <p style={{ color: "#ef4444", fontSize: "0.83rem", marginBottom: 12 }}>{pinError}</p>}
            <div style={{ display: "flex", gap: 10 }}>
              <SaveButton onClick={savePin} saving={pinSaving} saved={pinSaved} label={hasPin ? "Update PIN" : "Set PIN"} theme={theme} />
              <button onClick={() => { setPinMode("view"); setPinForm({ current: "", newPin: "", verify: "" }); setPinError(""); }}
                style={{ padding: "10px 18px", borderRadius: 10, background: "none", border: `1px solid ${theme.bgCardBorder}`, color: theme.textMuted, fontSize: "0.88rem", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Remove PIN confirmation */}
        {pinMode === "remove" && (
          <div style={{
            padding: "18px", borderRadius: 12,
            background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)",
          }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16 }}>
              <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ color: theme.textSecondary, fontSize: "0.85rem", margin: 0 }}>
                Removing your PIN means the app will open without any lock screen. Enter your current PIN to confirm.
              </p>
            </div>
            <div style={{ maxWidth: 160, marginBottom: 14 }}>
              <Field label="Current PIN" theme={theme}>
                <PinInput value={pinForm.current} onChange={(v) => setPinForm(f => ({ ...f, current: v }))}
                  show={showPins.current} onToggleShow={() => setShowPins(s => ({ ...s, current: !s.current }))} />
              </Field>
            </div>
            {pinError && <p style={{ color: "#ef4444", fontSize: "0.83rem", marginBottom: 12 }}>{pinError}</p>}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={savePin}
                disabled={pinSaving}
                style={{ padding: "10px 18px", borderRadius: 10, background: "#ef4444", color: "#fff", border: "none", fontWeight: 600, fontSize: "0.88rem", cursor: "pointer" }}
              >
                {pinSaving ? "Removing…" : pinSaved ? "Removed!" : "Remove PIN"}
              </button>
              <button onClick={() => { setPinMode("view"); setPinForm({ current: "", newPin: "", verify: "" }); setPinError(""); }}
                style={{ padding: "10px 18px", borderRadius: 10, background: "none", border: `1px solid ${theme.bgCardBorder}`, color: theme.textMuted, fontSize: "0.88rem", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Auto-Lock / Sleep Timer ── */}
        <div style={{ marginTop: 20 }}>
          {/* Header row */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 16px 10px",
            borderBottom: `1px solid ${theme.bgCardBorder}`,
            marginBottom: 14,
          }}>
            <Moon size={15} style={{ color: theme.accent, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ color: theme.textPrimary, fontWeight: 600, fontSize: "0.9rem", margin: 0 }}>
                Auto-Lock / Sleep Timer
              </p>
              <p style={{ color: theme.textMuted, fontSize: "0.76rem", margin: "2px 0 0" }}>
                {hasPin
                  ? sleepMinutes === 0
                    ? "Screen will not lock automatically — use the lock button in the sidebar."
                    : `App will lock after ${sleepMinutes === 60 ? "1 hour" : `${sleepMinutes} minute${sleepMinutes > 1 ? "s" : ""}`} of inactivity.`
                  : "Requires a PIN — set one above to enable auto-lock."}
              </p>
            </div>
          </div>

          {/* Option pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingLeft: 2 }}>
            {SLEEP_OPTIONS.map(({ label, value }) => {
              const selected = sleepMinutes === value;
              const disabled = !hasPin && value !== 0;
              return (
                <button
                  key={value}
                  onClick={() => { if (!disabled) setSleepMinutes(value); }}
                  disabled={disabled}
                  title={disabled ? "Set a PIN first to enable auto-lock" : undefined}
                  style={{
                    padding: "7px 16px",
                    borderRadius: 20,
                    fontSize: "0.82rem",
                    fontWeight: selected ? 700 : 500,
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.38 : 1,
                    border: selected
                      ? `1.5px solid ${theme.accent}`
                      : `1.5px solid ${theme.bgCardBorder}`,
                    background: selected
                      ? theme.accentLight
                      : theme.bgInput,
                    color: selected ? theme.accent : theme.textMuted,
                    transition: "all 0.15s ease",
                  }}
                >
                  {value === 0 && <span style={{ marginRight: 4 }}>🔓</span>}
                  {label}
                  {selected && value > 0 && <span style={{ marginLeft: 5, fontSize: "0.7rem" }}>✓</span>}
                </button>
              );
            })}
          </div>

          {/* Active indicator */}
          {hasPin && sleepMinutes > 0 && (
            <div style={{
              marginTop: 12,
              padding: "8px 14px",
              borderRadius: 10,
              background: `${theme.accent}12`,
              border: `1px solid ${theme.accent}30`,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <Moon size={13} style={{ color: theme.accent }} />
              <span style={{ color: theme.accent, fontSize: "0.78rem", fontWeight: 600 }}>
                Auto-lock active — idle for {sleepMinutes === 60 ? "1 hour" : `${sleepMinutes} min`} locks the screen
              </span>
            </div>
          )}
        </div>
      </Section>

      {/* ── NOTIFICATIONS ───────────────────────────────────────────────── */}
      <Section title="Notifications" icon={<Bell size={17} />} theme={theme}>
        <p style={{ color: theme.textMuted, fontSize: "0.83rem", marginBottom: 18 }}>
          Daily reminders delivered while AscendOne is running (even minimised to the system tray).
        </p>

        {/* Reminder rows */}
        {(
          [
            { key: "morning",   hourKey: "morningHour",   emoji: "🌅", label: "Morning Gratitudes" },
            { key: "afternoon", hourKey: "afternoonHour", emoji: "☀️", label: "Afternoon Gratitudes" },
            { key: "evening",   hourKey: "eveningHour",   emoji: "🌙", label: "Evening Gratitudes" },
            { key: "journal",   hourKey: "journalHour",   emoji: "📓", label: "Journal Reminder" },
          ] as Array<{
            key:     keyof NotifSchedule;
            hourKey: keyof NotifSchedule;
            emoji:   string;
            label:   string;
          }>
        ).map(({ key, hourKey, emoji, label }) => {
          const enabled = notifPrefs[key] as boolean;
          const hour    = notifPrefs[hourKey] as number;
          const displayHour = hour % 12 === 0 ? 12 : hour % 12;
          const ampm        = hour < 12 ? "AM" : "PM";

          return (
            <div key={String(key)} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 16px", borderRadius: 12, marginBottom: 8,
              background: theme.bgInput,
              border: `1px solid ${enabled ? theme.accent + "50" : theme.bgCardBorder}`,
              transition: "border-color 0.2s",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: "1.3rem" }}>{emoji}</span>
                <div>
                  <p style={{ color: theme.textPrimary, fontWeight: 600, fontSize: "0.88rem", margin: 0 }}>{label}</p>
                  <p style={{ color: theme.textMuted, fontSize: "0.75rem", margin: "2px 0 0" }}>
                    {enabled ? `Fires at ${displayHour}:00 ${ampm}` : "Disabled"}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Hour selector */}
                {enabled && (
                  <select
                    value={hour}
                    onChange={(e) => updateNotif(hourKey, Number(e.target.value) as NotifSchedule[typeof hourKey])}
                    style={{
                      padding: "5px 10px", borderRadius: 8,
                      background: theme.bgCard, border: `1px solid ${theme.bgCardBorder}`,
                      color: theme.textPrimary, fontSize: "0.82rem", outline: "none", cursor: "pointer",
                    }}
                  >
                    {Array.from({ length: 24 }, (_, i) => {
                      const h = i % 12 === 0 ? 12 : i % 12;
                      const ap = i < 12 ? "AM" : "PM";
                      return <option key={i} value={i}>{h}:00 {ap}</option>;
                    })}
                  </select>
                )}
                {/* Toggle */}
                <div
                  onClick={() => updateNotif(key, !enabled as NotifSchedule[typeof key])}
                  style={{
                    width: 42, height: 24, borderRadius: 12, cursor: "pointer",
                    background: enabled ? theme.accent : theme.bgCardBorder,
                    position: "relative", transition: "background 0.2s", flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: "absolute", top: 3, left: enabled ? 21 : 3,
                    width: 18, height: 18, borderRadius: "50%", background: "#fff",
                    transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                  }} />
                </div>
              </div>
            </div>
          );
        })}

        <div style={{ marginTop: 16 }}>
          <SaveButton
            onClick={saveNotifications}
            saving={false}
            saved={notifSaved}
            label="Save Notification Settings"
            theme={theme}
          />
        </div>
      </Section>

      {/* ── APPEARANCE ──────────────────────────────────────────────────── */}
      <Section title="Appearance" icon={<Palette size={17} />} theme={theme}>
        <p style={{ color: theme.textMuted, fontSize: "0.83rem", marginBottom: 18 }}>
          By default the app theme follows the time of day automatically. You can pin it to one theme if you prefer.
        </p>

        {/* Auto option */}
        <div
          onClick={() => setManualOverride(null)}
          style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "12px 16px", borderRadius: 12, marginBottom: 10, cursor: "pointer",
            background: manualOverride === null ? theme.accentLight : theme.bgInput,
            border: `1px solid ${manualOverride === null ? theme.accent : theme.bgCardBorder}`,
            transition: "all 0.18s",
          }}
        >
          <span style={{ fontSize: "1.5rem" }}>🕐</span>
          <div style={{ flex: 1 }}>
            <p style={{ color: theme.textPrimary, fontWeight: 600, fontSize: "0.88rem", margin: 0 }}>Auto (follows time of day)</p>
            <p style={{ color: theme.textMuted, fontSize: "0.75rem", margin: "2px 0 0" }}>Dawn → Day → Sunset → Galaxy</p>
          </div>
          {manualOverride === null && <Check size={16} color={theme.accent} />}
        </div>

        {/* Theme cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {THEME_META.map(({ period, label, emoji, desc, gradient }) => {
            const selected = manualOverride === period;
            const t = themes[period];
            return (
              <div
                key={period}
                onClick={() => setManualOverride(period)}
                style={{
                  borderRadius: 12, overflow: "hidden", cursor: "pointer",
                  border: `2px solid ${selected ? theme.accent : theme.bgCardBorder}`,
                  transition: "all 0.18s",
                  boxShadow: selected ? `0 0 0 2px ${theme.accent}30` : "none",
                }}
              >
                {/* Preview strip */}
                <div style={{ height: 48, background: gradient, position: "relative" }}>
                  <span style={{ position: "absolute", top: 10, left: 12, fontSize: "1.4rem" }}>{emoji}</span>
                  {selected && (
                    <div style={{
                      position: "absolute", top: 8, right: 8,
                      background: "#fff", borderRadius: "50%", width: 20, height: 20,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Check size={12} color={theme.accent} />
                    </div>
                  )}
                </div>
                {/* Card bottom */}
                <div style={{
                  padding: "10px 12px",
                  background: t.bgCard,
                  borderTop: `1px solid ${t.bgCardBorder}`,
                }}>
                  <p style={{ color: t.textPrimary, fontWeight: 700, fontSize: "0.83rem", margin: 0 }}>{label}</p>
                  <p style={{ color: t.textMuted, fontSize: "0.73rem", margin: "2px 0 0" }}>{desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

    </div>
  );
}
