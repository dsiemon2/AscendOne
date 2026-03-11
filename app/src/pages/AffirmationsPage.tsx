import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, X, Check, Quote, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [featuredQuoteIdx, setFeaturedQuoteIdx] = useState(0);

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
    setEditQuote(q); setQText(q.text); setQAuthor(q.author ?? "");
    setShowQuoteModal(true);
  };

  const openNewQuote = () => {
    setEditQuote(null); setQText(""); setQAuthor("");
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
    setEditAffirm(a); setAText(a.text);
    setShowAffirmModal(true);
  };

  const openNewAffirm = () => {
    setEditAffirm(null); setAText("");
    setShowAffirmModal(true);
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const activeAffirms  = affirmations.filter((a) => a.is_active === 1);
  const activeQuotes   = quotes.filter((q) => q.is_active === 1);
  const featuredAffirm = activeAffirms[featuredIdx % Math.max(activeAffirms.length, 1)];
  const featuredQuote  = activeQuotes[featuredQuoteIdx % Math.max(activeQuotes.length, 1)];

  const activeQuoteCount  = activeQuotes.length;
  const activeAffirmCount = activeAffirms.length;

  // ── Hero carousel nav ────────────────────────────────────────────────────────
  const prevAffirm = () => setFeaturedIdx(i => (i - 1 + activeAffirms.length) % Math.max(activeAffirms.length, 1));
  const nextAffirm = () => setFeaturedIdx(i => (i + 1) % Math.max(activeAffirms.length, 1));
  const prevQuote  = () => setFeaturedQuoteIdx(i => (i - 1 + activeQuotes.length) % Math.max(activeQuotes.length, 1));
  const nextQuote  = () => setFeaturedQuoteIdx(i => (i + 1) % Math.max(activeQuotes.length, 1));

  return (
    <div style={{ background: theme.bgPrimary, minHeight: "100vh", padding: "24px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* ── Header ────────────────────────────────────────────────────────── */}
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
              background: theme.accentGradient, color: "#fff", border: "none",
              borderRadius: 10, padding: "10px 18px",
              display: "flex", alignItems: "center", gap: 8,
              cursor: "pointer", fontWeight: 600, fontSize: "0.88rem", flexShrink: 0,
            }}
          >
            <Plus size={16} />
            Add {tab === "quotes" ? "Quote" : "Affirmation"}
          </button>
        </div>

        {/* ── Tab bar ───────────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", gap: 4,
          background: theme.bgCard, border: `1px solid ${theme.bgCardBorder}`,
          borderRadius: 12, padding: 4, marginBottom: 24, width: "fit-content",
        }}>
          {(["affirmations", "quotes"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: tab === t ? theme.accentGradient : "transparent",
                color: tab === t ? "#fff" : theme.textSecondary,
                border: "none", borderRadius: 9, padding: "8px 20px",
                cursor: "pointer", fontWeight: tab === t ? 700 : 400,
                fontSize: "0.84rem", display: "flex", alignItems: "center",
                gap: 7, transition: "all 0.15s",
              }}
            >
              {t === "affirmations" ? <Sparkles size={14} /> : <Quote size={14} />}
              {t === "affirmations" ? "Affirmations" : "Quotes"}
            </button>
          ))}
        </div>

        {/* ── AFFIRMATIONS TAB ──────────────────────────────────────────────── */}
        {tab === "affirmations" && (
          <>
            {/* Hero carousel */}
            {featuredAffirm && (
              <div style={{
                background: theme.accentGradient, borderRadius: 20,
                padding: "36px 32px", marginBottom: 28,
                display: "flex", alignItems: "center", gap: 16,
                boxShadow: `0 8px 32px ${theme.bgCardShadow}`,
              }}>
                {activeAffirms.length > 1 && (
                  <button onClick={prevAffirm} style={navBtnStyle}>
                    <ChevronLeft size={18} color="#fff" />
                  </button>
                )}
                <div style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 14 }}>💫</div>
                  <p style={{
                    color: "#fff", fontSize: "1.2rem", fontWeight: 700,
                    lineHeight: 1.6, margin: "0 0 18px",
                  }}>
                    {featuredAffirm.text}
                  </p>
                  {activeAffirms.length > 1 && (
                    <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                      {activeAffirms.map((_, i) => (
                        <div key={i} onClick={() => setFeaturedIdx(i)}
                          style={{
                            width: i === featuredIdx ? 22 : 7, height: 7,
                            borderRadius: 4, cursor: "pointer", transition: "width 0.2s",
                            background: i === featuredIdx ? "#fff" : "rgba(255,255,255,0.35)",
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                {activeAffirms.length > 1 && (
                  <button onClick={nextAffirm} style={navBtnStyle}>
                    <ChevronRight size={18} color="#fff" />
                  </button>
                )}
              </div>
            )}

            {/* Section label */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ color: theme.textMuted, fontSize: "0.75rem", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.08em" }}>
                All Affirmations ({affirmations.length})
              </span>
              <div style={{ flex: 1, height: 1, background: theme.bgCardBorder }} />
            </div>

            {/* 2-column card grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {affirmations.map((a) => (
                <AffirmCard
                  key={a.id} item={a} theme={theme}
                  onToggle={() => toggleAffirmation(a)}
                  onEdit={() => openEditAffirm(a)}
                  onDelete={() => deleteAffirmation(a.id)}
                />
              ))}
            </div>

            {affirmations.length === 0 && (
              <EmptyState label="No affirmations yet. Add your first one!" theme={theme} />
            )}
          </>
        )}

        {/* ── QUOTES TAB ────────────────────────────────────────────────────── */}
        {tab === "quotes" && (
          <>
            {/* Hero carousel */}
            {featuredQuote && (
              <div style={{
                background: theme.bgCard, borderRadius: 20,
                border: `1px solid ${theme.bgCardBorder}`,
                padding: "36px 32px", marginBottom: 28,
                display: "flex", alignItems: "center", gap: 16,
                boxShadow: `0 8px 32px ${theme.bgCardShadow}`,
              }}>
                {activeQuotes.length > 1 && (
                  <button onClick={prevQuote} style={accentNavBtnStyle(theme)}>
                    <ChevronLeft size={18} />
                  </button>
                )}
                <div style={{ flex: 1, textAlign: "center" }}>
                  <Quote size={28} style={{ color: theme.accent, opacity: 0.4, marginBottom: 12 }} />
                  <p style={{
                    color: theme.textPrimary, fontSize: "1.15rem", fontWeight: 600,
                    fontStyle: "italic", lineHeight: 1.6, margin: "0 0 12px",
                  }}>
                    "{featuredQuote.text}"
                  </p>
                  {featuredQuote.author && (
                    <p style={{ color: theme.accent, fontWeight: 700, fontSize: "0.88rem", margin: "0 0 18px" }}>
                      — {featuredQuote.author}
                    </p>
                  )}
                  {activeQuotes.length > 1 && (
                    <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                      {activeQuotes.map((_, i) => (
                        <div key={i} onClick={() => setFeaturedQuoteIdx(i)}
                          style={{
                            width: i === featuredQuoteIdx ? 22 : 7, height: 7,
                            borderRadius: 4, cursor: "pointer", transition: "width 0.2s",
                            background: i === featuredQuoteIdx ? theme.accent : theme.bgCardBorder,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                {activeQuotes.length > 1 && (
                  <button onClick={nextQuote} style={accentNavBtnStyle(theme)}>
                    <ChevronRight size={18} />
                  </button>
                )}
              </div>
            )}

            {/* Section label */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ color: theme.textMuted, fontSize: "0.75rem", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.08em" }}>
                All Quotes ({quotes.length})
              </span>
              <div style={{ flex: 1, height: 1, background: theme.bgCardBorder }} />
            </div>

            {/* 2-column card grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {quotes.map((q) => (
                <QuoteCard
                  key={q.id} item={q} theme={theme}
                  onToggle={() => toggleQuote(q)}
                  onEdit={() => openEditQuote(q)}
                  onDelete={() => deleteQuote(q.id)}
                />
              ))}
            </div>

            {quotes.length === 0 && (
              <EmptyState label="No quotes yet. Add your first one!" theme={theme} />
            )}
          </>
        )}
      </div>

      {/* ── QUOTE MODAL ─────────────────────────────────────────────────────── */}
      {showQuoteModal && (
        <Modal onClose={() => setShowQuoteModal(false)} theme={theme}
          title={editQuote ? "Edit Quote" : "Add Quote"}>
          <textarea
            value={qText} onChange={(e) => setQText(e.currentTarget.value)}
            placeholder="Enter the quote..." rows={4}
            style={textareaStyle(theme)}
          />
          <input
            value={qAuthor} onChange={(e) => setQAuthor(e.currentTarget.value)}
            placeholder="Author (optional)"
            style={{ ...inputStyle(theme), marginBottom: 20 }}
          />
          <ModalButtons
            onCancel={() => setShowQuoteModal(false)}
            onSave={saveQuote} theme={theme}
          />
        </Modal>
      )}

      {/* ── AFFIRMATION MODAL ───────────────────────────────────────────────── */}
      {showAffirmModal && (
        <Modal onClose={() => setShowAffirmModal(false)} theme={theme}
          title={editAffirm ? "Edit Affirmation" : "Add Affirmation"}>
          <textarea
            value={aText} onChange={(e) => setAText(e.currentTarget.value)}
            placeholder="Write your affirmation in the present tense… e.g. I am confident and successful."
            rows={4} style={{ ...textareaStyle(theme), marginBottom: 20 }}
          />
          <ModalButtons
            onCancel={() => setShowAffirmModal(false)}
            onSave={saveAffirmation} theme={theme}
          />
        </Modal>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AffirmCard({ item, theme, onToggle, onEdit, onDelete }: any) {
  return (
    <div style={{
      background: theme.bgCard,
      border: `1px solid ${item.is_active ? theme.accent + "55" : theme.bgCardBorder}`,
      borderRadius: 14, padding: "18px 16px",
      display: "flex", flexDirection: "column", gap: 12,
      opacity: item.is_active ? 1 : 0.45,
      transition: "opacity 0.2s, border-color 0.2s",
      boxShadow: item.is_active ? `0 2px 12px ${theme.bgCardShadow}` : "none",
    }}>
      {/* Text */}
      <p style={{
        color: theme.textPrimary, fontSize: "0.9rem", lineHeight: 1.6,
        margin: 0, flex: 1,
      }}>
        {item.text}
      </p>

      {/* Footer row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        {!item.is_custom && (
          <span style={{
            fontSize: "0.66rem", color: theme.textMuted, background: theme.iconBg,
            borderRadius: 5, padding: "2px 6px",
          }}>default</span>
        )}
        {item.is_custom && <span />}

        <div style={{ display: "flex", gap: 5, marginLeft: "auto" }}>
          <IconBtn onClick={onToggle} color={item.is_active ? "#10b981" : theme.textMuted}
            bg={item.is_active ? "#10b98118" : theme.iconBg} title={item.is_active ? "Disable" : "Enable"}>
            <Check size={13} />
          </IconBtn>
          <IconBtn onClick={onEdit} color={theme.textSecondary} bg={theme.iconBg} title="Edit">
            <Edit2 size={13} />
          </IconBtn>
          <IconBtn onClick={onDelete} color="#ef4444" bg="#ef444415" title="Delete">
            <Trash2 size={13} />
          </IconBtn>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function QuoteCard({ item, theme, onToggle, onEdit, onDelete }: any) {
  return (
    <div style={{
      background: theme.bgCard,
      border: `1px solid ${item.is_active ? theme.accent + "55" : theme.bgCardBorder}`,
      borderRadius: 14, padding: "18px 16px",
      display: "flex", flexDirection: "column", gap: 12,
      opacity: item.is_active ? 1 : 0.45,
      transition: "opacity 0.2s, border-color 0.2s",
      boxShadow: item.is_active ? `0 2px 12px ${theme.bgCardShadow}` : "none",
    }}>
      {/* Quote mark accent */}
      <Quote size={16} style={{ color: theme.accent, opacity: 0.4, flexShrink: 0 }} />

      {/* Text */}
      <p style={{
        color: theme.textPrimary, fontSize: "0.88rem", fontStyle: "italic",
        lineHeight: 1.6, margin: 0, flex: 1,
      }}>
        "{item.text}"
      </p>

      {item.author && (
        <p style={{ color: theme.accent, fontSize: "0.78rem", fontWeight: 600,
          fontStyle: "normal", margin: 0 }}>
          — {item.author}
        </p>
      )}

      {/* Footer row */}
      <div style={{ display: "flex", alignItems: "center" }}>
        {!item.is_custom && (
          <span style={{
            fontSize: "0.66rem", color: theme.textMuted, background: theme.iconBg,
            borderRadius: 5, padding: "2px 6px",
          }}>default</span>
        )}
        <div style={{ display: "flex", gap: 5, marginLeft: "auto" }}>
          <IconBtn onClick={onToggle} color={item.is_active ? "#10b981" : theme.textMuted}
            bg={item.is_active ? "#10b98118" : theme.iconBg} title={item.is_active ? "Disable" : "Enable"}>
            <Check size={13} />
          </IconBtn>
          <IconBtn onClick={onEdit} color={theme.textSecondary} bg={theme.iconBg} title="Edit">
            <Edit2 size={13} />
          </IconBtn>
          <IconBtn onClick={onDelete} color="#ef4444" bg="#ef444415" title="Delete">
            <Trash2 size={13} />
          </IconBtn>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function IconBtn({ onClick, color, bg, title, children }: any) {
  return (
    <button onClick={onClick} title={title} style={{
      background: bg, color, border: "none", borderRadius: 7,
      width: 28, height: 28, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      {children}
    </button>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Modal({ onClose, theme, title, children }: any) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }}>
      <div style={{
        background: theme.bgCard, borderRadius: 20, padding: 28,
        width: "100%", maxWidth: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ color: theme.textPrimary, margin: 0, fontSize: 20, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: theme.textMuted }}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ModalButtons({ onCancel, onSave, theme }: any) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <button onClick={onCancel} style={{
        flex: 1, background: theme.bgInput, color: theme.textSecondary,
        border: "none", borderRadius: 10, padding: "12px", cursor: "pointer", fontWeight: 600,
      }}>Cancel</button>
      <button onClick={onSave} style={{
        flex: 2, background: theme.accentGradient, color: "#fff",
        border: "none", borderRadius: 10, padding: "12px", cursor: "pointer", fontWeight: 700,
      }}>Save</button>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EmptyState({ label, theme }: any) {
  return (
    <div style={{ textAlign: "center", color: theme.textMuted, padding: "40px 0", fontSize: "0.9rem" }}>
      {label}
    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const navBtnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.18)", border: "none", borderRadius: 10,
  width: 36, height: 36, cursor: "pointer", display: "flex",
  alignItems: "center", justifyContent: "center", flexShrink: 0,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function accentNavBtnStyle(theme: any): React.CSSProperties {
  return {
    background: theme.iconBg, border: `1px solid ${theme.bgCardBorder}`,
    borderRadius: 10, width: 36, height: 36, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, color: theme.textSecondary,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function textareaStyle(theme: any): React.CSSProperties {
  return {
    width: "100%", background: theme.bgInput,
    border: `1px solid ${theme.bgCardBorder}`, borderRadius: 10,
    padding: "12px 14px", color: theme.textPrimary, fontSize: "0.9rem",
    resize: "vertical", boxSizing: "border-box", marginBottom: 12,
    outline: "none",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function inputStyle(theme: any): React.CSSProperties {
  return {
    width: "100%", background: theme.bgInput,
    border: `1px solid ${theme.bgCardBorder}`, borderRadius: 10,
    padding: "11px 14px", color: theme.textPrimary, fontSize: "0.9rem",
    boxSizing: "border-box", outline: "none",
  };
}
