import { create } from "zustand";

interface Profile {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  email: string;
  pin?: string;
  country?: string;
  timezone: string;
  avatar_path?: string;
}

interface AppState {
  profile: Profile | null;
  isDbReady: boolean;
  currentPage: string;
  sidebarCollapsed: boolean;
  todayPoints: number;
  weekPoints: number;
  isLocked: boolean;
  sleepMinutes: number; // 0 = never; >0 = auto-lock after N minutes of inactivity
  setProfile: (profile: Profile | null) => void;
  setDbReady: (ready: boolean) => void;
  setCurrentPage: (page: string) => void;
  toggleSidebar: () => void;
  setTodayPoints: (points: number) => void;
  addTodayPoints: (points: number) => void;
  setWeekPoints: (points: number) => void;
  lockApp: () => void;
  unlockApp: () => void;
  setSleepMinutes: (minutes: number) => void;
}

const SLEEP_KEY = "ascendone_sleep_minutes";

function loadSleepMinutes(): number {
  try { return Number(localStorage.getItem(SLEEP_KEY) ?? 0) || 0; } catch { return 0; }
}

export const useAppStore = create<AppState>((set) => ({
  profile: null,
  isDbReady: false,
  currentPage: "dashboard",
  sidebarCollapsed: false,
  todayPoints: 0,
  weekPoints: 0,
  isLocked: false,
  sleepMinutes: loadSleepMinutes(),
  setProfile: (profile) => set({ profile }),
  setDbReady: (ready) => set({ isDbReady: ready }),
  setCurrentPage: (page) => set({ currentPage: page }),
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setTodayPoints: (points) => set({ todayPoints: points }),
  addTodayPoints: (points) => set((state) => ({ todayPoints: state.todayPoints + points })),
  setWeekPoints: (points) => set({ weekPoints: points }),
  lockApp:   () => set({ isLocked: true }),
  unlockApp: () => set({ isLocked: false }),
  setSleepMinutes: (minutes) => {
    try { localStorage.setItem(SLEEP_KEY, String(minutes)); } catch { /* ignore */ }
    set({ sleepMinutes: minutes });
  },
}));
