import { useEffect, useRef, useCallback } from "react";
import type { ReactElement } from "react";
import WizardNav from "./WizardNav";
import TopBar from "./TopBar";
import BottomBar from "./BottomBar";
import GalaxyBackground from "./GalaxyBackground";
import ErrorBoundary from "../ErrorBoundary";
import PinLock from "../PinLock";
import { useAppStore } from "../../store/appStore";
import { useThemeStore } from "../../store/themeStore";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { getDb } from "../../db/database";

// Pages
import Dashboard from "../../pages/Dashboard";
import CalendarPage from "../../pages/CalendarPage";
import GoalsPage from "../../pages/GoalsPage";
import TasksPage from "../../pages/TasksPage";
import GratitudesPage from "../../pages/GratitudesPage";
import AffirmationsPage from "../../pages/AffirmationsPage";
import JournalPage from "../../pages/JournalPage";
import RoadmapPage from "../../pages/RoadmapPage";
import PointsPage from "../../pages/PointsPage";
import VisionBoardPage from "../../pages/VisionBoardPage";
import SettingsPage from "../../pages/SettingsPage";
import ProfilePage from "../../pages/ProfilePage";
import StatsPage from "../../pages/StatsPage";
import ToDoPage from "../../pages/ToDoPage";
import ChallengePage from "../../pages/ChallengePage";

const pageMap: Record<string, ReactElement> = {
  dashboard: <Dashboard />,
  stats: <StatsPage />,
  calendar: <CalendarPage />,
  goals: <GoalsPage />,
  tasks: <TasksPage />,
  gratitudes: <GratitudesPage />,
  affirmations: <AffirmationsPage />,
  journal: <JournalPage />,
  roadmap: <RoadmapPage />,
  points: <PointsPage />,
  "vision-board": <VisionBoardPage />,
  todo: <ToDoPage />,
  challenges: <ChallengePage />,
  settings: <SettingsPage />,
  profile: <ProfilePage />,
};

const INACTIVITY_EVENTS = [
  "mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel",
] as const;

export default function Layout() {
  const { currentPage, profile, isLocked, unlockApp, sleepMinutes, lockApp } = useAppStore();
  const { theme } = useThemeStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inject dynamic scrollbar styles
  useEffect(() => {
    const styleId = "ascendone-scrollbar-style";
    let el = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = styleId;
      document.head.appendChild(el);
    }
    el.textContent = `
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: ${theme.scrollbarTrack}; }
      ::-webkit-scrollbar-thumb { background: ${theme.scrollbarThumb}; border-radius: 3px; }
      ::-webkit-scrollbar-thumb:hover { opacity: 0.85; }
    `;
  }, [theme]);

  // ── Auto-sleep / inactivity lock ──────────────────────────────────────────
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // Only set a new timer if sleep is configured, PIN exists, and not already locked
    if (sleepMinutes > 0 && profile?.pin) {
      timerRef.current = setTimeout(() => {
        lockApp();
      }, sleepMinutes * 60 * 1000);
    }
  }, [sleepMinutes, profile?.pin, lockApp]);

  useEffect(() => {
    // Don't run while locked — resume timer only after unlock
    if (isLocked) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    // No PIN or sleep disabled → do nothing
    if (!profile?.pin || sleepMinutes === 0) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    // Start the idle timer and listen for activity
    resetTimer();
    INACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, resetTimer, { passive: true })
    );

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      INACTIVITY_EVENTS.forEach((ev) =>
        window.removeEventListener(ev, resetTimer)
      );
    };
  }, [isLocked, sleepMinutes, profile?.pin, resetTimer]);

  // ── Birthday notifications (once per calendar day) ────────────────────────
  useEffect(() => {
    async function checkBirthdays() {
      try {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

        // Only run once per calendar day
        const lastCheck = localStorage.getItem("birthday_check_date");
        if (lastCheck === todayStr) return;
        localStorage.setItem("birthday_check_date", todayStr);

        // Request notification permission if needed
        let permitted = await isPermissionGranted();
        if (!permitted) {
          const result = await requestPermission();
          permitted = result === "granted";
        }
        if (!permitted) return;

        // Find all birthday events and check if month+day matches today
        const db = await getDb();
        const birthdays = await db.select<{ title: string; start_datetime: string; recurrence: string }[]>(
          `SELECT title, start_datetime, recurrence FROM events
           WHERE event_type = 'birthday' AND recurrence IS NOT NULL`
        );

        for (const b of birthdays) {
          try {
            const rec = JSON.parse(b.recurrence);
            if (rec.type !== "annual") continue;
          } catch { continue; }

          const masterDate = new Date(b.start_datetime.includes("T")
            ? b.start_datetime
            : b.start_datetime + "T00:00:00");
          const sameDay = masterDate.getMonth() === today.getMonth()
                       && masterDate.getDate()   === today.getDate();
          if (!sameDay) continue;

          // Fire the OS notification 🎂
          sendNotification({
            title: "🎂 Birthday Today!",
            body: `Today is ${b.title}! Don't forget to wish them well 🎉`,
          });
        }
      } catch (e) {
        console.error("Birthday check failed", e);
      }
    }
    checkBirthdays();
  }, []);

  const isGalaxy = theme.period === "night";

  return (
    <div
      className="flex h-full w-full"
      style={{
        background: isGalaxy ? "#06060e" : theme.bgPrimary,
        position: "relative",
        transition: "background 0.4s ease",
      }}
    >
      {/* Galaxy background renders fixed behind everything */}
      {isGalaxy && <GalaxyBackground />}

      {/* UI layer sits above the galaxy */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          overflow: "hidden",
        }}
      >
        {/* TopBar spans the full width — above wizard col + content */}
        <TopBar />

        {/* Horizontal row: wizard column on the left, content on the right */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <WizardNav />
          <div className="flex flex-col flex-1 overflow-hidden">
            <main
              className="flex-1 overflow-y-auto"
              style={{
                background: "transparent",
                transition: "background 0.4s ease",
                padding: "28px 32px 32px",
              }}
            >
              <ErrorBoundary key={currentPage}>
                {pageMap[currentPage] ?? <Dashboard />}
              </ErrorBoundary>
            </main>
            <BottomBar />
          </div>
        </div>
      </div>

      {/* ── Lock screen overlay ── */}
      {isLocked && profile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999 }}>
          <PinLock
            firstName={profile.first_name}
            correctPin={profile.pin ?? ""}
            onUnlock={unlockApp}
          />
        </div>
      )}
    </div>
  );
}
