import { useEffect, useState } from "react";
import { getDb } from "./db/database";
import { useAppStore } from "./store/appStore";
import { useThemeStore } from "./store/themeStore";
import Layout from "./components/layout/Layout";
import Onboarding from "./pages/Onboarding";
import PinLock from "./components/PinLock";
import MorningStartup from "./components/MorningStartup";
import LogoImage from "./components/LogoImage";
import { useNotifications } from "./hooks/useNotifications";
import { getLocalDateString } from "./utils/dateUtils";

const STARTUP_KEY = "ascendone_last_startup";

function shouldShowMorningStartup(): boolean {
  // Use local date — not UTC — so the morning greeting shows at midnight local time
  const today = getLocalDateString();
  const last = localStorage.getItem(STARTUP_KEY);
  return last !== today;
}

function markStartupShown() {
  const today = getLocalDateString();
  localStorage.setItem(STARTUP_KEY, today);
}

export default function App() {
  const { setDbReady, setProfile, setTodayPoints, profile, setCurrentPage } = useAppStore();
  const { theme } = useThemeStore();
  const [loading, setLoading]         = useState(true);
  const [showStartup, setShowStartup] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);

  // Background notification scheduler — fires daily reminders even when app is in tray
  useNotifications();

  useEffect(() => { bootstrap(); }, []);

  async function bootstrap() {
    try {
      const db = await getDb();
      setDbReady(true);

      const profiles = await db.select<Array<{
        id: number; first_name: string; last_name: string; username: string;
        email: string; pin: string; country: string; timezone: string; avatar_path: string;
      }>>("SELECT * FROM profile WHERE id = 1 LIMIT 1");

      if (profiles.length > 0) {
        setProfile(profiles[0]);
        // Morning startup only shows once per day, and only after PIN is verified
        if (shouldShowMorningStartup()) {
          markStartupShown();
          setShowStartup(true);
        }
      }

      // Use local date so the query matches entries stored during today's local calendar day
      const today = getLocalDateString();
      const pts = await db.select<[{ total: number }]>(
        "SELECT COALESCE(SUM(points), 0) as total FROM points_log WHERE entry_date = ?", [today]
      );
      setTodayPoints(pts[0]?.total ?? 0);
    } catch (e) {
      console.error("Bootstrap error:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleOnboardingComplete() {
    const db = await getDb();
    const profiles = await db.select<Array<{
      id: number; first_name: string; last_name: string; username: string;
      email: string; pin: string; country: string; timezone: string; avatar_path: string;
    }>>("SELECT * FROM profile WHERE id = 1 LIMIT 1");
    if (profiles.length > 0) {
      setProfile(profiles[0]);
      // New user — PIN was just set, treat as already verified for this session
      setPinVerified(true);
      setShowStartup(true);
      markStartupShown();
    }
  }

  // ── Loading screen ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: theme.bgPrimary }}>
        <div className="flex flex-col items-center gap-4">
          <LogoImage
            size={96}
            style={{ filter: "drop-shadow(0 6px 24px rgba(80,144,224,0.40))" }}
          />
          <div className="flex flex-col items-center gap-1">
            <p style={{ color: theme.textPrimary, fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>AscendOne</p>
            <p style={{ color: theme.textMuted, fontSize: "0.8rem", margin: 0 }}>Loading your journey...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── No profile — show onboarding ────────────────────────────────────────────
  if (!profile) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  // ── Profile has PIN and not yet verified this session ───────────────────────
  if (profile.pin && !pinVerified) {
    return (
      <PinLock
        firstName={profile.first_name}
        correctPin={profile.pin}
        onUnlock={() => setPinVerified(true)}
      />
    );
  }

  // ── Main app ────────────────────────────────────────────────────────────────
  return (
    <>
      <Layout />
      {showStartup && (
        <MorningStartup
          onNavigate={(page) => setCurrentPage(page)}
          onClose={() => setShowStartup(false)}
        />
      )}
    </>
  );
}
