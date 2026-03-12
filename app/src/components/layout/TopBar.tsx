import { useEffect, useState } from "react";
import { Home, Quote, Settings, User } from "lucide-react";
import { getDb } from "../../db/database";
import { useThemeStore } from "../../store/themeStore";
import { useAppStore } from "../../store/appStore";
import logoTransparent from "../../assets/logo-transparent.png";

interface QuoteRow {
  id: number;
  text: string;
  author: string;
  source: "quote" | "affirmation";
}

export default function TopBar() {
  const { theme } = useThemeStore();
  const { currentPage, setCurrentPage } = useAppStore();
  const [quote, setQuote] = useState<QuoteRow | null>(null);

  useEffect(() => {
    loadRandomQuote();
    const interval = setInterval(loadRandomQuote, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function loadRandomQuote() {
    try {
      const db = await getDb();
      const results = await db.select<QuoteRow[]>(`
        SELECT * FROM (
          SELECT id, text, author, 'quote' AS source FROM quotes WHERE is_active IS NOT 0
          UNION ALL
          SELECT id, text, author, 'affirmation' AS source FROM affirmations WHERE is_active IS NOT 0
        ) ORDER BY RANDOM() LIMIT 1
      `);
      if (results.length > 0) setQuote(results[0]);
    } catch { /* silent */ }
  }

  const quoteText   = quote?.text ?? "Your journey shapes your destiny…";
  const quoteAuthor = quote?.author ?? null;

  const iconBtn = (active: boolean, accent?: string) => ({
    background: active ? (accent ? `${accent}22` : theme.accentLight) : "transparent",
    border: `1px solid ${active ? (accent ?? theme.accent) : "transparent"}`,
    borderRadius: 8,
    padding: "5px 8px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 4,
    color: active ? (accent ?? theme.accent) : theme.textMuted,
    transition: "all 0.15s",
    outline: "none",
    flexShrink: 0 as const,
  });

  return (
    <div style={{
      height: 44,
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "0 14px 0 10px",
      background: theme.quoteBg,
      borderBottom: `1px solid ${theme.quoteBorder}`,
      flexShrink: 0,
      zIndex: 50,
      transition: "background 0.4s ease",
    }}>

      {/* Logo — anchored above the wizard column */}
      <div style={{
        width: 76,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <img
          src={logoTransparent}
          alt="AscendOne"
          style={{ height: 28, objectFit: "contain", display: "block" }}
        />
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 22, background: theme.bgCardBorder, flexShrink: 0 }} />

      {/* Home button */}
      <button
        onClick={() => setCurrentPage("dashboard")}
        style={iconBtn(currentPage === "dashboard")}
        title="Home — Dashboard"
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = theme.accentLight; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = currentPage === "dashboard" ? theme.accentLight : "transparent"; }}
      >
        <Home size={16} />
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 22, background: theme.bgCardBorder, flexShrink: 0 }} />

      {/* Quote strip — takes all remaining space */}
      <Quote size={12} style={{ color: theme.quoteAccent, flexShrink: 0, opacity: 0.5 }} />
      <p
        style={{
          flex: 1, minWidth: 0,
          color: theme.textSecondary,
          fontSize: "0.84rem",
          fontStyle: "italic",
          margin: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          cursor: "default",
        }}
        title={`${quoteText}${quoteAuthor ? ` — ${quoteAuthor}` : ""}`}
      >
        "{quoteText}"
        {quoteAuthor && (
          <span style={{ color: theme.quoteAccent, fontStyle: "normal", fontWeight: 600 }}>
            {" "}— {quoteAuthor}
          </span>
        )}
      </p>

      {/* New quote button */}
      <button
        onClick={loadRandomQuote}
        style={{ ...iconBtn(false), fontSize: 11, padding: "4px 8px", borderColor: theme.bgCardBorder }}
        title="New quote"
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = theme.accentLight; (e.currentTarget as HTMLButtonElement).style.borderColor = theme.accent; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.borderColor = theme.bgCardBorder; }}
      >
        ↻
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 22, background: theme.bgCardBorder, flexShrink: 0 }} />

      {/* Profile */}
      <button
        onClick={() => setCurrentPage("profile")}
        style={iconBtn(currentPage === "profile")}
        title="Profile"
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = theme.accentLight; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = currentPage === "profile" ? theme.accentLight : "transparent"; }}
      >
        <User size={15} />
      </button>

      {/* Settings */}
      <button
        onClick={() => setCurrentPage("settings")}
        style={iconBtn(currentPage === "settings")}
        title="Settings"
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = theme.accentLight; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = currentPage === "settings" ? theme.accentLight : "transparent"; }}
      >
        <Settings size={15} />
      </button>
    </div>
  );
}
