import { useMemo } from "react";

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  color: string;
  glow: boolean;
}

/** Deterministic LCG pseudo-random (no Math.random so layout is stable) */
function makeLCG(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function generateStars(count: number): Star[] {
  const rand = makeLCG(92741);
  const starColors = [
    "#ffffff", "#e8f4ff", "#d0e8ff",   // blue-white stars
    "#ffe8f0", "#ffd0e0",               // warm pink stars
    "#e0d0ff", "#c8b8ff",               // purple-tinted stars
  ];
  return Array.from({ length: count }, () => {
    const size = 0.6 + rand() * 2.2;
    return {
      x: rand() * 100,
      y: rand() * 100,
      size,
      opacity: 0.35 + rand() * 0.65,
      color: starColors[Math.floor(rand() * starColors.length)],
      glow: size > 2.0,
    };
  });
}

export default function GalaxyBackground() {
  const stars = useMemo(() => generateStars(220), []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {/* ── Deep space base + layered nebula clouds ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 70% 55% at 8% 28%,  rgba(210,55,90,0.30)  0%, rgba(160,35,70,0.12)  42%, transparent 68%),
            radial-gradient(ellipse 55% 48% at 92% 12%,  rgba(90,40,220,0.35)  0%, rgba(70,30,180,0.15)  40%, transparent 70%),
            radial-gradient(ellipse 62% 58% at 74% 72%,  rgba(50,90,230,0.26)  0%, rgba(35,70,195,0.11)  44%, transparent 70%),
            radial-gradient(ellipse 48% 40% at 28% 70%,  rgba(135,30,175,0.22) 0%, rgba(100,20,140,0.08) 45%, transparent 62%),
            radial-gradient(ellipse 42% 38% at 55% 25%,  rgba(70,110,230,0.18) 0%, transparent 55%),
            radial-gradient(ellipse 38% 34% at 85% 78%,  rgba(185,50,110,0.16) 0%, transparent 55%),
            radial-gradient(ellipse 52% 44% at 18% 82%,  rgba(55,80,200,0.16)  0%, transparent 60%),
            radial-gradient(ellipse 30% 28% at 48% 55%,  rgba(120,40,160,0.12) 0%, transparent 52%),
            #06060e
          `,
        }}
      />

      {/* ── Bright nebula core glow ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 25% 20% at 10% 30%, rgba(240,80,120,0.18) 0%, transparent 50%),
            radial-gradient(ellipse 20% 18% at 90% 14%, rgba(120,60,255,0.20) 0%, transparent 50%),
            radial-gradient(ellipse 22% 20% at 72% 70%, rgba(60,130,255,0.18) 0%, transparent 50%)
          `,
          mixBlendMode: "screen",
        }}
      />

      {/* ── Star field ── */}
      {stars.map((star, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${star.x}%`,
            top:  `${star.y}%`,
            width:  `${star.size}px`,
            height: `${star.size}px`,
            borderRadius: "50%",
            background: star.color,
            opacity: star.opacity,
            boxShadow: star.glow
              ? `0 0 ${star.size * 3}px ${star.size}px ${star.color}55`
              : undefined,
          }}
        />
      ))}

      {/* ── Vignette to darken extreme edges ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 85% 85% at 50% 50%, transparent 55%, rgba(2,2,8,0.75) 100%)`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
