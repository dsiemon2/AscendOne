import { useState, useEffect, useRef, useCallback, KeyboardEvent } from "react";
import {
  Plus, Trash2, GripVertical,
  ChevronLeft, ChevronRight, ClipboardPlus,
  StickyNote, X,
} from "lucide-react";
import { getDb } from "../db/database";
import { useThemeStore } from "../store/themeStore";

interface Todo {
  id: number;
  text: string;
  completed: number; // 0 | 1
  sort_order: number;
  date: string;  // 'YYYY-MM-DD'
  notes: string; // free-form note text, '' when empty
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function toDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function offsetDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toDateStr(date);
}

function formatDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// ── Notepad palette — warm paper tones, always the same regardless of app theme
const N = {
  paper:    "#faf8f2",
  paperAlt: "#fefcf6",
  header:   "#f0ece0",
  ring:     "#c8c8c8",
  ringFill: "#d8d4c8",
  spine:    "#e8e4d8",
  line:     "#d6e4f7",
  margin:   "#f4b8c1",
  ink:      "#2c2c2c",
  inkDone:  "#9a9a9a",
  label:    "#b0a080",
  grip:     "#ccc8b8",
  gripHov:  "#a0a090",
  delCol:   "#d0c8b0",
  delHov:   "#e05050",
  footLink: "#c0a070",
  footHov:  "#e05050",
  empty:    "#c0b898",
};

const RING_COUNT = 22;

export default function ToDoPage() {
  const { theme } = useThemeStore();
  const accent = theme.accent;

  const todayStr   = toDateStr(new Date());
  const maxDateStr = offsetDate(todayStr, 7); // allow planning up to 7 days ahead
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const isToday  = selectedDate === todayStr;
  const isFuture = selectedDate > todayStr;

  const [todos, setTodos]           = useState<Todo[]>([]);
  const [newText, setNewText]       = useState("");
  const [addError, setAddError]     = useState<string | null>(null);
  const [carryItems, setCarryItems] = useState<Todo[]>([]); // incomplete from prev day
  const [carryFromDate, setCarryFromDate] = useState<string | null>(null);
  const [flashId, setFlashId]       = useState<number | null>(null); // briefly highlight copied task
  const [noteModal, setNoteModal]   = useState<Todo | null>(null);   // which task's note is open
  const [noteText, setNoteText]     = useState("");

  const inputRef  = useRef<HTMLInputElement>(null);
  const todosRef  = useRef<Todo[]>([]);
  useEffect(() => { todosRef.current = todos; }, [todos]);

  // Drag state
  const dragIdRef    = useRef<number | null>(null);
  const dragOverRef  = useRef<number | null>(null);
  const [dragId,    setDragId]    = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  // ── Load todos for a given date ────────────────────────────────────────────
  const loadTodos = useCallback(async (date: string) => {
    try {
      const db = await getDb();
      // Use entry_date alias to avoid any ambiguity with SQLite's date() function
      const rows = await db.select<Todo[]>(
        `SELECT id, text, completed, sort_order, "date", notes FROM todos WHERE "date" = ? ORDER BY sort_order ASC, id ASC`,
        [date]
      );
      setTodos(rows);
    } catch (err) {
      console.error("[ToDoPage] loadTodos failed:", err);
      setTodos([]);
    }
  }, []);

  // ── Check for incomplete tasks from a previous day (shown on today) ────────
  const checkCarryOver = useCallback(async () => {
    try {
      const db = await getDb();
      const prev = await db.select<{ date: string }[]>(
        `SELECT DISTINCT "date" FROM todos
         WHERE "date" < ? AND completed = 0
         ORDER BY "date" DESC LIMIT 1`,
        [todayStr]
      );
      if (prev.length === 0) { setCarryItems([]); setCarryFromDate(null); return; }
      const fromDate = prev[0].date;
      const items = await db.select<Todo[]>(
        `SELECT id, text, completed, sort_order, "date", notes FROM todos WHERE "date" = ? AND completed = 0 ORDER BY sort_order ASC, id ASC`,
        [fromDate]
      );
      setCarryItems(items);
      setCarryFromDate(fromDate);
    } catch (err) {
      console.error("[ToDoPage] checkCarryOver failed:", err);
    }
  }, [todayStr]);

  // Reload when selected date changes
  useEffect(() => {
    loadTodos(selectedDate);
    if (isToday) checkCarryOver(); else { setCarryItems([]); setCarryFromDate(null); }
  }, [selectedDate, isToday, loadTodos, checkCarryOver]);

  // ── Date navigation ────────────────────────────────────────────────────────
  function goDate(offset: number) {
    const next = offsetDate(selectedDate, offset);
    if (next > maxDateStr) return; // cap at 7 days ahead
    setSelectedDate(next);
  }

  // ── Add todo ───────────────────────────────────────────────────────────────
  async function addTodo() {
    const text = newText.trim();
    if (!text) return;
    setAddError(null);
    try {
      const db = await getDb();
      const cur = todosRef.current;
      const maxOrder = cur.length > 0 ? Math.max(...cur.map(t => t.sort_order)) + 1 : 0;
      await db.execute(
        `INSERT INTO todos (text, completed, sort_order, "date") VALUES (?, 0, ?, ?)`,
        [text, maxOrder, selectedDate]
      );
      setNewText("");
      await loadTodos(selectedDate);
      inputRef.current?.focus();
    } catch (err) {
      console.error("[ToDoPage] addTodo failed:", err);
      setAddError(String(err));
    }
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") addTodo();
  }

  // ── Notes modal ────────────────────────────────────────────────────────────
  function openNote(todo: Todo) {
    setNoteModal(todo);
    setNoteText(todo.notes || "");
  }

  async function saveNote() {
    if (!noteModal) return;
    const db = await getDb();
    const trimmed = noteText.trim();
    await db.execute("UPDATE todos SET notes=? WHERE id=?", [trimmed, noteModal.id]);
    setTodos(prev => prev.map(t => t.id === noteModal.id ? { ...t, notes: trimmed } : t));
    setNoteModal(null);
  }

  // ── Toggle complete ────────────────────────────────────────────────────────
  async function toggleTodo(id: number, completed: number) {
    const db = await getDb();
    await db.execute("UPDATE todos SET completed=? WHERE id=?", [completed ? 0 : 1, id]);
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: completed ? 0 : 1 } : t));
    if (isToday) checkCarryOver();
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function deleteTodo(id: number) {
    const db = await getDb();
    await db.execute("DELETE FROM todos WHERE id=?", [id]);
    setTodos(prev => prev.filter(t => t.id !== id));
  }

  // ── Clear completed on selected date ──────────────────────────────────────
  async function clearCompleted() {
    const db = await getDb();
    await db.execute(`DELETE FROM todos WHERE completed=1 AND "date"=?`, [selectedDate]);
    setTodos(prev => prev.filter(t => !t.completed));
  }

  // ── Roll over all incomplete from most recent previous day → today ─────────
  async function rollOver() {
    if (!carryItems.length) return;
    const db = await getDb();
    const cur = todosRef.current;
    let nextOrder = cur.length > 0 ? Math.max(...cur.map(t => t.sort_order)) + 1 : 0;
    for (const item of carryItems) {
      await db.execute(
        `INSERT INTO todos (text, completed, sort_order, "date") VALUES (?, 0, ?, ?)`,
        [item.text, nextOrder++, todayStr]
      );
    }
    setCarryItems([]);
    setCarryFromDate(null);
    await loadTodos(selectedDate);
  }

  // ── Copy single task to a target date ────────────────────────────────────
  // On today → copies to tomorrow; on a past day → copies to today
  async function copyTask(todo: Todo, targetDate: string) {
    const db = await getDb();
    const rows = await db.select<{ sort_order: number }[]>(
      `SELECT sort_order FROM todos WHERE "date"=? ORDER BY sort_order DESC LIMIT 1`,
      [targetDate]
    );
    const nextOrder = rows.length > 0 ? rows[0].sort_order + 1 : 0;
    await db.execute(
      `INSERT INTO todos (text, completed, sort_order, "date") VALUES (?, 0, ?, ?)`,
      [todo.text, nextOrder, targetDate]
    );
    // Flash the icon briefly
    setFlashId(todo.id);
    setTimeout(() => setFlashId(null), 1200);
    // If the target is what we're viewing, refresh; otherwise refresh carry-over
    if (selectedDate === targetDate) await loadTodos(selectedDate);
    else await checkCarryOver();
  }

  // ── Drag-and-drop reorder (mouse events for Tauri WebView2 compat) ─────────
  function onGripMouseDown(e: React.MouseEvent, id: number) {
    e.preventDefault();
    dragIdRef.current = id;
    setDragId(id);

    function onMove(ev: MouseEvent) {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const row = el?.closest("[data-todo-id]") as HTMLElement | null;
      const overId = row ? Number(row.dataset.todoId) : null;
      if (overId !== dragOverRef.current) {
        dragOverRef.current = overId;
        setDragOverId(overId);
      }
    }

    async function onUp() {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("mouseup", onUp, true);

      const fromId = dragIdRef.current;
      const toId   = dragOverRef.current;
      dragIdRef.current = null;
      dragOverRef.current = null;
      setDragId(null);
      setDragOverId(null);

      if (fromId === null || toId === null || fromId === toId) return;

      const arr = [...todosRef.current];
      const fromIdx = arr.findIndex(t => t.id === fromId);
      const toIdx   = arr.findIndex(t => t.id === toId);
      if (fromIdx === -1 || toIdx === -1) return;

      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      const reordered = arr.map((t, i) => ({ ...t, sort_order: i }));
      setTodos(reordered);

      const db = await getDb();
      for (const [i, t] of reordered.entries()) {
        await db.execute("UPDATE todos SET sort_order=? WHERE id=?", [i, t.id]);
      }
    }

    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("mouseup", onUp, true);
  }

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalCount   = todos.length;
  const doneCount    = todos.filter(t => t.completed).length;
  const pendingCount = totalCount - doneCount;
  const hasCompleted = todos.some(t => t.completed);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>

      {/* ── Page title ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          fontSize: "1.6rem", fontWeight: 700,
          color: theme.textPrimary, letterSpacing: "-0.01em", margin: 0,
        }}>
          Daily To-Do List
        </h1>
        <p style={{ fontSize: "0.85rem", color: theme.textSecondary, marginTop: 4, marginBottom: 0 }}>
          {isToday
            ? pendingCount === 0 && totalCount > 0
              ? "🎉 All done for today!"
              : pendingCount > 0
              ? `${pendingCount} item${pendingCount !== 1 ? "s" : ""} left today`
              : "Nothing yet — add your first task below"
            : isFuture
            ? totalCount > 0
              ? `${totalCount} task${totalCount !== 1 ? "s" : ""} planned for ${formatDisplay(selectedDate)}`
              : `Planning ahead for ${formatDisplay(selectedDate)}`
            : `Viewing ${formatDisplay(selectedDate)}`}
        </p>
      </div>

      {/* ── Roll-over banner (today only, when prev-day incomplete exist) ───── */}
      {isToday && carryItems.length > 0 && (
        <div style={{
          marginBottom: 16,
          padding: "11px 16px",
          background: `${accent}15`,
          border: `1px solid ${accent}40`,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <span style={{ fontSize: "1rem" }}>📋</span>
          <span style={{ flex: 1, fontSize: "0.85rem", color: theme.textPrimary }}>
            <strong>{carryItems.length}</strong> incomplete task{carryItems.length !== 1 ? "s" : ""} from{" "}
            {carryFromDate ? formatDisplay(carryFromDate) : "a previous day"}.
          </span>
          <button
            onClick={rollOver}
            style={{
              background: accent, color: "#fff",
              border: "none", borderRadius: 6,
              padding: "6px 14px",
              fontSize: "0.8rem", fontWeight: 600,
              cursor: "pointer", whiteSpace: "nowrap",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            Roll over to today
          </button>
        </div>
      )}

      {/* ══════════════════════════ NOTEPAD ════════════════════════════════ */}
      <div style={{
        background: N.paper,
        borderRadius: 8,
        boxShadow: "0 4px 28px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.10)",
        overflow: "hidden",
        position: "relative",
      }}>

        {/* ── Spiral spine ──────────────────────────────────────────────── */}
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 46,
          background: N.spine,
          borderRight: `2px solid ${N.ring}`,
          display: "flex", flexDirection: "column",
          alignItems: "center", paddingTop: 20, gap: 0,
          zIndex: 2, pointerEvents: "none",
        }}>
          {Array.from({ length: RING_COUNT }).map((_, i) => (
            <div key={i} style={{
              width: 22, height: 22,
              border: `2.5px solid ${N.ring}`,
              borderRadius: "50%",
              background: N.ringFill,
              margin: "3px 0", flexShrink: 0,
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.12)",
            }} />
          ))}
        </div>

        {/* ── Date navigation header ─────────────────────────────────────── */}
        <div style={{
          marginLeft: 46,
          background: N.header,
          borderBottom: `2px solid ${N.margin}`,
          padding: "10px 16px 10px 28px",
          position: "relative",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          {/* margin line */}
          <div style={{ position: "absolute", left: 6, top: 0, bottom: 0, width: 2, background: N.margin }} />

          {/* ← prev */}
          <button
            onClick={() => goDate(-1)}
            title="Previous day"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: N.label, padding: "3px 5px", borderRadius: 4,
              display: "flex", alignItems: "center", lineHeight: 1,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = N.ink)}
            onMouseLeave={e => (e.currentTarget.style.color = N.label)}
          >
            <ChevronLeft size={16} />
          </button>

          {/* date label */}
          <div style={{ flex: 1, textAlign: "center" }}>
            <span style={{
              fontSize: "0.72rem", fontWeight: 700,
              color: isFuture ? accent : N.label,
              letterSpacing: "0.10em", textTransform: "uppercase",
            }}>
              {isToday ? "Today  ·  " : isFuture ? "Planning ahead  ·  " : ""}{formatDisplay(selectedDate)}
            </span>
          </div>

          {/* → next (disabled at 7-day cap) */}
          {(() => {
            const atMax = selectedDate >= maxDateStr;
            return (
              <button
                onClick={() => goDate(1)}
                disabled={atMax}
                title={atMax ? "Can't plan more than 7 days ahead" : "Next day"}
                style={{
                  background: "none", border: "none",
                  cursor: atMax ? "default" : "pointer",
                  color: atMax ? "#d8d0b8" : N.label,
                  padding: "3px 5px", borderRadius: 4,
                  display: "flex", alignItems: "center", lineHeight: 1,
                }}
                onMouseEnter={e => { if (!atMax) e.currentTarget.style.color = N.ink; }}
                onMouseLeave={e => { if (!atMax) e.currentTarget.style.color = N.label; }}
              >
                <ChevronRight size={16} />
              </button>
            );
          })()}

          {/* TODAY pill — shown when not on today (past or future) */}
          {!isToday && (
            <button
              onClick={() => setSelectedDate(todayStr)}
              title="Jump to today"
              style={{
                fontSize: "0.65rem", fontWeight: 800,
                color: "#fff", background: accent,
                border: "none", borderRadius: 10,
                padding: "2px 9px", cursor: "pointer",
                letterSpacing: "0.06em", marginLeft: 2,
                transition: "opacity 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              TODAY
            </button>
          )}

          {/* x/y counter */}
          {doneCount > 0 && isToday && (
            <div style={{ fontSize: "0.68rem", color: "#a8a090", fontStyle: "italic", marginLeft: 6 }}>
              {doneCount}/{totalCount}
            </div>
          )}
        </div>

        {/* ── New task input row ─────────────────────────────────────────── */}
        <div style={{
          marginLeft: 46,
          padding: "13px 16px 13px 28px",
          borderBottom: `1.5px solid ${N.line}`,
          display: "flex", alignItems: "center", gap: 10,
          background: N.paperAlt,
          position: "relative",
        }}>
          <div style={{ position: "absolute", left: 6, top: 0, bottom: 0, width: 2, background: N.margin }} />
          <button
            onClick={addTodo}
            title="Add task"
            style={{
              width: 28, height: 28, borderRadius: "50%",
              background: accent, border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, color: "#fff",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.82")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            <Plus size={16} strokeWidth={2.5} />
          </button>
          <input
            ref={inputRef}
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={onKey}
            placeholder={isToday ? "Add a task…" : `Add task to ${formatDisplay(selectedDate)}…`}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontFamily: "'Caveat', 'Segoe Print', cursive, sans-serif",
              fontSize: "1.05rem", color: N.ink, caretColor: accent,
            }}
          />
        </div>

        {/* ── Inline error message (visible when addTodo fails) ──────────── */}
        {addError && (
          <div style={{
            marginLeft: 46,
            padding: "6px 16px 6px 28px",
            background: "#fff0f0",
            borderBottom: `1.5px solid ${N.line}`,
            fontSize: "0.75rem",
            color: "#c0392b",
            position: "relative",
          }}>
            <div style={{ position: "absolute", left: 6, top: 0, bottom: 0, width: 2, background: N.margin }} />
            ⚠️ Could not save task: {addError}
          </div>
        )}

        {/* ── Todo rows ─────────────────────────────────────────────────── */}
        <div style={{ marginLeft: 46 }}>

          {/* Empty state */}
          {todos.length === 0 && (
            <div style={{
              padding: "32px 20px",
              textAlign: "center",
              color: N.empty,
              fontStyle: "italic",
              fontSize: "0.9rem",
              minHeight: 176,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: `repeating-linear-gradient(
                transparent, transparent 43px,
                ${N.line} 43px, ${N.line} 44px
              )`,
              backgroundSize: "100% 44px",
            }}>
              {isToday
                ? "Your list is empty — add your first task above ✏️"
                : isFuture
                ? "Nothing planned yet — add tasks above to get a head start ✏️"
                : "No tasks were recorded for this day"}
            </div>
          )}

          {todos.map(todo => {
            const done      = !!todo.completed;
            const dragging  = dragId === todo.id;
            const dropOver  = dragOverId === todo.id && dragId !== todo.id;
            const flashing  = flashId === todo.id;

            return (
              <div
                key={todo.id}
                data-todo-id={todo.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "0 16px 0 28px", height: 44,
                  borderBottom: `1.5px solid ${N.line}`,
                  borderTop: dropOver ? `2px solid ${accent}` : undefined,
                  background: dragging ? "rgba(0,0,0,0.035)" : "transparent",
                  opacity: dragging ? 0.45 : 1,
                  position: "relative",
                  transition: "background 0.1s, opacity 0.15s",
                }}
              >
                {/* margin line */}
                <div style={{ position: "absolute", left: 6, top: 0, bottom: 0, width: 2, background: N.margin }} />

                {/* grip */}
                <div
                  onMouseDown={e => onGripMouseDown(e, todo.id)}
                  title="Drag to reorder"
                  style={{
                    cursor: "grab", color: N.grip,
                    display: "flex", alignItems: "center",
                    flexShrink: 0, lineHeight: 1,
                    transition: "color 0.12s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = N.gripHov)}
                  onMouseLeave={e => (e.currentTarget.style.color = N.grip)}
                >
                  <GripVertical size={14} />
                </div>

                {/* checkbox */}
                <button
                  onClick={() => toggleTodo(todo.id, todo.completed)}
                  title={done ? "Mark incomplete" : "Mark complete"}
                  style={{
                    width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                    border: done ? `2px solid ${accent}` : "2px solid #c8c0a8",
                    background: done ? accent : "transparent",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s",
                  }}
                >
                  {done && (
                    <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                      <polyline
                        points="1.5,4.5 4,7 9.5,1.5"
                        stroke="#fff" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>

                {/* text — click to open notes modal */}
                <span
                  onClick={() => openNote(todo)}
                  title={todo.notes ? "View / edit note" : "Add a note"}
                  style={{
                    flex: 1,
                    fontFamily: "'Caveat', 'Segoe Print', cursive, sans-serif",
                    fontSize: "1.05rem",
                    color: done ? N.inkDone : N.ink,
                    textDecoration: done ? "line-through" : "none",
                    textDecorationColor: "#b0a890",
                    transition: "color 0.2s",
                    userSelect: "none",
                    lineHeight: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                  }}
                  onMouseEnter={e => { if (!done) (e.currentTarget as HTMLSpanElement).style.color = accent; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLSpanElement).style.color = done ? N.inkDone : N.ink; }}
                >
                  {todo.text}
                </span>

                {/* Note indicator — shown when a note exists */}
                {todo.notes && (
                  <span
                    onClick={() => openNote(todo)}
                    title="Has a note — click to view"
                    style={{ flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center" }}
                  >
                    <StickyNote size={13} style={{ color: accent, opacity: 0.85 }} />
                  </span>
                )}

                {/* copy button — today → tomorrow, past day → today; hidden on future days */}
                {!isFuture && (() => {
                  const targetDate = isToday ? offsetDate(todayStr, 1) : todayStr;
                  const tipLabel   = isToday ? "Copy to tomorrow" : "Copy to today";
                  return (
                    <button
                      onClick={() => copyTask(todo, targetDate)}
                      title={tipLabel}
                      style={{
                        background: flashing ? `${accent}20` : "none",
                        border: "none", cursor: "pointer",
                        color: flashing ? accent : N.delCol,
                        padding: "4px 3px", borderRadius: 4,
                        display: "flex", alignItems: "center",
                        flexShrink: 0, transition: "all 0.2s",
                        opacity: flashing ? 1 : 0,
                      }}
                      onMouseEnter={e => {
                        if (!flashing) {
                          (e.currentTarget as HTMLButtonElement).style.color   = accent;
                          (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                        }
                      }}
                      onMouseLeave={e => {
                        if (!flashing) {
                          (e.currentTarget as HTMLButtonElement).style.color   = N.delCol;
                          (e.currentTarget as HTMLButtonElement).style.opacity = "0";
                        }
                      }}
                      className="todo-action-btn"
                    >
                      <ClipboardPlus size={14} />
                    </button>
                  );
                })()}

                {/* delete */}
                <button
                  onClick={() => deleteTodo(todo.id)}
                  title="Delete"
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: N.delCol, padding: "4px 3px", borderRadius: 4,
                    display: "flex", alignItems: "center",
                    flexShrink: 0, opacity: 0,
                    transition: "opacity 0.15s, color 0.15s",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.color   = N.delHov;
                    (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.color   = N.delCol;
                    (e.currentTarget as HTMLButtonElement).style.opacity = "0";
                  }}
                  className="todo-delete-btn"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}

          {/* Blank ruled lines to pad the notepad */}
          {Array.from({ length: Math.max(0, 5 - todos.length) }).map((_, i) => (
            <div key={`blank-${i}`} style={{
              height: 44,
              borderBottom: `1.5px solid ${N.line}`,
              position: "relative",
            }}>
              <div style={{ position: "absolute", left: 6, top: 0, bottom: 0, width: 2, background: N.margin }} />
            </div>
          ))}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div style={{
          marginLeft: 46,
          padding: "10px 16px 10px 28px",
          background: N.header,
          borderTop: `2px solid ${N.margin}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "relative",
        }}>
          <div style={{ position: "absolute", left: 6, top: 0, bottom: 0, width: 2, background: N.margin }} />
          <div style={{ fontSize: "0.72rem", color: N.label, fontStyle: "italic" }}>
            {totalCount === 0
              ? "Nothing here yet"
              : `${doneCount} of ${totalCount} task${totalCount !== 1 ? "s" : ""} complete`}
          </div>
          {hasCompleted && (
            <button
              onClick={clearCompleted}
              style={{
                fontSize: "0.72rem", color: N.footLink,
                background: "none", border: "none", cursor: "pointer",
                textDecoration: "underline", textDecorationStyle: "dotted",
                padding: "2px 4px", borderRadius: 3,
                transition: "color 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = N.footHov)}
              onMouseLeave={e => (e.currentTarget.style.color = N.footLink)}
            >
              Clear completed
            </button>
          )}
        </div>
      </div>

      {/* Hover-reveal CSS for action buttons */}
      <style>{`
        [data-todo-id]:hover .todo-delete-btn  { opacity: 1 !important; }
        [data-todo-id]:hover .todo-action-btn  { opacity: 1 !important; }
      `}</style>

      {/* ── Notes modal ─────────────────────────────────────────────────── */}
      {noteModal && (
        <div
          onClick={() => setNoteModal(null)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: N.paper,
              borderRadius: 12,
              width: 500, maxWidth: "100%",
              boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
              overflow: "hidden",
              display: "flex", flexDirection: "column",
            }}
          >
            {/* Modal header */}
            <div style={{
              background: N.header,
              borderBottom: `2px solid ${N.margin}`,
              padding: "14px 18px",
              display: "flex", alignItems: "flex-start", gap: 10,
            }}>
              <StickyNote size={18} color={accent} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.1em",
                  textTransform: "uppercase", color: N.label, marginBottom: 2,
                }}>
                  Note for
                </div>
                <div style={{
                  fontFamily: "'Caveat', 'Segoe Print', cursive, sans-serif",
                  fontSize: "1.1rem", color: N.ink, lineHeight: 1.2,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {noteModal.text}
                </div>
              </div>
              <button
                onClick={() => setNoteModal(null)}
                title="Close"
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: N.label, padding: 4, borderRadius: 4,
                  display: "flex", alignItems: "center", flexShrink: 0,
                  transition: "color 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.color = N.ink)}
                onMouseLeave={e => (e.currentTarget.style.color = N.label)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Textarea */}
            <div style={{ padding: "16px 18px", background: N.paperAlt }}>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) saveNote(); }}
                placeholder="Type your note here…"
                autoFocus
                rows={6}
                style={{
                  width: "100%",
                  fontFamily: "'Caveat', 'Segoe Print', cursive, sans-serif",
                  fontSize: "1rem",
                  color: N.ink,
                  background: N.paper,
                  border: `1.5px solid ${N.line}`,
                  borderRadius: 6,
                  padding: "10px 12px",
                  resize: "vertical",
                  outline: "none",
                  lineHeight: "1.8",
                  caretColor: accent,
                  boxSizing: "border-box",
                  // Lined paper effect
                  backgroundImage: `repeating-linear-gradient(
                    transparent, transparent 28px,
                    ${N.line} 28px, ${N.line} 29px
                  )`,
                  backgroundAttachment: "local",
                }}
              />
              <div style={{
                fontSize: "0.68rem", color: N.label,
                marginTop: 6, textAlign: "right", fontStyle: "italic",
              }}>
                Ctrl+Enter to save
              </div>
            </div>

            {/* Footer */}
            <div style={{
              background: N.header,
              borderTop: `2px solid ${N.margin}`,
              padding: "12px 18px",
              display: "flex", justifyContent: "flex-end", gap: 10,
            }}>
              {/* Clear note button — only if there's an existing note */}
              {noteModal.notes && (
                <button
                  onClick={async () => {
                    setNoteText("");
                    const db = await getDb();
                    await db.execute("UPDATE todos SET notes='' WHERE id=?", [noteModal.id]);
                    setTodos(prev => prev.map(t => t.id === noteModal.id ? { ...t, notes: "" } : t));
                    setNoteModal(null);
                  }}
                  style={{
                    background: "none", border: `1px solid ${N.delCol}`,
                    borderRadius: 6, padding: "6px 14px",
                    fontSize: "0.8rem", color: N.delCol,
                    cursor: "pointer", marginRight: "auto",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = N.delHov;
                    (e.currentTarget as HTMLButtonElement).style.color = N.delHov;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = N.delCol;
                    (e.currentTarget as HTMLButtonElement).style.color = N.delCol;
                  }}
                >
                  Remove note
                </button>
              )}
              <button
                onClick={() => setNoteModal(null)}
                style={{
                  background: "none", border: `1px solid ${N.line}`,
                  borderRadius: 6, padding: "6px 14px",
                  fontSize: "0.8rem", color: N.label,
                  cursor: "pointer", transition: "all 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = N.label)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = N.line)}
              >
                Cancel
              </button>
              <button
                onClick={saveNote}
                style={{
                  background: accent, border: "none",
                  borderRadius: 6, padding: "6px 18px",
                  fontSize: "0.8rem", fontWeight: 600, color: "#fff",
                  cursor: "pointer", transition: "opacity 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                Save note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
