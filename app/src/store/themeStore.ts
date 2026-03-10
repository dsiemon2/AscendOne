import { create } from "zustand";

export type ThemePeriod = "dawn" | "day" | "dusk" | "night";

export interface ThemeColors {
  period: ThemePeriod;
  label: string;
  emoji: string;
  // Main backgrounds
  bgPrimary: string;
  bgCard: string;
  bgCardBorder: string;
  bgCardShadow: string;
  bgInput: string;
  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  // Sidebar
  sidebarBg: string;
  sidebarBorder: string;
  sidebarText: string;
  sidebarTextActive: string;
  sidebarActiveBg: string;
  sidebarActiveBar: string;
  sidebarBrandText: string;
  sidebarBrandSub: string;
  sidebarPointsBg: string;
  sidebarPointsBorder: string;
  // Accent
  accent: string;
  accentLight: string;
  accentGradient: string;
  // Quote strip
  quoteBg: string;
  quoteBorder: string;
  quoteAccent: string;
  // Misc
  iconBg: string;
  progressBg: string;
  progressFill: string;
  scrollbarThumb: string;
  scrollbarTrack: string;
}

const themes: Record<ThemePeriod, ThemeColors> = {
  dawn: {
    period: "dawn",
    label: "Dawn",
    emoji: "🌅",
    bgPrimary: "#FFF5F7",
    bgCard: "#FFFFFF",
    bgCardBorder: "#FFD6E7",
    bgCardShadow: "rgba(216,27,96,0.08)",
    bgInput: "#FFF0F5",
    textPrimary: "#2d0a1a",
    textSecondary: "#7c2d4a",
    textMuted: "#b06080",
    sidebarBg: "linear-gradient(180deg, #1e0510 0%, #3a0e28 55%, #501838 100%)",
    sidebarBorder: "#6b1f48",
    sidebarText: "#e898b4",
    sidebarTextActive: "#FFB3D1",
    sidebarActiveBg: "rgba(233,30,140,0.18)",
    sidebarActiveBar: "#E91E8C",
    sidebarBrandText: "#FFB3D1",
    sidebarBrandSub: "#7c2d4a",
    sidebarPointsBg: "rgba(233,30,140,0.12)",
    sidebarPointsBorder: "rgba(233,30,140,0.25)",
    accent: "#D81B60",
    accentLight: "#FCE4EC",
    accentGradient: "linear-gradient(135deg, #D81B60 0%, #F06292 100%)",
    quoteBg: "rgba(216,27,96,0.04)",
    quoteBorder: "#FFD6E7",
    quoteAccent: "#D81B60",
    iconBg: "#FFF0F5",
    progressBg: "#FFD6E7",
    progressFill: "linear-gradient(90deg, #D81B60, #F06292)",
    scrollbarThumb: "#D81B60",
    scrollbarTrack: "#FFD6E7",
  },

  day: {
    period: "day",
    label: "Sunny Day",
    emoji: "☀️",
    bgPrimary: "#F0F9FF",
    bgCard: "#FFFFFF",
    bgCardBorder: "#BAE6FD",
    bgCardShadow: "rgba(2,136,209,0.07)",
    bgInput: "#F0F9FF",
    textPrimary: "#0c2340",
    textSecondary: "#1a4a7a",
    textMuted: "#4a8cb8",
    sidebarBg: "linear-gradient(180deg, #061828 0%, #0d2f50 50%, #104072 100%)",
    sidebarBorder: "#0d3060",
    sidebarText: "#7ab8d8",
    sidebarTextActive: "#FFD700",
    sidebarActiveBg: "rgba(255,215,0,0.15)",
    sidebarActiveBar: "#FFD700",
    sidebarBrandText: "#FFD700",
    sidebarBrandSub: "#4a7aa0",
    sidebarPointsBg: "rgba(255,215,0,0.12)",
    sidebarPointsBorder: "rgba(255,215,0,0.3)",
    accent: "#0288D1",
    accentLight: "#E0F7FF",
    accentGradient: "linear-gradient(135deg, #FFB300 0%, #FFC107 40%, #02A0D1 100%)",
    quoteBg: "rgba(2,136,209,0.04)",
    quoteBorder: "#BAE6FD",
    quoteAccent: "#0288D1",
    iconBg: "#E0F7FF",
    progressBg: "#BAE6FD",
    progressFill: "linear-gradient(90deg, #FFB300, #FFC107)",
    scrollbarThumb: "#0288D1",
    scrollbarTrack: "#BAE6FD",
  },

  dusk: {
    period: "dusk",
    label: "Sunset",
    emoji: "🌇",
    bgPrimary: "#FFF8F0",
    bgCard: "#FFFFFF",
    bgCardBorder: "#FFD0A8",
    bgCardShadow: "rgba(249,115,22,0.08)",
    bgInput: "#FFF5EC",
    textPrimary: "#1a0a00",
    textSecondary: "#7c3a0e",
    textMuted: "#b06030",
    sidebarBg: "linear-gradient(180deg, #0e0318 0%, #250840 50%, #3d1020 100%)",
    sidebarBorder: "#5a1a34",
    sidebarText: "#e8a070",
    sidebarTextActive: "#FFB347",
    sidebarActiveBg: "rgba(249,115,22,0.18)",
    sidebarActiveBar: "#F97316",
    sidebarBrandText: "#FFB347",
    sidebarBrandSub: "#7c3a0e",
    sidebarPointsBg: "rgba(249,115,22,0.12)",
    sidebarPointsBorder: "rgba(249,115,22,0.25)",
    accent: "#F97316",
    accentLight: "#FFF0E0",
    accentGradient: "linear-gradient(135deg, #F97316 0%, #EF4444 50%, #A855F7 100%)",
    quoteBg: "rgba(249,115,22,0.04)",
    quoteBorder: "#FFD0A8",
    quoteAccent: "#F97316",
    iconBg: "#FFF5EC",
    progressBg: "#FFD0A8",
    progressFill: "linear-gradient(90deg, #F97316, #EF4444)",
    scrollbarThumb: "#F97316",
    scrollbarTrack: "#FFD0A8",
  },

  night: {
    // Colors sampled from galaxy.jpg:
    //   Deep space black background, ice-blue starlight text,
    //   rose-pink nebula clusters, blue star field, cosmic purple depth
    period: "night",
    label: "Galaxy",
    emoji: "🌌",
    // Transparent so the GalaxyBackground component shows through
    bgPrimary: "transparent",
    bgCard: "rgba(8, 9, 20, 0.78)",
    bgCardBorder: "rgba(80, 110, 200, 0.22)",
    bgCardShadow: "rgba(80, 80, 220, 0.18)",
    bgInput: "rgba(6, 7, 16, 0.90)",
    // Ice-blue starlight — sampled from the dense star field center
    textPrimary: "#d4e4ff",
    textSecondary: "#a0b8d8",
    textMuted: "#6878a8",
    // True deep space black sidebar — like the dark void edges of the image
    sidebarBg: "linear-gradient(180deg, #020206 0%, #04040c 55%, #07070f 100%)",
    sidebarBorder: "#181930",
    sidebarText: "#8898c8",
    sidebarTextActive: "#d4e4ff",
    sidebarActiveBg: "rgba(80,144,224,0.18)",
    sidebarActiveBar: "#5090e0",
    sidebarBrandText: "#d4e4ff",
    sidebarBrandSub: "#6070a0",
    // Pink nebula glow for points badge
    sidebarPointsBg: "rgba(224,80,112,0.14)",
    sidebarPointsBorder: "rgba(224,80,112,0.28)",
    // Electric blue — sampled from the blue star clusters
    accent: "#5090e0",
    accentLight: "#0d1020",
    // Pink nebula → blue stars → deep cosmic purple — the full galaxy gradient
    accentGradient: "linear-gradient(135deg, #e05070 0%, #5090e0 55%, #7040d0 100%)",
    quoteBg: "rgba(6, 7, 18, 0.72)",
    quoteBorder: "rgba(70, 100, 190, 0.22)",
    quoteAccent: "#6aadff",
    // Card interiors — semi-transparent so nebula bleeds through
    iconBg: "rgba(12, 13, 28, 0.82)",
    progressBg: "rgba(30, 32, 60, 0.70)",
    // Progress fills with the nebula-to-star gradient
    progressFill: "linear-gradient(90deg, #e05070, #5090e0)",
    scrollbarThumb: "#5090e0",
    scrollbarTrack: "#14152a",
  },
};

function getThemePeriod(): ThemePeriod {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 18) return "day";
  if (hour >= 18 && hour < 21) return "dusk";
  return "night";
}

interface ThemeState {
  theme: ThemeColors;
  manualOverride: ThemePeriod | null;
  updateTheme: () => void;
  setManualOverride: (period: ThemePeriod | null) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: themes[getThemePeriod()],
  manualOverride: null,
  updateTheme: () =>
    set((state) => ({
      theme: themes[state.manualOverride ?? getThemePeriod()],
    })),
  setManualOverride: (period) =>
    set({
      manualOverride: period,
      theme: period ? themes[period] : themes[getThemePeriod()],
    }),
}));

export { themes };
