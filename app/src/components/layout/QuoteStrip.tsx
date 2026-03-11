import { useEffect, useState } from "react";
import { Quote, Star } from "lucide-react";
import { getDb } from "../../db/database";
import { useThemeStore } from "../../store/themeStore";
import { useAppStore } from "../../store/appStore";

interface QuoteRow {
  id: number;
  text: string;
  author: string;
  source: "quote" | "affirmation";
}

export default function QuoteStrip() {
  const [quote, setQuote] = useState<QuoteRow | null>(null);
  const [_loadError, setLoadError] = useState<string | null>(null);
  const { theme } = useThemeStore();
  const { todayPoints } = useAppStore();

  useEffect(() => {
    loadRandomQuote();
    // Auto-rotate every hour
    const interval = setInterval(loadRandomQuote, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function loadRandomQuote() {
    try {
      setLoadError(null);
      const db = await getDb();
      // Wrap UNION ALL in subquery so ORDER BY RANDOM() works correctly
      const results = await db.select<QuoteRow[]>(`
        SELECT * FROM (
          SELECT id, text, author, 'quote' AS source FROM quotes WHERE is_active IS NOT 0
          UNION ALL
          SELECT id, text, author, 'affirmation' AS source FROM affirmations WHERE is_active IS NOT 0
        ) ORDER BY RANDOM() LIMIT 1
      `);
      if (results.length > 0) {
        setQuote(results[0]);
      } else {
        setLoadError("no rows");
      }
    } catch (e) {
      console.error("Failed to load quote", e);
      setLoadError(String(e));
    }
  }

  // Always render the strip — show a fallback message if quote hasn't loaded
  const quoteText = quote?.text ?? "Your journey shapes your destiny…";
  const quoteAuthor = quote?.author ?? null;

  return (
    <div
      className="flex items-center gap-3 flex-shrink-0"
      style={{
        background: theme.quoteBg,
        borderBottom: `1px solid ${theme.quoteBorder}`,
        minHeight: 44,
        padding: "0 20px 0 16px",
        transition: "background 0.4s ease, border-color 0.4s ease",
      }}
    >
      <Quote size={13} style={{ color: theme.quoteAccent, flexShrink: 0, opacity: 0.5 }} />
      <p
        className="flex-1 italic truncate min-w-0"
        style={{ color: theme.textSecondary, fontSize: "0.86rem", margin: 0 }}
        title={`${quoteText}${quoteAuthor ? ` — ${quoteAuthor}` : ""}`}
      >
        "{quoteText}"
        {quoteAuthor && (
          <span style={{ color: theme.quoteAccent, fontStyle: "normal", fontWeight: 600 }}>
            {" "}— {quoteAuthor}
          </span>
        )}
      </p>

      {/* Points pill */}
      <div
        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full"
        style={{
          background: theme.sidebarPointsBg,
          border: `1px solid ${theme.sidebarPointsBorder}`,
          whiteSpace: "nowrap",
        }}
      >
        <Star size={11} color={theme.accent} fill={theme.accent} />
        <span style={{ color: theme.textPrimary, fontSize: "0.72rem", fontWeight: 600 }}>
          {todayPoints} pts
        </span>
      </div>

      {/* New quote button */}
      <button
        onClick={loadRandomQuote}
        className="flex-shrink-0 px-3 py-1 rounded-full"
        style={{
          color: theme.quoteAccent,
          border: `1px solid ${theme.quoteBorder}`,
          fontSize: "0.7rem",
          background: "transparent",
          transition: "background 0.15s, border-color 0.15s",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = theme.accentLight;
          (e.currentTarget as HTMLButtonElement).style.borderColor = theme.accent;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          (e.currentTarget as HTMLButtonElement).style.borderColor = theme.quoteBorder;
        }}
      >
        ↻ New
      </button>
    </div>
  );
}
