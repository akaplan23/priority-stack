"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from '../lib/supabase'

// ── Scoring ──────────────────────────────────────────────────────────────────

function computeScore(item: any) {
  const now = Date.now();
  let score = 0;

  if (item.due_date) {
    const due = new Date(item.due_date).getTime();
    const days = (due - now) / (1000 * 60 * 60 * 24);
    if (days < 0)        score += 150;
    else if (days <= 1)  score += 70;
    else if (days <= 3)  score += 50;
    else if (days <= 7)  score += 35;
    else if (days <= 14) score += 20;
    else if (days <= 30) score += 10;
  } else {
    score += 5;
  }

  if (item.priority === "high")   score += 120;
  if (item.priority === "medium") score += 70;
  if (item.priority === "low")    score += 30;
  if (item.type === "task")       score += 10;

  const urgentWords = ["blocking", "urgent", "eod", "today", "asap", "critical"];
  const text = `${item.title} ${item.notes || ""}`.toLowerCase();
  if (urgentWords.some(w => text.includes(w))) score += 25;

  return score;
}

// ── Freeform parser ───────────────────────────────────────────────────────────

function parseFreeform(text: string) {
  const lower = text.toLowerCase();
  const title = text.split("\n")[0].slice(0, 80);

  let priority = "medium";
  if (/\b(urgent|critical|blocking|asap|high priority)\b/.test(lower)) priority = "high";
  else if (/\b(low priority|whenever|someday|eventually)\b/.test(lower)) priority = "low";

  let due_date = "";
  const todayMatch = /\b(today|eod|end of day)\b/.test(lower);
  const tomorrowMatch = /\btomorrow\b/.test(lower);
  const dayMatch = lower.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);

  const today = new Date();
  if (todayMatch) {
    due_date = today.toISOString().split("T")[0];
  } else if (tomorrowMatch) {
    const t = new Date(today);
    t.setDate(t.getDate() + 1);
    due_date = t.toISOString().split("T")[0];
  } else if (dayMatch) {
    const days = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
    const target = days.indexOf(dayMatch[1]);
    const current = today.getDay();
    const diff = (target - current + 7) % 7 || 7;
    const d = new Date(today);
    d.setDate(d.getDate() + diff);
    due_date = d.toISOString().split("T")[0];
  }

  return { title, priority, due_date, notes: text, type: "task" };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(str: string) {
  if (!str) return "";
  const d = new Date(str + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysLabel(str: string) {
  if (!str) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(str + "T00:00:00");
  const diff = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0)  return { label: `${Math.abs(diff)}d overdue`, color: "#ff4d4d" };
  if (diff === 0) return { label: "today", color: "#ffaa00" };
  if (diff <= 3)  return { label: `${diff}d`, color: "#ffaa00" };
  if (diff <= 7)  return { label: `${diff}d`, color: "#a0c4ff" };
  return { label: `${diff}d`, color: "#5a5a6a" };
}

const PRIORITY_COLOR: Record<string, string> = { high: "#ff4d4d", medium: "#ffaa00", low: "#5a9e6f" };

// ── Main component ────────────────────────────────────────────────────────────

const EMPTY_FORM = { title: "", type: "task", due_date: "", priority: "medium", notes: "", project_id: "" };

export default function PriorityStack() {
  const [items, setItems] = useState<any[]>([]);
  const [view, setView] = useState("stack");
  const [inputMode, setInputMode] = useState("structured");
  const [form, setForm] = useState(EMPTY_FORM);
  const [freeformText, setFreeformText] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: tasks, error: tasksError } = await supabase.from('tasks').select('*');
      const { data: projects, error: projectsError } = await supabase.from('projects').select('*');

      if (tasksError) console.error('Error loading tasks:', tasksError);
      if (projectsError) console.error('Error loading projects:', projectsError);

      const all = [...(tasks || []), ...(projects || [])];
      setItems(all);
      setLoading(false);
    }
    init();
  }, []);

  const ranked = useMemo(() => {
    return [...items]
      .map(i => ({ ...i, score: computeScore(i) }))
      .sort((a, b) => b.score - a.score);
  }, [items]);

  const projects = useMemo(() => items.filter(i => i.type === "project"), [items]);

  async function addItem(raw: any) {
    const table = raw.type === "project" ? "projects" : "tasks";
    const { data: { session } } = await supabase.auth.getSession();

    const payload: any = {
      title: raw.title,
      type: raw.type,
      priority: raw.priority || "medium",
      due_date: raw.due_date || null,
      notes: raw.notes || null,
      user_id: session!.user.id,
    };

    if (raw.type !== "project") {
      payload.project_id = raw.project_id || null;
    }

    const { data, error } = await supabase.from(table).insert(payload).select().single();
    if (error) { console.error('Error adding item:', error); return; }
    setItems(prev => [...prev, data]);
  }

  function submitStructured(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    addItem(form);
    setForm(EMPTY_FORM);
  }

  async function submitFreeform(e: React.FormEvent) {
    e.preventDefault();
    if (!freeformText.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/parse-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: freeformText }),
      });

      if (!response.ok) throw new Error('Parse failed');

      const parsed = await response.json();
      addItem(parsed);
    } catch (error) {
      console.error('Freeform parse error:', error);
      addItem(parseFreeform(freeformText));
    }

    setIsSubmitting(false);
    setFreeformText("");
  }

  async function deleteItem(id: string, type: string) {
    const table = type === "project" ? "projects" : "tasks";
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) { console.error('Error deleting item:', error); return; }
    setItems(prev => prev.filter(i => i.id !== id));
    if (expanded === id) setExpanded(null);
  }

  async function saveEdit(updated: any) {
    const table = updated.type === "project" ? "projects" : "tasks";
    const payload = {
      title: updated.title,
      priority: updated.priority,
      due_date: updated.due_date || null,
      notes: updated.notes || null,
      project_id: updated.project_id || null,
    };
    const { data, error } = await supabase.from(table).update(payload).eq('id', updated.id).select().single();
    if (error) { console.error('Error updating item:', error); return; }
    setItems(prev => prev.map(i => i.id === data.id ? data : i));
    setEditing(null);
  }

  async function markDone(id: string, type: string) {
    deleteItem(id, type);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0e0e16", color: "#5a5a6a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px" }}>
        loading stack...
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0e0e16",
      color: "#e8e8f0",
      fontFamily: "'DM Sans', system-ui, sans-serif",
      padding: "0",
    }}>
      <header style={{
        borderBottom: "1px solid #1e1e2a",
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        background: "#0e0e16",
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", color: "#5a5aff", letterSpacing: "0.1em" }}>PS</span>
          <span style={{ fontSize: "15px", fontWeight: 600, color: "#e8e8f0" }}>Priority Stack</span>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }}
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "11px",
              padding: "5px 12px",
              borderRadius: "3px",
              border: "1px solid #2a2a36",
              background: "transparent",
              color: "#5a5a6a",
              cursor: "pointer",
              letterSpacing: "0.08em",
            }}
          >sign out</button>
          {["stack", "intake"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "11px",
              padding: "5px 12px",
              borderRadius: "3px",
              border: "1px solid",
              borderColor: view === v ? "#5a5aff" : "#2a2a36",
              background: view === v ? "#5a5aff18" : "transparent",
              color: view === v ? "#5a5aff" : "#5a5a6a",
              cursor: "pointer",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}>{v}</button>
          ))}
        </div>
      </header>

      <div style={{ maxWidth: "680px", margin: "0 auto", padding: "24px 16px" }}>
        <div style={{
          border: "1px solid #1e1e2a",
          borderRadius: "6px",
          background: "#13131c",
          marginBottom: "24px",
          overflow: "hidden",
        }}>
          <div style={{ display: "flex", borderBottom: "1px solid #1e1e2a" }}>
            {["structured", "freeform"].map(m => (
              <button key={m} onClick={() => setInputMode(m)} style={{
                flex: 1,
                padding: "10px",
                background: inputMode === m ? "#1e1e2a" : "transparent",
                border: "none",
                color: inputMode === m ? "#e8e8f0" : "#5a5a6a",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "11px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}>{m}</button>
            ))}
          </div>

          <div style={{ padding: "16px" }}>
            {inputMode === "structured" ? (
              <form onSubmit={submitStructured}>
                <input
                  placeholder="Task or project title"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  style={inputStyle}
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", margin: "8px 0" }}>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={selectStyle}>
                    <option value="task">Task</option>
                    <option value="project">Project</option>
                  </select>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={selectStyle}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#5a5a6a", letterSpacing: "0.08em" }}>due date</span>
                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} style={{ ...selectStyle, flex: 1 }} />
                      {form.due_date && (
                        <button type="button" onClick={() => setForm(f => ({ ...f, due_date: "" }))} style={{ background: "transparent", border: "1px solid #2a2a36", borderRadius: "4px", color: "#5a5a6a", cursor: "pointer", fontSize: "12px", padding: "0 8px", height: "38px", fontFamily: "'IBM Plex Mono', monospace" }}>✕</button>
                      )}
                    </div>
                  </div>
                </div>
                {projects.length > 0 && (
                  <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} style={{ ...selectStyle, marginBottom: "8px", width: "100%" }}>
                    <option value="">No project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                )}
                <textarea
                  placeholder="Notes (optional)"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
                <button type="submit" style={submitBtnStyle}>Add to stack</button>
              </form>
            ) : (
              <form onSubmit={submitFreeform}>
                <textarea
                  placeholder={`Describe in plain language.\n"Finish the Acme renewal deck by EOD Thursday — blocking the QBR"`}
                  value={freeformText}
                  onChange={e => setFreeformText(e.target.value)}
                  rows={4}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
                <button type="submit" disabled={isSubmitting} style={{ ...submitBtnStyle, opacity: isSubmitting ? 0.6 : 1, cursor: isSubmitting ? "not-allowed" : "pointer" }}>
                  {isSubmitting ? "parsing..." : "Parse + add"}
                </button>
              </form>
            )}
          </div>
        </div>

        {items.length === 0 ? (
          <div style={{ textAlign: "center", color: "#5a5a6a", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", padding: "48px 0" }}>
            stack is empty — add something above
          </div>
        ) : view === "stack" ? (
          <StackView
            ranked={ranked}
            projects={projects}
            expanded={expanded}
            setExpanded={setExpanded}
            editing={editing}
            setEditing={setEditing}
            onDelete={deleteItem}
            onDone={markDone}
            onSave={saveEdit}
          />
        ) : (
          <IntakeView ranked={ranked} projects={projects} />
        )}
      </div>
    </div>
  );
}

// ── Stack View ────────────────────────────────────────────────────────────────

function StackView({ ranked, projects, expanded, setExpanded, editing, setEditing, onDelete, onDone, onSave }: any) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {ranked.map((item: any, idx: number) => {
        const dl = daysLabel(item.due_date);
        const isTop = idx === 0;
        const isExpanded = expanded === item.id;
        const isEditing = editing?.id === item.id;
        const project = item.project_id ? projects.find((p: any) => p.id === item.project_id) : null;

        return (
          <div key={item.id} style={{
            border: `1px solid ${isTop ? "#ff4d4d44" : "#1e1e2a"}`,
            borderRadius: "5px",
            background: isTop ? "#1a1014" : "#13131c",
            overflow: "hidden",
          }}>
            <div
              onClick={() => !isEditing && setExpanded(isExpanded ? null : item.id)}
              style={{ display: "flex", alignItems: "center", padding: "12px 14px", gap: "12px", cursor: "pointer" }}
            >
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "11px",
                color: isTop ? "#ff4d4d" : "#5a5a6a",
                minWidth: "24px",
                fontWeight: isTop ? 700 : 400,
              }}>#{idx + 1}</span>

              <span style={{ flex: 1, fontSize: "14px", fontWeight: isTop ? 600 : 400, color: isTop ? "#e8e8f0" : "#c0c0d0" }}>
                {item.title}
                {item.type === "project" && (
                  <span style={{ marginLeft: "8px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#5a5aff", background: "#5a5aff18", padding: "2px 6px", borderRadius: "3px", letterSpacing: "0.08em" }}>PRJ</span>
                )}
                {project && <span style={{ marginLeft: "8px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#5a5a6a" }}>↳ {project.title}</span>}
              </span>

              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                {dl && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: dl.color }}>{dl.label}</span>}
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: PRIORITY_COLOR[item.priority] }}>
                  {item.priority[0].toUpperCase()}
                </span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#2a2a36", background: "#1e1e2a", padding: "2px 6px", borderRadius: "3px" }}>
                  {item.score}
                </span>
              </div>
            </div>

            {isExpanded && !isEditing && (
              <div style={{ borderTop: "1px solid #1e1e2a", padding: "12px 14px", paddingLeft: "50px" }}>
                {item.notes && <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#a0a0b0", lineHeight: 1.5 }}>{item.notes}</p>}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => onDone(item.id, item.type)} style={actionBtn("#5a9e6f")}>✓ Done</button>
                  <button onClick={() => setEditing(item)} style={actionBtn("#5a5aff")}>Edit</button>
                  <button onClick={() => onDelete(item.id, item.type)} style={actionBtn("#ff4d4d")}>Delete</button>
                </div>
              </div>
            )}

            {isEditing && (
              <EditForm item={editing} onSave={onSave} onCancel={() => setEditing(null)} projects={projects} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Intake View ───────────────────────────────────────────────────────────────

function IntakeView({ ranked, projects }: any) {
  return (
    <div style={{ border: "1px solid #1e1e2a", borderRadius: "6px", overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 80px 60px 50px", gap: "0", borderBottom: "1px solid #1e1e2a" }}>
        {["#", "Title", "Due", "Pri", "Pts"].map(h => (
          <div key={h} style={{ padding: "8px 10px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#5a5a6a", letterSpacing: "0.08em" }}>{h}</div>
        ))}
      </div>
      {ranked.map((item: any, idx: number) => {
        const dl = daysLabel(item.due_date);
        return (
          <div key={item.id} style={{
            display: "grid",
            gridTemplateColumns: "32px 1fr 80px 60px 50px",
            borderBottom: "1px solid #1a1a24",
            background: idx % 2 === 0 ? "transparent" : "#11111a",
          }}>
            <div style={{ padding: "10px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#5a5a6a" }}>#{idx + 1}</div>
            <div style={{ padding: "10px", fontSize: "13px", color: "#c0c0d0" }}>{item.title}</div>
            <div style={{ padding: "10px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: dl?.color || "#5a5a6a" }}>{dl?.label || "—"}</div>
            <div style={{ padding: "10px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: PRIORITY_COLOR[item.priority] }}>{item.priority}</div>
            <div style={{ padding: "10px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#5a5a6a" }}>{item.score}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Edit Form ─────────────────────────────────────────────────────────────────

function EditForm({ item, onSave, onCancel, projects }: any) {
  const [form, setForm] = useState({ ...item });
  return (
    <div style={{ borderTop: "1px solid #1e1e2a", padding: "12px 14px" }}>
      <input value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} style={{ ...inputStyle, marginBottom: "8px" }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "8px" }}>
        <select value={form.type} onChange={e => setForm((f: any) => ({ ...f, type: e.target.value }))} style={selectStyle}>
          <option value="task">Task</option>
          <option value="project">Project</option>
        </select>
        <select value={form.priority} onChange={e => setForm((f: any) => ({ ...f, priority: e.target.value }))} style={selectStyle}>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#5a5a6a", letterSpacing: "0.08em" }}>due date</span>
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <input type="date" value={form.due_date || ""} onChange={e => setForm((f: any) => ({ ...f, due_date: e.target.value }))} style={{ ...selectStyle, flex: 1 }} />
            {form.due_date && (
              <button type="button" onClick={() => setForm((f: any) => ({ ...f, due_date: "" }))} style={{ background: "transparent", border: "1px solid #2a2a36", borderRadius: "4px", color: "#5a5a6a", cursor: "pointer", fontSize: "12px", padding: "0 8px", height: "38px", fontFamily: "'IBM Plex Mono', monospace" }}>✕</button>
            )}
          </div>
        </div>
      </div>
      <textarea value={form.notes || ""} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...inputStyle, marginBottom: "8px", resize: "vertical" }} />
      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={() => onSave(form)} style={actionBtn("#5a5aff")}>Save</button>
        <button onClick={onCancel} style={actionBtn("#5a5a6a")}>Cancel</button>
      </div>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0e0e16",
  border: "1px solid #2a2a36",
  borderRadius: "4px",
  color: "#e8e8f0",
  padding: "9px 12px",
  fontSize: "14px",
  fontFamily: "'DM Sans', system-ui, sans-serif",
  outline: "none",
  boxSizing: "border-box",
  display: "block",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

const submitBtnStyle: React.CSSProperties = {
  marginTop: "10px",
  width: "100%",
  padding: "10px",
  background: "#5a5aff",
  border: "none",
  borderRadius: "4px",
  color: "#fff",
  fontSize: "13px",
  fontFamily: "'IBM Plex Mono', monospace",
  letterSpacing: "0.05em",
  cursor: "pointer",
};

function actionBtn(color: string): React.CSSProperties {
  return {
    padding: "6px 14px",
    background: "transparent",
    border: `1px solid ${color}44`,
    borderRadius: "3px",
    color: color,
    fontSize: "12px",
    fontFamily: "'IBM Plex Mono', monospace",
    cursor: "pointer",
  };
}