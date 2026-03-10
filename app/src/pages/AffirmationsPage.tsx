import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, X, Check, Quote, Sparkles } from "lucide-react";
import { useThemeStore } from "../store/themeStore";
import { getDb } from "../db/database";

type Tab = "quotes" | "affirmations";

interface QuoteRow {
  id: number;
  text: string;
  author: string | null;
  is_custom: number;
  is_active: number;
}

interface AffirmRow {
  id: number;
  text: string;
  is_custom: number;
  is_active: number;
}

export default function AffirmationsPage() {
  const { theme } = useThemeStore();
  const [tab, setTab] = useState<Tab>("affirmations");

  // ── Quotes state ────────────────────────────────────────────────────────────
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [editQuote, setEditQuote] = useState<QuoteRow | null>(null);
  const [qText, setQText] = useState("");
  const [qAuthor, setQAuthor] = useState("");

  // ── Affirmations state ──────────────────────────────────────────────────────
  const [affirmations, setAffirmations] = useState<AffirmRow[]>([]);
  const [showAffirmModal, setShowAffirmModal] = useState(false);
  const [editAffirm, setEditAffirm] = useState<AffirmRow | null>(null);
  const [aText, setAText] = useState("");
  const [featuredIdx, setFeaturedIdx] = useState(0);

  // ── Load ────────────────────────────────────────────────────────────────────
  const loadQuotes = useCallback(async () => {
    const db = await getDb();
    const rows = await db.select<QuoteRow[]>(
      "SELECT id, text, author, is_custom, is_active FROM quotes ORDER BY is_custom ASC, id ASC"
    );
    setQuotes(rows);
  }, []);

  const loadAffirmations = useCallback(async () => {
    const db = await getDb();
    const rows = await db.select<AffirmRow[]>(
      "SELECT id, text, is_custom, is_active FROM affirmations ORDER BY is_custom ASC, id ASC"
    );
    setAffirmations(rows);
  }, []);

  useEffect(() => { loadQuotes(); loadAffirmations(); }, [loadQuotes, loadAffirmations]);

  // ── Quotes CRUD ─────────────────────────────────────────────────────────────
  const saveQuote = async () => {
    if (!qText.trim()) return;
    const db = await getDb();
    if (editQuote) {
      await db.execute(
        "UPDATE quotes SET text = ?, author = ? WHERE id = ?",
        [qText.trim(), qAuthor.trim() || null, editQuote.id]
      );
    } else {
      await db.execute(
        "INSERT INTO quotes (text, author, is_custom, is_active) VALUES (?, ?, 1, 1)",
        [qText.trim(), qAuthor.trim() || null]
      );
    }
    setShowQuoteModal(false);
    setQText(""); setQAuthor(""); setEditQuote(null);
    loadQuotes();
  };

  const toggleQuote = async (q: QuoteRow) => {
    const db = await getDb();
    await db.execute("UPDATE quotes SET is_active = ? WHERE id = ?", [q.is_active ? 0 : 1, q.id]);
    loadQuotes();
  };

  const deleteQuote = async (id: number) => {
    const db = await getDb();
    await db.execute("DELETE FROM quotes WHERE id = ?", [id]);
    loadQuotes();
  };

  const openEditQuote = (q: QuoteRow) => {
    setEditQuote(q);
    setQText(q.text);
    setQAuthor(q.author ?? "");
    setShowQuoteModal(true);
  };

  const openNewQuote = () => {
    setEditQuote(null);
    setQText(""); setQAuthor("");
    setShowQuoteModal(true);
  };

  // ── Affirmations CRUD ───────────────────────────────────────────────────────
  const saveAffirmation = async () => {
    if (!aText.trim()) return;
    const db = await getDb();
    if (editAffirm) {
      await db.execute("UPDATE affirmations SET text = ? WHERE id = ?", [aText.trim(), editAffirm.id]);
    } else {
      await db.execute(
        "INSERT INTO affirmations (text, is_custom, is_active) VALUES (?, 1, 1)",
        [aText.trim()]
      );
    }
    setShowAffirmModal(false);
    setAText(""); setEditAffirm(null);
    loadAffirmations();
  };

  const toggleAffirmation = async (a: AffirmRow) => {
    const db = await getDb();
    await db.execute("UPDATE affirmations SET is_active = ? WHERE id = ?", [a.is_active ? 0 : 1, a.id]);
    loadAffirmations();
  };

  const deleteAffirmation = async (id: number) => {
    const db = await getDb();
    await db.execute("DELETE FROM affirmations WHERE id = ?", [id]);
    loadAffirmations();
  };

  const openEditAffirm = (a: AffirmRow) => {
    setEditAffirm(a);
    setAText(a.text);
    setShowAffirmModal(true);
  };

  const openNewAffirm = () => {
    setEditAffirm(null);
    setAText("");
    setShowAffirmModal(true);
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const activeAffirms = affirmations.filter((a) => a.is_active === 1);
  const featured = activeAffirms[featuredIdx % Math.max(activeAffirms.length, 1)];

  const activeQuoteCount = quotes.filter((q) => q.is_active).length;
  const activeAffirmCount = activeAffirms.length;

  // ── Shared styles ────────────────────────────────────────────────────────────
  const cardStyle = (active: boolean) => ({
    background: theme.bgCard,
    borderRadius: 12,
    border: `1px solid ${theme.bgCardBorder}`,
    padding: "14px 16px",
    display: "flex",
    alignItems: "center" as const,
    gap: 12,
    opacity: active ? 1 : 0.45,
    transition: "opacity 0.2s",
  });

  return (
    <div style={{ background: theme.bgPrimary, minHeight: "100vh", padding: "24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ color: theme.textPrimary, fontSize: 28, fontWeight: 700, margin: 0 }}>
              Quotes &amp; Affirmations
            </h1>
            <p style={{ color: theme.textMuted, margin: "4px 0 0", fontSize: "0.88rem" }}>
              {activeQuoteCount} active quotes · {activeAffirmCount} active affirmations — all mix into the quote strip
            </p>
          </div>
          <button
            onClick={tab === "quotes" ? openNewQuote : openNewAffirm}
            style={{
              background: theme.accent,
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "10px 18px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.88rem",
              flexShrink: 0,
            }}
          >
            <Plus size={16} />
            Add {tab === "quotes" ? "Quote" : "Affirmation"}
          </button>
        </div>

        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            gap: 4,
            background: theme.bgCard,
            border: `1px solid ${theme.bgCardBorder}`,
            borderRadius: 12,
            padding: 4,
            marginBottom: 20,
            width: "fit-content",
          }}
        >
          {(["affirmations", "quotes"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: tab === t ? theme.accent : "transparent",
                color: tab === t ? "#fff" : theme.textSecondary,
                border: "none",
                borderRadius: 9,
                padding: "8px 20px",
                cursor: "pointer",
                fontWeight: tab === t ? 700 : 400,
                fontSize: "0.84rem",
                display: "flex",
                alignItems: "center",
                gap: 7,
                transition: "all 0.15s",
              }}
            >
              {t === "affirmations" ? <Sparkles size={14} /> : <Quote size={14} />}
              {t === "affirmations" ? "Affirmations" : "Quotes"}
            </button>
          ))}
        </div>

        {/* ── AFFIRMATIONS TAB ─────────────────────────────────────────────── */}
        {tab === "affirmations" && (
          <>
            {/* Featured carousel */}
            {featured && (
              <div
                style={{
                  background: theme.accentGradient,
                  borderRadius: 20,
                  padding: "32px 28px",
                  marginBottom: 20,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 12 }}>💫</div>
                <p
                  style={{
                    color: "#fff",
                    fontSize: 20,
                    fontWeight: 700,
                    lineHeight: 1.5,
                    margin: "0 0 20px",
                  }}
                >
                  {featured.text}
                </p>
                {activeAffirms.length > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                    {activeAffirms.map((_, i) => (
                      <div
                        key={i}
                        onClick={() => setFeaturedIdx(i)}
                        style={{
                          width: i === featuredIdx ? 24 : 8,
                          height: 8,
                          borderRadius: 4,
                          background:
                            i === featuredIdx ? "#fff" : "rgba(255,255,255,0.35)",
                          cursor: "pointer",
                          transition: "width 0.2s, background 0.2s",
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {affirmations.map((a) => (
                <div key={a.id} style={cardStyle(a.is_active === 1)}>
                  {/* Active toggle */}
                  <button
                    onClick={() => toggleAffirmation(a)}
                    title={a.is_active ? "Disable" : "Enable"}
                    style={{
                      background: a.is_active ? "#10b98118" : theme.iconBg,
                      color: a.is_active ? "#10b981" : theme.textMuted,
                      border: "none",
                      borderRadius: 8,
                      width: 32,
                      height: 32,
                      cursor: "pointer",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {a.is_active ? <Check size={15} /> : <div style={{ width: 15, height: 15 }} />}
                  </button>

                  <span style={{ flex: 1, color: theme.textPrimary, fontSize: "0.9rem", lineHeight: 1.5 }}>
                    {a.text}
                  </span>

                  {/* Custom badge */}
                  {!a.is_custom && (
                    <span
                      style={{
                        fontSize: "0.68rem",
                        color: theme.textMuted,
                        background: theme.iconBg,
                        borderRadius: 6,
                        padding: "2px 7px",
                        flexShrink: 0,
                      }}
                    >
                      default
                    </span>
                  )}

                  <button
                    onClick={() => openEditAffirm(a)}
                    style={{
                      background: theme.iconBg,
                      color: theme.textSecondary,
                      border: "none",
                      borderRadius: 8,
                      padding: "6px 8px",
                      cursor: "pointer",
                    }}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => deleteAffirmation(a.id)}
                    style={{
                      background: "#ef444415",
                      color: "#ef4444",
                      border: "none",
                      borderRadius: 8,
                      padding: "6px 8px",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {affirmations.length === 0 && (
                <div style={{ textAlign: "center", color: theme.textMuted, padding: "40px 0", fontSize: "0.9rem" }}>
                  No affirmations yet. Add your first one!
                </div>
              )}
            </div>
          </>
        )}

        {/* ── QUOTES TAB ───────────────────────────────────────────────────── */}
        {tab === "quotes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {quotes.map((q) => (
              <div key={q.id} style={cardStyle(q.is_active === 1)}>
                {/* Active toggle */}
                <button
                  onClick={() => toggleQuote(q)}
                  title={q.is_active ? "Disable" : "Enable"}
                  style={{
                    background: q.is_active ? "#10b98118" : theme.iconBg,
                    color: q.is_active ? "#10b981" : theme.textMuted,
                    border: "none",
                    borderRadius: 8,
                    width: 32,
                    height: 32,
                    cursor: "pointer",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {q.is_active ? <Check size={15} /> : <div style={{ width: 15, height: 15 }} />}
                </button>

                {/* Text + author */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: theme.textPrimary, fontSize: "0.9rem", margin: 0, lineHeight: 1.5 }}>
                    "{q.text}"
                  </p>
                  {q.author && (
                    <p style={{ color: theme.textMuted, fontSize: "0.78rem", margin: "3px 0 0", fontStyle: "italic" }}>
                      — {q.author}
                    </p>
                  )}
                </div>

                {/* Custom badge */}
                {!q.is_custom && (
                  <span
                    style={{
                      fontSize: "0.68rem",
                      color: theme.textMuted,
                      background: theme.iconBg,
                      borderRadius: 6,
                      padding: "2px 7px",
                      flexShrink: 0,
                    }}
                  >
                    default
                  </span>
                )}

                <button
                  onClick={() => openEditQuote(q)}
                  style={{
                    background: theme.iconBg,
                    color: theme.textSecondary,
                    border: "none",
                    borderRadius: 8,
                    padding: "6px 8px",
                    cursor: "pointer",
                  }}
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => deleteQuote(q.id)}
                  style={{
                    background: "#ef444415",
                    color: "#ef4444",
                    border: "none",
                    borderRadius: 8,
                    padding: "6px 8px",
                    cursor: "pointer",
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {quotes.length === 0 && (
              <div style={{ textAlign: "center", color: theme.textMuted, padding: "40px 0", fontSize: "0.9rem" }}>
                No quotes yet. Add your first one!
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── QUOTE MODAL ────────────────────────────────────────────────────── */}
      {showQuoteModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: theme.bgCard,
              borderRadius: 20,
              padding: 28,
              width: "100%",
              maxWidth: 500,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ color: theme.textPrimary, margin: 0, fontSize: 20, fontWeight: 700 }}>
                {editQuote ? "Edit Quote" : "Add Quote"}
              </h2>
              <button
                onClick={() => setShowQuoteModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: theme.textMuted }}
              >
                <X size={20} />
              </button>
            </div>
            <textarea
              value={qText}
              onChange={(e) => setQText(e.currentTarget.value)}
              placeholder="Enter the quote..."
              rows={4}
              style={{
                width: "100%",
                background: theme.bgInput,
                border: `1px solid ${theme.bgCardBorder}`,
                borderRadius: 10,
                padding: "12px 14px",
                color: theme.textPrimary,
                fontSize: "0.9rem",
                resize: "vertical",
                boxSizing: "border-box",
                marginBottom: 12,
              }}
            />
            <input
              value={qAuthor}
              onChange={(e) => setQAuthor(e.currentTarget.value)}
              placeholder="Author (optional)"
              style={{
                width: "100%",
                background: theme.bgInput,
                border: `1px solid ${theme.bgCardBorder}`,
                borderRadius: 10,
                padding: "11px 14px",
                color: theme.textPrimary,
                fontSize: "0.9rem",
                boxSizing: "border-box",
                marginBottom: 20,
                outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowQuoteModal(false)}
                style={{
                  flex: 1,
                  background: theme.bgInput,
                  color: theme.textSecondary,
                  border: "none",
                  borderRadius: 10,
                  padding: "12px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveQuote}
                style={{
                  flex: 2,
                  background: theme.accent,
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "12px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AFFIRMATION MODAL ──────────────────────────────────────────────── */}
      {showAffirmModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: theme.bgCard,
              borderRadius: 20,
              padding: 28,
              width: "100%",
              maxWidth: 480,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ color: theme.textPrimary, margin: 0, fontSize: 20, fontWeight: 700 }}>
                {editAffirm ? "Edit Affirmation" : "Add Affirmation"}
              </h2>
              <button
                onClick={() => setShowAffirmModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: theme.textMuted }}
              >
                <X size={20} />
              </button>
            </div>
            <textarea
              value={aText}
              onChange={(e) => setAText(e.currentTarget.value)}
              placeholder="Write your affirmation in the present tense... e.g. I am confident and successful."
              rows={4}
              style={{
                width: "100%",
                background: theme.bgInput,
                border: `1px solid ${theme.bgCardBorder}`,
                borderRadius: 10,
                padding: "12px 14px",
                color: theme.textPrimary,
                fontSize: "0.9rem",
                resize: "vertical",
                boxSizing: "border-box",
                marginBottom: 20,
              }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowAffirmModal(false)}
                style={{
                  flex: 1,
                  background: theme.bgInput,
                  color: theme.textSecondary,
                  border: "none",
                  borderRadius: 10,
                  padding: "12px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveAffirmation}
                style={{
                  flex: 2,
                  background: theme.accent,
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "12px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
