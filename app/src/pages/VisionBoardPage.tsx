import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, X, Edit2, Maximize2, ChevronLeft, ChevronRight,
  Trash2, Image, Check, Upload, Link, GripVertical, Play, Pause, Download, Eye,
} from "lucide-react";
import { useThemeStore } from "../store/themeStore";
import type { ThemeColors } from "../store/themeStore";
import { getDb } from "../db/database";

// ── Types ────────────────────────────────────────────────────────────────────
interface VisionItem {
  id: number;
  title: string;
  description: string;
  image_url: string;
  category: string;
  size: "small" | "medium" | "large" | "wide";
  sort_order: number;
  accent_color: string;
  image_fit: "cover" | "contain";
  text_font: string; // Google Font family name; empty = default style
}

// ── Decorative font options ───────────────────────────────────────────────────
const FONT_OPTIONS = [
  { id: "Bebas Neue",          label: "BOLD",    desc: "Strong block caps"  },
  { id: "Dancing Script",      label: "Script",  desc: "Handwritten"        },
  { id: "Playfair Display",    label: "Elegant", desc: "Classic serif"      },
  { id: "Oswald",              label: "Modern",  desc: "Clean & powerful"   },
  { id: "Pacifico",            label: "Playful", desc: "Fun & rounded"      },
  { id: "Cormorant Garamond",  label: "Refined", desc: "Luxury editorial"   },
] as const;

// ── Categories ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "all",     label: "All",               emoji: "✨" },
  { id: "health",  label: "Health & Wellness",  emoji: "💪" },
  { id: "wealth",  label: "Wealth & Abundance", emoji: "💰" },
  { id: "love",    label: "Love & Family",      emoji: "❤️" },
  { id: "career",  label: "Career & Purpose",   emoji: "🚀" },
  { id: "travel",  label: "Travel & Adventure", emoji: "✈️" },
  { id: "growth",  label: "Personal Growth",    emoji: "🌱" },
  { id: "home",    label: "Home & Lifestyle",   emoji: "🏡" },
  { id: "general", label: "General",            emoji: "⭐" },
];

const CATEGORY_COLORS: Record<string, string> = {
  health:  "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
  wealth:  "linear-gradient(135deg, #f59e0b 0%, #eab308 100%)",
  love:    "linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)",
  career:  "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
  travel:  "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
  growth:  "linear-gradient(135deg, #84cc16 0%, #10b981 100%)",
  home:    "linear-gradient(135deg, #f97316 0%, #f59e0b 100%)",
  general: "linear-gradient(135deg, #5090e0 0%, #7040d0 100%)",
};

const ACCENT_OPTIONS = [
  "#5090e0","#7040d0","#e05070","#10b981","#f59e0b",
  "#ec4899","#6366f1","#3b82f6","#f97316","#06b6d4",
];

const SIZE_OPTIONS: { id: VisionItem["size"]; label: string; desc: string }[] = [
  { id: "small",  label: "Small",  desc: "1×1 — Quick reminder" },
  { id: "medium", label: "Medium", desc: "1×1 — Standard card"  },
  { id: "wide",   label: "Wide",   desc: "2×1 — Banner style"   },
  { id: "large",  label: "Large",  desc: "2×2 — Feature card"   },
];

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ theme, onAdd }: { theme: ThemeColors; onAdd: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ fontSize: "4rem", marginBottom: 16 }}>🌌</div>
      <h3 style={{ color: theme.textPrimary, fontSize: "1.2rem", fontWeight: 700, margin: "0 0 8px" }}>
        Your Vision Board is empty
      </h3>
      <p style={{ color: theme.textMuted, fontSize: "0.88rem", margin: "0 0 24px", maxWidth: 340, marginInline: "auto" }}>
        Add images, affirmations, and dreams that inspire you. What do you want to manifest?
      </p>
      <button onClick={onAdd} style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "12px 24px", borderRadius: 12,
        background: "linear-gradient(135deg, #5090e0 0%, #7040d0 100%)",
        color: "#fff", border: "none", fontWeight: 700, fontSize: "0.92rem", cursor: "pointer",
      }}>
        <Plus size={18} /> Add Your First Vision
      </button>
    </div>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────
function DeleteConfirmModal({ itemTitle, theme, onConfirm, onCancel }: {
  itemTitle: string;
  theme: ThemeColors;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 250,
      background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        background: theme.bgCard, borderRadius: 18,
        border: `1px solid ${theme.bgCardBorder}`,
        boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
        padding: "32px", maxWidth: 360, width: "100%", textAlign: "center",
      }}>
        <div style={{ fontSize: "2.8rem", marginBottom: 14 }}>🗑️</div>
        <h3 style={{ color: theme.textPrimary, fontWeight: 700, fontSize: "1.05rem", margin: "0 0 8px" }}>
          Remove this Vision?
        </h3>
        <p style={{ color: theme.textMuted, fontSize: "0.85rem", margin: "0 0 24px", lineHeight: 1.55 }}>
          <span style={{ fontStyle: "italic", color: theme.textSecondary }}>"{itemTitle}"</span>
          {" "}will be permanently removed from your board.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "11px", borderRadius: 10,
            background: theme.bgInput, border: `1px solid ${theme.bgCardBorder}`,
            color: theme.textSecondary, fontWeight: 600, fontSize: "0.88rem", cursor: "pointer",
          }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: "11px", borderRadius: 10,
            background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            border: "none", color: "#fff", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer",
          }}>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Slideshow / Daily Meditation Modal ────────────────────────────────────────
function SlideshowModal({ items, onClose }: {
  items: VisionItem[];
  onClose: () => void;
}) {
  const [idx, setIdx]         = useState(0);
  const [paused, setPaused]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [imgError, setImgError] = useState(false);
  const startTimeRef          = useRef(Date.now());
  const DURATION              = 6000;   // ms per slide
  const TICK                  = 50;     // progress poll interval

  const goTo = useCallback((newIdx: number) => {
    setIdx(newIdx);
    setProgress(0);
    setImgError(false);
    startTimeRef.current = Date.now();
  }, []);

  // Auto-advance timer — resets whenever idx or paused changes
  useEffect(() => {
    if (paused || items.length <= 1) {
      setProgress(p => p); // keep progress frozen visually
      return;
    }
    startTimeRef.current = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(100, (elapsed / DURATION) * 100);
      setProgress(pct);
      if (elapsed >= DURATION) {
        startTimeRef.current = Date.now();
        setIdx(prev => (prev + 1) % items.length);
        setImgError(false);
      }
    }, TICK);
    return () => clearInterval(timer);
  }, [paused, idx, items.length]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape")      onClose();
      if (e.key === "ArrowLeft")   goTo((idx - 1 + items.length) % items.length);
      if (e.key === "ArrowRight")  goTo((idx + 1) % items.length);
      if (e.key === " ")           { e.preventDefault(); setPaused(p => !p); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [idx, items.length, onClose, goTo]);

  const item = items[idx];
  if (!item) return null;
  const hasImage = item.image_url && !imgError;
  const cat      = CATEGORIES.find(c => c.id === item.category);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#000", overflow: "hidden" }}>

      {/* Background image / gradient */}
      {hasImage ? (
        <>
          {/* Blurred fill layer for contain/portrait images */}
          {item.image_fit === "contain" && (
            <img
              key={`blur-${item.id}-${idx}`}
              src={item.image_url}
              aria-hidden
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%",
                objectFit: "cover", filter: "blur(32px)", transform: "scale(1.16)",
                opacity: 0.6, animation: "vbFadeIn 0.7s ease",
              }}
            />
          )}
          <img
            key={`img-${item.id}-${idx}`}
            src={item.image_url}
            alt={item.title}
            onError={() => setImgError(true)}
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: item.image_fit === "contain" ? "contain" : "cover",
              opacity: 0.82,
              animation: "vbFadeIn 0.7s ease",
            }}
          />
        </>
      ) : (
        <div
          key={`grad-${item.id}-${idx}`}
          style={{
            position: "absolute", inset: 0,
            background: CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.general,
            animation: "vbFadeIn 0.7s ease",
          }}
        />
      )}

      {/* Dark vignette overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.12) 45%, rgba(0,0,0,0.38) 100%)",
      }} />

      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 24px",
      }}>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.12em" }}>
          ✨ VISION BOARD MEDITATION
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={() => setPaused(p => !p)}
            style={{
              background: "rgba(255,255,255,0.14)", backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.18)", borderRadius: 10,
              padding: "7px 14px", cursor: "pointer", color: "#fff",
              display: "flex", alignItems: "center", gap: 6,
              fontSize: "0.8rem", fontWeight: 600,
            }}
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
            {paused ? "Resume" : "Pause"}
          </button>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.14)", backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.18)", borderRadius: "50%",
            padding: 9, cursor: "pointer", color: "#fff", lineHeight: 0,
          }}>
            <X size={17} />
          </button>
        </div>
      </div>

      {/* Prev arrow */}
      <button
        onClick={() => goTo((idx - 1 + items.length) % items.length)}
        style={{
          position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)",
          background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12,
          padding: 13, cursor: "pointer", color: "#fff", lineHeight: 0,
        }}
      >
        <ChevronLeft size={26} />
      </button>

      {/* Next arrow */}
      <button
        onClick={() => goTo((idx + 1) % items.length)}
        style={{
          position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)",
          background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12,
          padding: 13, cursor: "pointer", color: "#fff", lineHeight: 0,
        }}
      >
        <ChevronRight size={26} />
      </button>

      {/* Center content */}
      <div style={{
        position: "absolute",
        bottom: 110, left: "50%", transform: "translateX(-50%)",
        textAlign: "center", width: "min(640px, 84vw)",
      }}>
        {cat && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)",
            borderRadius: 20, padding: "5px 14px", marginBottom: 18,
            fontSize: "0.78rem", fontWeight: 600, color: "rgba(255,255,255,0.9)",
          }}>
            {cat.emoji} {cat.label}
          </div>
        )}
        <h2 style={{
          color: "#fff", fontWeight: 900,
          fontSize: "clamp(1.8rem, 5vw, 3rem)",
          margin: "0 0 16px",
          textShadow: "0 2px 20px rgba(0,0,0,0.65)",
          lineHeight: 1.15,
        }}>
          {item.title}
        </h2>
        {item.description && (
          <p style={{
            color: "rgba(255,255,255,0.82)",
            fontSize: "clamp(0.9rem, 2vw, 1.12rem)",
            margin: 0, lineHeight: 1.75,
            textShadow: "0 1px 8px rgba(0,0,0,0.5)",
          }}>
            {item.description}
          </p>
        )}
      </div>

      {/* Dot indicators */}
      {items.length > 1 && (
        <div style={{
          position: "absolute", bottom: 66, left: "50%", transform: "translateX(-50%)",
          display: "flex", gap: 7, alignItems: "center",
        }}>
          {items.map((_, i) => (
            <button key={i} onClick={() => goTo(i)} style={{
              width: i === idx ? 22 : 6, height: 6, borderRadius: 3,
              background: i === idx ? "#fff" : "rgba(255,255,255,0.28)",
              border: "none", cursor: "pointer", padding: 0,
              transition: "all 0.32s ease",
            }} />
          ))}
        </div>
      )}

      {/* Progress bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.1)" }}>
        <div style={{
          height: "100%", background: "rgba(255,255,255,0.8)",
          width: `${progress}%`,
          transition: paused ? "none" : `width ${TICK}ms linear`,
        }} />
      </div>

      {/* Hint */}
      <div style={{
        position: "absolute", bottom: 14, right: 24,
        color: "rgba(255,255,255,0.28)", fontSize: "0.68rem",
      }}>
        {idx + 1} / {items.length} · ← → navigate · Space pause · Esc exit
      </div>

      <style>{`
        @keyframes vbFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Vision Card ───────────────────────────────────────────────────────────────
// Uses pointer events (not HTML5 drag API) for reliable drag-reorder in WebView2.
// The card div carries data-vision-id so the parent can use elementFromPoint to
// find which card is currently under the cursor.
function VisionCard({
  item, onEdit, onDelete, onFocus,
  isDragOver, isDragging,
  onGripPointerDown,
}: {
  item: VisionItem;
  onEdit:   () => void;
  onDelete: () => void;
  onFocus:  () => void;
  isDragOver:  boolean;
  isDragging:  boolean;
  onGripPointerDown: () => void;
}) {
  const [hovered, setHovered]   = useState(false);
  const [imgError, setImgError] = useState(false);
  const pointerDownRef          = useRef(false);  // true while pointer is held on grip

  const catGrad  = CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.general;
  const hasImage = item.image_url && !imgError;

  const gridSpan: React.CSSProperties =
    item.size === "large" ? { gridColumn: "span 2", gridRow: "span 2" } :
    item.size === "wide"  ? { gridColumn: "span 2" } : {};

  return (
    <div
      data-vision-id={item.id}
      style={{
        ...gridSpan,
        position: "relative", borderRadius: 16, overflow: "hidden",
        minHeight: item.size === "large" ? 280 : 200,
        cursor: isDragging ? "grabbing" : (hovered ? "pointer" : "default"),
        boxShadow: hovered && !isDragging
          ? "0 12px 40px rgba(0,0,0,0.4)"
          : "0 4px 20px rgba(0,0,0,0.25)",
        transition: "box-shadow 0.2s, transform 0.2s, outline 0.12s, opacity 0.15s",
        transform: hovered && !isDragOver && !isDragging ? "translateY(-2px)" : "none",
        opacity: isDragging ? 0.45 : 1,
        outline: isDragOver ? "2px solid rgba(80,144,224,0.9)" : "none",
        outlineOffset: 2,
        border: isDragOver
          ? "1px solid rgba(80,144,224,0.65)"
          : "1px solid rgba(255,255,255,0.08)",
        userSelect: "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (!pointerDownRef.current) onFocus(); }}
    >
      {/* Background: image, or gradient */}
      {hasImage ? (
        <>
          {item.image_fit === "contain" && (
            <img src={item.image_url} draggable={false} aria-hidden style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: "cover", filter: "blur(22px)", transform: "scale(1.12)",
              opacity: 0.55, pointerEvents: "none", userSelect: "none",
            }} />
          )}
          <img src={item.image_url} alt={item.title} draggable={false}
            onError={() => setImgError(true)}
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: item.image_fit === "contain" ? "contain" : "cover",
              pointerEvents: "none", userSelect: "none",
            }}
          />
        </>
      ) : (
        <div style={{ position: "absolute", inset: 0, background: catGrad, pointerEvents: "none" }} />
      )}

      {/* Decorative text overlay — shown when a font is selected and no image */}
      {!hasImage && item.text_font && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "28px 16px 42px", pointerEvents: "none",
          zIndex: 1,
        }}>
          <div style={{
            fontFamily: `'${item.text_font}', sans-serif`,
            fontSize: item.size === "large" ? "3.6rem"
                    : item.size === "wide"  ? "2.8rem" : "2.3rem",
            fontWeight: 700, color: "#fff", textAlign: "center",
            textShadow: "0 2px 20px rgba(0,0,0,0.35)",
            lineHeight: 1.1, wordBreak: "break-word",
          }}>
            {item.title}
          </div>
          {item.description && (
            <div style={{
              marginTop: 10, fontFamily: "inherit",
              fontSize: "0.78rem", color: "rgba(255,255,255,0.78)",
              textAlign: "center", lineHeight: 1.4,
              textShadow: "0 1px 6px rgba(0,0,0,0.4)",
              maxWidth: "90%",
            }}>
              {item.description}
            </div>
          )}
        </div>
      )}

      {/* Overlay */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: hasImage
          ? "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.18) 55%, transparent 100%)"
          : "linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 60%)",
      }} />

      {/* Grip handle — mouse-down here starts a reorder drag */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();       // prevent text selection
          e.stopPropagation();      // don't let click bubble to card
          pointerDownRef.current = true;
          onGripPointerDown();
        }}
        onMouseUp={() => { setTimeout(() => { pointerDownRef.current = false; }, 80); }}
        style={{
          position: "absolute", top: 10, left: 10,
          background: hovered ? "rgba(0,0,0,0.58)" : "rgba(0,0,0,0.28)",
          backdropFilter: "blur(6px)", borderRadius: 8, padding: "5px 7px",
          color: hovered ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.38)",
          lineHeight: 0, cursor: "grab",
          transition: "all 0.18s",
          userSelect: "none", touchAction: "none",
          zIndex: 2,
        }}
      >
        <GripVertical size={14} />
      </div>

      {/* Category badge */}
      <div style={{
        position: "absolute", top: 12, left: 44, zIndex: 2,
        background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)",
        borderRadius: 20, padding: "3px 10px",
        fontSize: "0.7rem", fontWeight: 600, color: "#fff",
        opacity: hovered ? 1 : 0.7, transition: "opacity 0.2s",
        pointerEvents: "none",
      }}>
        {CATEGORIES.find(c => c.id === item.category)?.emoji}{" "}
        {CATEGORIES.find(c => c.id === item.category)?.label ?? item.category}
      </div>

      {/* Action buttons */}
      {hovered && !isDragging && (
        <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 6, zIndex: 2 }}>
          {[
            { icon: <Maximize2 size={14} />, action: (e: React.MouseEvent) => { e.stopPropagation(); onFocus(); },  bg: "rgba(0,0,0,0.55)" },
            { icon: <Edit2 size={14} />,     action: (e: React.MouseEvent) => { e.stopPropagation(); onEdit(); },   bg: "rgba(0,0,0,0.55)" },
            { icon: <Trash2 size={14} />,    action: (e: React.MouseEvent) => { e.stopPropagation(); onDelete(); }, bg: "rgba(160,0,0,0.65)" },
          ].map((btn, i) => (
            <button key={i} onClick={btn.action} style={{
              background: btn.bg, backdropFilter: "blur(6px)", border: "none",
              borderRadius: 8, padding: "6px", cursor: "pointer", color: "#fff", lineHeight: 0,
            }}>
              {btn.icon}
            </button>
          ))}
        </div>
      )}

      {/* Bottom text strip — hidden when text_font is active (title shown big and centered) */}
      {!(item.text_font && !hasImage) && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px 16px", pointerEvents: "none" }}>
          <h3 style={{
            color: "#fff", fontWeight: 800, margin: 0, lineHeight: 1.3,
            fontSize: item.size === "large" ? "1.1rem" : "0.92rem",
            textShadow: "0 1px 4px rgba(0,0,0,0.5)",
          }}>
            {item.title}
          </h3>
          {item.description && (
            <p style={{
              color: "rgba(255,255,255,0.82)", fontSize: "0.76rem", margin: "4px 0 0",
              lineHeight: 1.45, textShadow: "0 1px 3px rgba(0,0,0,0.4)",
              display: "-webkit-box", WebkitLineClamp: item.size === "large" ? 3 : 2,
              WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
              {item.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Image helpers ─────────────────────────────────────────────────────────────
/** Resize + compress a File to a JPEG data URL (max 1200px wide, 85% quality) */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = document.createElement("img");
      img.onerror = reject;
      img.onload = () => {
        const MAX = 1200;
        let { naturalWidth: w, naturalHeight: h } = img;
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────────
function ItemModal({ item, theme, onSave, onClose }: {
  item: Partial<VisionItem> | null;
  theme: ThemeColors;
  onSave: (data: Omit<VisionItem, "id" | "sort_order">) => void;
  onClose: () => void;
}) {
  const isEdit = !!(item?.id);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title:        item?.title        ?? "",
    description:  item?.description  ?? "",
    image_url:    item?.image_url    ?? "",
    category:     item?.category     ?? "general",
    size:         (item?.size        ?? "medium") as VisionItem["size"],
    accent_color: item?.accent_color ?? "#5090e0",
    image_fit:    (item?.image_fit   ?? "cover") as VisionItem["image_fit"],
    text_font:    item?.text_font    ?? "",
  });

  const [imageMode, setImageMode] = useState<"upload" | "url">(
    item?.image_url?.startsWith("data:") ? "upload" : "url"
  );
  const [previewError, setPreviewError] = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [dragOver, setDragOver]         = useState(false);

  const set = (k: keyof typeof form, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    if (k === "image_url") setPreviewError(false);
  };

  const handleFile = async (file: File | undefined | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      set("image_url", dataUrl);
    } catch {
      alert("Could not read that image file.");
    } finally {
      setUploading(false);
    }
  };

  const inputSty: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    background: theme.bgInput, border: `1px solid ${theme.bgCardBorder}`,
    color: theme.textPrimary, fontSize: "0.9rem", outline: "none", boxSizing: "border-box",
  };

  const lbl = (text: string) => (
    <label style={{
      display: "block", color: theme.textMuted, fontSize: "0.72rem",
      fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 6,
    }}>{text}</label>
  );

  const hasPreview = form.image_url && !previewError;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        background: theme.bgCard, borderRadius: 20,
        border: `1px solid ${theme.bgCardBorder}`,
        boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
        width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px 16px", borderBottom: `1px solid ${theme.bgCardBorder}`,
        }}>
          <h2 style={{ color: theme.textPrimary, fontWeight: 700, fontSize: "1.05rem", margin: 0 }}>
            {isEdit ? "Edit Vision Card" : "Add to Vision Board"}
          </h2>
          <button onClick={onClose} style={{
            background: theme.iconBg, border: `1px solid ${theme.bgCardBorder}`,
            borderRadius: "50%", padding: 6, cursor: "pointer", color: theme.textMuted, lineHeight: 0,
          }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: "20px 24px 24px" }}>
          {/* Title */}
          <div style={{ marginBottom: 16 }}>
            {lbl("Title *")}
            <input value={form.title} onChange={e => set("title", e.target.value)}
              placeholder="My dream home, Financial freedom..." style={inputSty} />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            {lbl("Affirmation / Description")}
            <textarea value={form.description} onChange={e => set("description", e.target.value)}
              placeholder="I am living in my dream home... (optional)" rows={3}
              style={{ ...inputSty, resize: "vertical" as const, lineHeight: "1.5", fontFamily: "inherit" }} />
          </div>

          {/* ── Image section ── */}
          <div style={{ marginBottom: 16 }}>
            {lbl("Image (optional)")}
            {/* Mode toggle */}
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {([
                { id: "upload", label: "Upload File", icon: <Upload size={13} /> },
                { id: "url",    label: "Paste URL",   icon: <Link size={13} />   },
              ] as const).map(m => (
                <button key={m.id}
                  onClick={() => { setImageMode(m.id); setPreviewError(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "6px 14px", borderRadius: 20, border: "none",
                    cursor: "pointer", fontWeight: 600, fontSize: "0.8rem",
                    background: imageMode === m.id ? theme.accent : theme.bgInput,
                    color: imageMode === m.id ? "#fff" : theme.textSecondary,
                  }}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>

            {/* Upload mode */}
            {imageMode === "upload" && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={e => handleFile(e.target.files?.[0])}
                />
                {hasPreview ? (
                  <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", height: 160, border: `1px solid ${theme.bgCardBorder}` }}>
                    <img src={form.image_url} alt="preview"
                      onError={() => setPreviewError(true)}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        position: "absolute", bottom: 10, right: 10,
                        background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)",
                        border: "none", borderRadius: 8, padding: "6px 12px",
                        color: "#fff", fontSize: "0.76rem", fontWeight: 600, cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 5,
                      }}>
                      <Upload size={12} /> Replace
                    </button>
                    <button
                      onClick={() => set("image_url", "")}
                      style={{
                        position: "absolute", top: 8, right: 8,
                        background: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%",
                        padding: 5, cursor: "pointer", color: "#fff", lineHeight: 0,
                      }}>
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
                    style={{
                      border: `2px dashed ${dragOver ? theme.accent : theme.bgCardBorder}`,
                      borderRadius: 12, padding: "28px 20px",
                      textAlign: "center", cursor: "pointer",
                      background: dragOver ? theme.accentLight : theme.bgInput,
                      transition: "all 0.18s",
                    }}>
                    {uploading ? (
                      <p style={{ color: theme.textMuted, margin: 0, fontSize: "0.88rem" }}>Processing image…</p>
                    ) : (
                      <>
                        <Upload size={28} color={dragOver ? theme.accent : theme.textMuted} style={{ marginBottom: 10 }} />
                        <p style={{ color: dragOver ? theme.accent : theme.textPrimary, fontWeight: 600, margin: "0 0 4px", fontSize: "0.88rem" }}>
                          Click to browse or drag & drop
                        </p>
                        <p style={{ color: theme.textMuted, fontSize: "0.74rem", margin: 0 }}>
                          JPG, PNG, WebP, GIF · Auto-resized to fit
                        </p>
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {/* URL mode */}
            {imageMode === "url" && (
              <>
                <input value={form.image_url} onChange={e => set("image_url", e.target.value)}
                  placeholder="https://images.unsplash.com/..." style={inputSty} />
                {hasPreview && (
                  <div style={{ marginTop: 10, borderRadius: 10, overflow: "hidden", height: 120, border: `1px solid ${theme.bgCardBorder}` }}>
                    <img src={form.image_url} alt="preview" onError={() => setPreviewError(true)}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}
                {previewError && (
                  <p style={{ color: "#ef4444", fontSize: "0.78rem", marginTop: 6 }}>⚠️ Could not load image from that URL</p>
                )}
                <p style={{ color: theme.textMuted, fontSize: "0.73rem", marginTop: 6 }}>
                  Tip: Right-click any image online → "Copy image address" and paste here
                </p>
              </>
            )}
          </div>

          {/* ── Text Font — shown when NO image; turns card into a decorative word card ── */}
          {!form.image_url && (
            <div style={{ marginBottom: 16 }}>
              {lbl("Text Style")}
              <p style={{ color: theme.textMuted, fontSize: "0.73rem", margin: "0 0 10px" }}>
                Display your word(s) in a decorative font — like magazine cut-out text
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7 }}>
                {/* None / default */}
                <button onClick={() => set("text_font", "")} style={{
                  padding: "9px 8px", borderRadius: 10, cursor: "pointer",
                  textAlign: "center" as const, transition: "all 0.15s",
                  background: form.text_font === "" ? theme.accentLight : theme.bgInput,
                  border: `1px solid ${form.text_font === "" ? theme.accent : theme.bgCardBorder}`,
                }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: form.text_font === "" ? theme.accent : theme.textPrimary }}>Default</div>
                  <div style={{ fontSize: "0.68rem", color: theme.textMuted, marginTop: 1 }}>Normal style</div>
                </button>
                {FONT_OPTIONS.map(f => (
                  <button key={f.id} onClick={() => set("text_font", f.id)} style={{
                    padding: "9px 8px", borderRadius: 10, cursor: "pointer",
                    textAlign: "center" as const, transition: "all 0.15s",
                    background: form.text_font === f.id ? theme.accentLight : theme.bgInput,
                    border: `1px solid ${form.text_font === f.id ? theme.accent : theme.bgCardBorder}`,
                  }}>
                    <div style={{
                      fontFamily: `'${f.id}', sans-serif`,
                      fontSize: "1rem", fontWeight: 700, lineHeight: 1.1,
                      color: form.text_font === f.id ? theme.accent : theme.textPrimary,
                    }}>
                      {f.label}
                    </div>
                    <div style={{ fontSize: "0.67rem", color: theme.textMuted, marginTop: 2 }}>{f.desc}</div>
                  </button>
                ))}
              </div>

              {/* Live preview */}
              {form.text_font && form.title.trim() && (
                <div style={{
                  marginTop: 12, height: 100, borderRadius: 12,
                  background: CATEGORY_COLORS[form.category] ?? CATEGORY_COLORS.general,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden", position: "relative",
                }}>
                  <div style={{
                    fontFamily: `'${form.text_font}', sans-serif`,
                    fontSize: "2rem", fontWeight: 700, color: "#fff",
                    textAlign: "center", padding: "0 16px",
                    textShadow: "0 2px 12px rgba(0,0,0,0.3)",
                    lineHeight: 1.1,
                  }}>
                    {form.title}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Image Fit — only shown when an image is set */}
          {form.image_url && (
            <div style={{ marginBottom: 16 }}>
              {lbl("Image Display")}
              <div style={{ display: "flex", gap: 8 }}>
                {([
                  { id: "cover",   emoji: "🔲", label: "Cover",   desc: "Crop to fill — best for landscape" },
                  { id: "contain", emoji: "📐", label: "Fit",     desc: "Show full image — best for portrait" },
                ] as const).map(opt => (
                  <button key={opt.id} onClick={() => set("image_fit", opt.id)} style={{
                    flex: 1, padding: "9px 12px", borderRadius: 10, cursor: "pointer",
                    textAlign: "left" as const, transition: "all 0.15s",
                    background: form.image_fit === opt.id ? theme.accentLight : theme.bgInput,
                    border: `1px solid ${form.image_fit === opt.id ? theme.accent : theme.bgCardBorder}`,
                  }}>
                    <div style={{ fontWeight: 700, fontSize: "0.82rem", color: form.image_fit === opt.id ? theme.accent : theme.textPrimary }}>
                      {opt.emoji} {opt.label}
                    </div>
                    <div style={{ fontSize: "0.71rem", color: theme.textMuted, marginTop: 2 }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category */}
          <div style={{ marginBottom: 16 }}>
            {lbl("Category")}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {CATEGORIES.filter(c => c.id !== "all").map(cat => (
                <button key={cat.id} onClick={() => set("category", cat.id)} style={{
                  padding: "8px 6px", borderRadius: 10, fontSize: "0.75rem", fontWeight: 600,
                  cursor: "pointer", textAlign: "center" as const, transition: "all 0.15s",
                  background: form.category === cat.id ? theme.accentLight : theme.bgInput,
                  border: `1px solid ${form.category === cat.id ? theme.accent : theme.bgCardBorder}`,
                  color: form.category === cat.id ? theme.accent : theme.textMuted,
                }}>
                  <div style={{ fontSize: "1.1rem", marginBottom: 2 }}>{cat.emoji}</div>
                  {cat.label.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Size */}
          <div style={{ marginBottom: 16 }}>
            {lbl("Card Size")}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {SIZE_OPTIONS.map(s => (
                <button key={s.id} onClick={() => set("size", s.id)} style={{
                  padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                  textAlign: "left" as const, transition: "all 0.15s",
                  background: form.size === s.id ? theme.accentLight : theme.bgInput,
                  border: `1px solid ${form.size === s.id ? theme.accent : theme.bgCardBorder}`,
                }}>
                  <div style={{ fontWeight: 700, fontSize: "0.82rem", color: form.size === s.id ? theme.accent : theme.textPrimary }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: 2 }}>{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Accent color */}
          {!form.image_url && (
            <div style={{ marginBottom: 20 }}>
              {lbl("Card Color")}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {ACCENT_OPTIONS.map(color => (
                  <button key={color} onClick={() => set("accent_color", color)} style={{
                    width: 28, height: 28, borderRadius: "50%", background: color,
                    border: `3px solid ${form.accent_color === color ? "#fff" : "transparent"}`,
                    cursor: "pointer",
                    outline: form.accent_color === color ? `2px solid ${theme.accent}` : "none",
                    transition: "all 0.15s",
                  }} />
                ))}
              </div>
            </div>
          )}

          {/* Save */}
          <button
            onClick={() => { if (form.title.trim()) onSave(form as Omit<VisionItem, "id" | "sort_order">); }}
            disabled={!form.title.trim()}
            style={{
              width: "100%", padding: "12px", borderRadius: 12, border: "none",
              background: form.title.trim()
                ? "linear-gradient(135deg, #5090e0 0%, #7040d0 100%)"
                : theme.bgCardBorder,
              color: form.title.trim() ? "#fff" : theme.textMuted,
              fontWeight: 700, fontSize: "0.92rem",
              cursor: form.title.trim() ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <Check size={16} />
            {isEdit ? "Save Changes" : "Add to Board"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Focus / Full-screen modal ─────────────────────────────────────────────────
function FocusModal({ items, startIndex, onClose, onEdit }: {
  items: VisionItem[]; startIndex: number;
  onClose: () => void; onEdit: (item: VisionItem) => void;
}) {
  const [idx, setIdx]           = useState(startIndex);
  const [imgError, setImgError] = useState(false);
  const item = items[idx];

  useEffect(() => { setImgError(false); }, [idx]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape")                              onClose();
      if (e.key === "ArrowLeft"  && idx > 0)               setIdx(i => i - 1);
      if (e.key === "ArrowRight" && idx < items.length - 1) setIdx(i => i + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [idx, items.length, onClose]);

  if (!item) return null;
  const hasImage = item.image_url && !imgError;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.92)", backdropFilter: "blur(16px)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    }}>
      <button onClick={onClose} style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,0.12)", border: "none", borderRadius: "50%", padding: 10, cursor: "pointer", color: "#fff", lineHeight: 0 }}>
        <X size={20} />
      </button>
      <button onClick={() => { onEdit(item); onClose(); }} style={{ position: "absolute", top: 20, right: 68, background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer", color: "#fff", fontSize: "0.82rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
        <Edit2 size={14} /> Edit
      </button>
      {idx > 0 && (
        <button onClick={() => setIdx(i => i - 1)} style={{ position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 10, padding: 12, cursor: "pointer", color: "#fff", lineHeight: 0 }}>
          <ChevronLeft size={24} />
        </button>
      )}
      {idx < items.length - 1 && (
        <button onClick={() => setIdx(i => i + 1)} style={{ position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 10, padding: 12, cursor: "pointer", color: "#fff", lineHeight: 0 }}>
          <ChevronRight size={24} />
        </button>
      )}
      <div style={{ position: "relative", width: "min(700px, 90vw)", borderRadius: 20, overflow: "hidden" }}>
        <div style={{ height: 420, position: "relative" }}>
          {hasImage ? (
            <>
              {item.image_fit === "contain" && (
                <img src={item.image_url} aria-hidden draggable={false}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
                    objectFit: "cover", filter: "blur(28px)", transform: "scale(1.14)", opacity: 0.5 }} />
              )}
              <img src={item.image_url} alt={item.title} onError={() => setImgError(true)}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
                  objectFit: item.image_fit === "contain" ? "contain" : "cover" }} />
            </>
          ) : (
            <div style={{ width: "100%", height: "100%", background: CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.general }} />
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)" }} />
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "32px 32px 28px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", borderRadius: 20, padding: "3px 12px", marginBottom: 12, fontSize: "0.75rem", fontWeight: 600, color: "#fff" }}>
            {CATEGORIES.find(c => c.id === item.category)?.emoji}{" "}
            {CATEGORIES.find(c => c.id === item.category)?.label}
          </div>
          <h2 style={{ color: "#fff", fontWeight: 800, fontSize: "1.8rem", margin: "0 0 10px", textShadow: "0 2px 8px rgba(0,0,0,0.5)", lineHeight: 1.2 }}>
            {item.title}
          </h2>
          {item.description && (
            <p style={{ color: "rgba(255,255,255,0.88)", fontSize: "1rem", margin: 0, lineHeight: 1.6, textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>
              {item.description}
            </p>
          )}
        </div>
      </div>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem", marginTop: 16 }}>
        {idx + 1} / {items.length} · ← → to navigate · Esc to close
      </p>
    </div>
  );
}

// ── View Vision Modal (high-res canvas collage) ───────────────────────────────
function ViewVisionModal({ items, onClose }: { items: VisionItem[]; onClose: () => void }) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const [generating, setGenerating] = useState(true);

  const W = 1920;
  const H = 1080;

  useEffect(() => { void buildCanvas(); }, []);

  function loadImg(src: string): Promise<HTMLImageElement> {
    return new Promise((res, rej) => {
      const img = document.createElement("img") as HTMLImageElement;
      img.onload  = () => res(img);
      img.onerror = rej;
      img.src = src;
    });
  }

  function roundedClip(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);      ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.clip();
  }

  function drawTextTile(ctx: CanvasRenderingContext2D, item: VisionItem, x: number, y: number, w: number, h: number) {
    // Gradient background from accent color
    const color = item.accent_color || "#6366f1";
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, color);
    grad.addColorStop(1, color + "99");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    // Dark vignette overlay
    const vig = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.max(w, h) * 0.7);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = vig;
    ctx.fillRect(x, y, w, h);
    // Category emoji
    const cat = CATEGORIES.find(c => c.id === item.category);
    if (cat && cat.id !== "all") {
      ctx.font    = `${Math.max(12, Math.min(w * 0.18, h * 0.25))}px serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillText(cat.emoji, x + w / 2, y + h * 0.38);
    }
    // Title text with word wrap
    const fontSize = Math.max(11, Math.min(w / 7, h / 3.5, 36));
    ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const maxLineW = w * 0.84;
    const words = item.title.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxLineW && line) { lines.push(line); line = word; }
      else line = test;
    }
    lines.push(line);
    const lh = fontSize * 1.35;
    let ty = y + h / 2 - (lines.length * lh) / 2 + lh / 2;
    for (const l of lines) { ctx.fillText(l, x + w / 2, ty); ty += lh; }
  }

  async function buildCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width  = W;
    canvas.height = H;

    // Background
    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(0, 0, W, H);

    if (items.length === 0) { setGenerating(false); return; }

    const count        = items.length;
    const idealCols    = Math.max(2, Math.round(Math.sqrt(count * (W / H))));
    const targetAspect = W / H;

    // Pick cols that minimises last-row imbalance while keeping a landscape ratio
    let cols = idealCols;
    let bestScore = Infinity;
    for (let c = Math.max(2, idealCols - 1); c <= idealCols + 4; c++) {
      const r          = Math.ceil(count / c);
      const rem        = count % c;
      const imbalance  = rem === 0 ? 0 : c - rem;
      const aspectDiff = Math.abs((c / r) - targetAspect) * 2;
      const score      = imbalance + aspectDiff;
      if (score < bestScore) { bestScore = score; cols = c; }
    }

    const rows  = Math.ceil(count / cols);
    const gap   = 4;
    const rad   = 6;
    const cellW = (W - gap * (cols + 1)) / cols;
    const cellH = (H - gap * (rows + 1)) / rows;

    // Pad with repeated items so every cell is filled — no black gaps
    const grid = [...items];
    while (grid.length < cols * rows) grid.push(items[grid.length % items.length]);

    for (let i = 0; i < grid.length; i++) {
      const item = grid[i];
      const col  = i % cols;
      const row  = Math.floor(i / cols);
      const x    = gap + col * (cellW + gap);
      const y    = gap + row * (cellH + gap);

      ctx.save();
      roundedClip(ctx, x, y, cellW, cellH, rad);

      if (item.image_url) {
        try {
          const img   = await loadImg(item.image_url);
          const scale = Math.max(cellW / img.width, cellH / img.height);
          const sw    = img.width  * scale;
          const sh    = img.height * scale;
          ctx.drawImage(img, x + (cellW - sw) / 2, y + (cellH - sh) / 2, sw, sh);
        } catch {
          drawTextTile(ctx, item, x, y, cellW, cellH);
        }
      } else {
        drawTextTile(ctx, item, x, y, cellW, cellH);
      }

      ctx.restore();
    }

    setGenerating(false);
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/jpeg", 0.93);
    const a   = document.createElement("a");
    a.href     = url;
    a.download = "my-vision-board.jpg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.97)",
      display: "flex", flexDirection: "column", zIndex: 9999,
    }}>
      {/* Header bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "1.3rem" }}>✨</span>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: "1rem", letterSpacing: "0.02em" }}>
            My Vision Board
          </span>
          {!generating && (
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.78rem", marginLeft: 6 }}>
              1920 × 1080 HD
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {!generating && (
            <button
              onClick={download}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "8px 20px", borderRadius: 10,
                background: "linear-gradient(135deg, #5090e0 0%, #7040d0 100%)",
                color: "#fff", border: "none", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
              }}
            >
              <Download size={14} /> Download HD
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)", background: "transparent",
              color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: "0.85rem",
            }}
          >
            <X size={14} /> Close
          </button>
        </div>
      </div>

      {/* Canvas / generating state */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, overflow: "hidden",
      }}>
        {generating && (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
            <div style={{ fontSize: "3rem", marginBottom: 16, animation: "pulse 1.5s infinite" }}>✨</div>
            <div style={{ fontWeight: 600, fontSize: "1rem" }}>Generating your vision board…</div>
            <div style={{ fontSize: "0.82rem", marginTop: 6 }}>Compositing {items.length} visions into HD</div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{
            maxWidth: "100%", maxHeight: "100%",
            borderRadius: 10,
            display: generating ? "none" : "block",
            boxShadow: "0 0 80px rgba(80,144,224,0.2)",
          }}
        />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function VisionBoardPage() {
  const { theme } = useThemeStore();

  const [items, setItems]                   = useState<VisionItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [showModal, setShowModal]           = useState(false);
  const [editItem, setEditItem]             = useState<VisionItem | null>(null);
  const [focusIndex, setFocusIndex]         = useState<number | null>(null);
  const [loading, setLoading]               = useState(true);

  // ── New state ──
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [showSlideshow, setShowSlideshow]     = useState(false);
  const [showViewVision, setShowViewVision]   = useState(false);

  // ── Pointer-based reorder (replaces HTML5 drag API) ──
  const [draggingId, setDraggingId]           = useState<number | null>(null);
  const [dragOverId, setDragOverId]           = useState<number | null>(null);
  const draggingIdRef                         = useRef<number | null>(null);
  const dragOverIdRef                         = useRef<number | null>(null);

  useEffect(() => { loadItems(); }, []);

  async function loadItems() {
    try {
      const db   = await getDb();
      const rows = await db.select<VisionItem[]>(
        "SELECT * FROM vision_board_items ORDER BY sort_order ASC, created_at ASC"
      );
      setItems(rows);
    } catch (e) {
      console.error("loadItems error:", e);
    } finally {
      setLoading(false);
    }
  }

  async function saveItem(data: Omit<VisionItem, "id" | "sort_order">) {
    try {
      const db  = await getDb();
      const now = new Date().toISOString().replace("T", " ").slice(0, 19);
      if (editItem?.id) {
        await db.execute(
          `UPDATE vision_board_items SET title=?,description=?,image_url=?,category=?,size=?,accent_color=?,image_fit=?,text_font=?,updated_at=? WHERE id=?`,
          [data.title, data.description, data.image_url, data.category, data.size, data.accent_color, data.image_fit, data.text_font, now, editItem.id]
        );
      } else {
        const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 1 : 0;
        await db.execute(
          `INSERT INTO vision_board_items (title,description,image_url,category,size,sort_order,accent_color,image_fit,text_font,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [data.title, data.description, data.image_url, data.category, data.size, maxOrder, data.accent_color, data.image_fit, data.text_font, now]
        );
      }
      await loadItems();
    } catch (e) {
      console.error("saveItem error:", e);
    } finally {
      setShowModal(false);
      setEditItem(null);
    }
  }

  async function deleteItem(id: number) {
    try {
      const db = await getDb();
      await db.execute("DELETE FROM vision_board_items WHERE id=?", [id]);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e) {
      console.error("deleteItem error:", e);
    } finally {
      setDeleteConfirmId(null);
    }
  }

  async function reorderItems(draggedId: number, targetId: number) {
    if (draggedId === targetId) return;
    const draggedItem = items.find(i => i.id === draggedId);
    const targetItem  = items.find(i => i.id === targetId);
    if (!draggedItem || !targetItem) return;

    // Remove dragged item, insert before target
    const without    = items.filter(i => i.id !== draggedId);
    const targetIdx  = without.findIndex(i => i.id === targetId);
    without.splice(targetIdx, 0, draggedItem);

    // Reassign sort_orders
    const updated = without.map((item, idx) => ({ ...item, sort_order: idx }));
    setItems(updated);

    try {
      const db = await getDb();
      for (const item of updated) {
        await db.execute(
          "UPDATE vision_board_items SET sort_order=? WHERE id=?",
          [item.sort_order, item.id]
        );
      }
    } catch (e) {
      console.error("reorderItems error:", e);
    }
  }

  // ── Mouse-based reorder handler ──────────────────────────────────────────────
  // Called when the user presses down on a card's grip handle.
  // Attaches document-level mousemove + mouseup listeners and uses
  // elementFromPoint to find the card currently under the cursor.
  function handleGripPointerDown(itemId: number) {
    draggingIdRef.current = itemId;
    dragOverIdRef.current = null;
    setDraggingId(itemId);
    setDragOverId(null);

    // Prevent text selection & context menus while dragging
    document.body.style.userSelect  = "none";
    document.body.style.cursor      = "grabbing";

    function handleMove(e: MouseEvent) {
      // Walk up from element at cursor to find a card div
      const el   = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const card = el?.closest("[data-vision-id]") as HTMLElement | null;
      const overId = card ? parseInt(card.dataset.visionId ?? "", 10) : null;
      const resolved = (overId !== null && !isNaN(overId) && overId !== draggingIdRef.current)
        ? overId : null;
      if (resolved !== dragOverIdRef.current) {
        dragOverIdRef.current = resolved;
        setDragOverId(resolved);
      }
    }

    function handleUp() {
      document.body.style.userSelect = "";
      document.body.style.cursor     = "";
      document.removeEventListener("mousemove", handleMove, true);
      document.removeEventListener("mouseup",   handleUp,   true);

      // Only reorder if we have a valid target different from source
      if (draggingIdRef.current !== null && dragOverIdRef.current !== null) {
        reorderItems(draggingIdRef.current, dragOverIdRef.current);
      }
      draggingIdRef.current = null;
      dragOverIdRef.current = null;
      setDraggingId(null);
      setDragOverId(null);
    }

    document.addEventListener("mousemove", handleMove, true);
    document.addEventListener("mouseup",   handleUp,   true);
  }

  const filtered     = activeCategory === "all" ? items : items.filter(i => i.category === activeCategory);
  const deleteTarget = deleteConfirmId !== null ? items.find(i => i.id === deleteConfirmId) : null;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: theme.textPrimary, fontSize: 26, fontWeight: 700, margin: 0 }}>Vision Board</h1>
          <p style={{ color: theme.textMuted, margin: "4px 0 0", fontSize: 14 }}>
            Visualize your dreams · {items.length} vision{items.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Slideshow button — only when there are items */}
          {items.length > 0 && (
            <button
              onClick={() => setShowSlideshow(true)}
              title="Daily Meditation Slideshow"
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "10px 18px", borderRadius: 12,
                background: theme.bgCard,
                border: `1px solid ${theme.bgCardBorder}`,
                color: theme.textSecondary, fontWeight: 600,
                fontSize: "0.88rem", cursor: "pointer",
                transition: "all 0.18s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = theme.accent;
                (e.currentTarget as HTMLButtonElement).style.color = theme.accent;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = theme.bgCardBorder;
                (e.currentTarget as HTMLButtonElement).style.color = theme.textSecondary;
              }}
            >
              <Play size={15} /> Slideshow
            </button>
          )}
          {/* View Vision button — generates HD collage */}
          {items.length > 0 && (
            <button
              onClick={() => setShowViewVision(true)}
              title="View Vision Board as HD image"
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "10px 18px", borderRadius: 12,
                background: theme.bgCard,
                border: `1px solid ${theme.bgCardBorder}`,
                color: theme.textSecondary, fontWeight: 600,
                fontSize: "0.88rem", cursor: "pointer",
                transition: "all 0.18s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = theme.accent;
                (e.currentTarget as HTMLButtonElement).style.color = theme.accent;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = theme.bgCardBorder;
                (e.currentTarget as HTMLButtonElement).style.color = theme.textSecondary;
              }}
            >
              <Eye size={15} /> View Vision
            </button>
          )}
          <button
            onClick={() => { setEditItem(null); setShowModal(true); }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 20px", borderRadius: 12,
              background: "linear-gradient(135deg, #5090e0 0%, #7040d0 100%)",
              color: "#fff", border: "none", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer",
              boxShadow: "0 4px 16px rgba(80,144,224,0.35)",
            }}
          >
            <Plus size={17} /> Add Vision
          </button>
        </div>
      </div>

      {/* ── Category tabs ── */}
      {items.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {CATEGORIES.map(cat => {
            const count = cat.id === "all" ? items.length : items.filter(i => i.category === cat.id).length;
            if (count === 0 && cat.id !== "all") return null;
            const active = activeCategory === cat.id;
            return (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                borderRadius: 20, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", transition: "all 0.18s",
                background: active ? theme.accent : theme.bgCard,
                border: `1px solid ${active ? theme.accent : theme.bgCardBorder}`,
                color: active ? "#fff" : theme.textMuted,
              }}>
                <span>{cat.emoji}</span>
                {cat.label.split(" ")[0]}
                <span style={{
                  background: active ? "rgba(255,255,255,0.25)" : theme.bgCardBorder,
                  color: active ? "#fff" : theme.textMuted,
                  borderRadius: 10, padding: "1px 7px", fontSize: "0.7rem",
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Board ── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: theme.textMuted }}>Loading…</div>
      ) : items.length === 0 ? (
        <EmptyState theme={theme} onAdd={() => setShowModal(true)} />
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <p style={{ color: theme.textMuted, fontSize: "0.9rem" }}>No visions in this category yet.</p>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 14, gridAutoRows: "220px",
        }}>
          {filtered.map((item, i) => (
            <VisionCard
              key={item.id}
              item={item}
              onEdit={() => { setEditItem(item); setShowModal(true); }}
              onDelete={() => setDeleteConfirmId(item.id)}
              onFocus={() => setFocusIndex(i)}
              isDragOver={dragOverId === item.id}
              isDragging={draggingId === item.id}
              onGripPointerDown={() => handleGripPointerDown(item.id)}
            />
          ))}

          {/* Add card */}
          <button
            onClick={() => { setEditItem(null); setShowModal(true); }}
            style={{
              borderRadius: 16, border: `2px dashed ${theme.bgCardBorder}`, background: "transparent",
              cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 10, color: theme.textMuted, transition: "all 0.18s", minHeight: 200,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = theme.accent;
              (e.currentTarget as HTMLButtonElement).style.color = theme.accent;
              (e.currentTarget as HTMLButtonElement).style.background = theme.accentLight;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = theme.bgCardBorder;
              (e.currentTarget as HTMLButtonElement).style.color = theme.textMuted;
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            <Image size={28} />
            <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>Add Vision</span>
          </button>
        </div>
      )}

      {/* ── Modals ── */}
      {showModal && (
        <ItemModal item={editItem} theme={theme} onSave={saveItem}
          onClose={() => { setShowModal(false); setEditItem(null); }} />
      )}

      {focusIndex !== null && (
        <FocusModal items={filtered} startIndex={focusIndex}
          onClose={() => setFocusIndex(null)}
          onEdit={(item) => { setEditItem(item); setShowModal(true); }} />
      )}

      {/* Delete confirmation */}
      {deleteConfirmId !== null && deleteTarget && (
        <DeleteConfirmModal
          itemTitle={deleteTarget.title}
          theme={theme}
          onConfirm={() => deleteItem(deleteConfirmId)}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}

      {/* Slideshow / Daily Meditation */}
      {showSlideshow && (
        <SlideshowModal
          items={filtered.length > 0 ? filtered : items}
          onClose={() => setShowSlideshow(false)}
        />
      )}

      {/* View Vision — HD canvas collage */}
      {showViewVision && (
        <ViewVisionModal
          items={items}
          onClose={() => setShowViewVision(false)}
        />
      )}
    </div>
  );
}
