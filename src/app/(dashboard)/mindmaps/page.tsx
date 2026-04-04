"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModules } from "@/lib/hooks/useModules";
import { useProfile } from "@/lib/hooks/useProfile";
import { FREE_LIMITS, withinFreeLimit } from "@/lib/gates";
import { LimitNudge, LimitCounter, UpgradeModal } from "@/components/ui/ProGate";
import {
  Plus, Trash2, Pencil, X, ArrowLeft, Save, GitBranch, Move,
  ChevronRight, ChevronDown, Link2, ExternalLink, StickyNote,
  Network, LayoutGrid, ZoomIn, ZoomOut, Maximize2, GraduationCap,
  Copy, Download, Image, FileText, Search, Keyboard, Eye, EyeOff,
  CornerDownRight, ArrowRight, Undo2, CheckSquare, Square
} from "lucide-react";
import type { MindMap, MindMapNode, CalendarEvent, Task } from "@/types/database";
import { useTranslation } from "@/lib/i18n";

const NODE_COLORS = [
  "#6d28d9","#2563eb","#059669","#dc2626","#d97706",
  "#db2777","#0891b2","#7c3aed","#16a34a","#ea580c",
  "#6366f1","#0d9488","#f59e0b","#ef4444","#8b5cf6",
];

const NODE_ICONS = ["", "💡","📌","⭐","🔥","✅","❓","📖","🎯","⚠️","💎","🧩","🔬","📝","🏗️","🧪"];

// ─── Main Page ────────────────────────────────────────────────────────
export default function MindMapsPage() {
  const { t } = useTranslation();
  const supabase = createClient();
  const { modules } = useModules();
  const { isPro } = useProfile();
  const [maps, setMaps] = useState<MindMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMap, setEditingMap] = useState<MindMap | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [exams, setExams] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const fetchMaps = useCallback(async () => {
    const { data } = await supabase.from("mindmaps").select("*").order("updated_at", { ascending: false });
    setMaps(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchMaps();
    supabase.from("events").select("*").eq("event_type", "exam").then(r => setExams(r.data ?? []));
    supabase.from("tasks").select("*").neq("status", "done").then(r => setTasks(r.data ?? []));
  }, [supabase, fetchMaps]);

  if (editingMap) {
    return <MindMapEditor map={editingMap} modules={modules} onBack={() => { setEditingMap(null); fetchMaps(); }} />;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t("mindmaps.title")}</h1>
          <p className="text-surface-500 text-sm mt-0.5">{maps.length} Mind Map{maps.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <LimitCounter current={maps.length} max={FREE_LIMITS.mindMaps} isPro={isPro} />
          <button onClick={() => {
            const check = withinFreeLimit("mindMaps", maps.length, isPro);
            if (!check.allowed) { setShowUpgrade(true); return; }
            setShowCreate(true);
          }} className="btn-primary gap-2">
            <Plus size={16} /> {t("mindmaps.newMindmap")}
          </button>
        </div>
      </div>

      <LimitNudge current={maps.length} max={FREE_LIMITS.mindMaps} isPro={isPro} label="Mind Maps" />

      {showUpgrade && (
        <UpgradeModal feature="unlimitedMindMaps" onClose={() => setShowUpgrade(false)} />
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-surface-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : maps.length === 0 ? (
        <div className="text-center py-20 text-surface-400">
          <Network size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t("mindmaps.noMaps")}</p>
          <p className="text-sm mt-1">{t("mindmaps.noMapsDesc")}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {maps.map(m => {
            const mod = modules.find(mod => mod.id === m.module_id);
            return (
              <div key={m.id}
                onClick={() => setEditingMap(m)}
                className="card hover:shadow-md cursor-pointer transition-all group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm"
                    style={{ background: m.color }}>
                    <Network size={16} />
                  </div>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm(t("mindmaps.deleteConfirm"))) return;
                      await supabase.from("mindmaps").delete().eq("id", m.id);
                      fetchMaps();
                    }}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <h3 className="font-semibold text-surface-900 text-sm">{m.title}</h3>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {mod && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700">{mod.name}</span>
                  )}
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-100 text-surface-500">
                    {m.layout_mode === "tree" ? t("mindmaps.layoutTree") : t("mindmaps.layoutFree")}
                  </span>
                </div>
                <p className="text-[10px] text-surface-400 mt-2">
                  {new Date(m.updated_at).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateMapModal
          modules={modules} exams={exams} tasks={tasks}
          onClose={() => setShowCreate(false)}
          onCreated={(m) => { setShowCreate(false); setEditingMap(m); }}
        />
      )}
    </div>
  );
}

// ─── Create Modal ─────────────────────────────────────────────────────
function CreateMapModal({ modules, exams, tasks, onClose, onCreated }: {
  modules: any[]; exams: CalendarEvent[]; tasks: Task[];
  onClose: () => void; onCreated: (m: MindMap) => void;
}) {
  const { t } = useTranslation();
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [examId, setExamId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [layout, setLayout] = useState<"tree"|"free">("tree");
  const [color, setColor] = useState(NODE_COLORS[0]);
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { data } = await supabase.from("mindmaps").insert({
      user_id: user.id,
      title: title || t("mindmaps.newMindmap"),
      module_id: moduleId || null,
      exam_id: examId || null,
      task_id: taskId || null,
      layout_mode: layout,
      color,
    }).select().single();
    if (data) {
      await supabase.from("mindmap_nodes").insert({
        user_id: user.id,
        mindmap_id: data.id,
        parent_id: null,
        label: title || t("mindmaps.centralTopic"),
        color,
        pos_x: 400, pos_y: 50,
        sort_order: 0,
      });
      onCreated(data as MindMap);
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-surface-100">
          <h2 className="font-semibold text-surface-900">{t("mindmaps.newMindmap")}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100"><X size={16} /></button>
        </div>
        <form onSubmit={handleCreate} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{t("mindmaps.title_label")}</label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder={t("mindmaps.titlePlaceholder")} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("mindmaps.moduleOptional")}</label>
              <select className="input text-sm" value={moduleId} onChange={e => setModuleId(e.target.value)}>
                <option value="">{t("mindmaps.noModule")}</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("mindmaps.examOptional")}</label>
              <select className="input text-sm" value={examId} onChange={e => setExamId(e.target.value)}>
                <option value="">{t("mindmaps.noExam")}</option>
                {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">Layout</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setLayout("tree")}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-colors ${layout === "tree" ? "border-brand-400 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>
                <GitBranch size={16} /> {t("mindmaps.layoutTree")}
              </button>
              <button type="button" onClick={() => setLayout("free")}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-colors ${layout === "free" ? "border-brand-400 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>
                <Move size={16} /> {t("mindmaps.layoutFree")}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">{t("mindmaps.color")}</label>
            <div className="flex gap-1.5 flex-wrap">
              {NODE_COLORS.slice(0, 10).map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${color === c ? "border-surface-800 scale-110" : "border-transparent"}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">{t("mindmaps.cancel")}</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? t("mindmaps.creating") : t("mindmaps.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Mind Map Editor (completely rewritten) ────────────────────────────
function MindMapEditor({ map, modules, onBack }: {
  map: MindMap; modules: any[]; onBack: () => void;
}) {
  const { t } = useTranslation();
  const supabase = createClient();
  const [nodes, setNodes] = useState<MindMapNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [layoutMode, setLayoutMode] = useState<"tree"|"free">(map.layout_mode as "tree"|"free");
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [editNode, setEditNode] = useState<MindMapNode | null>(null);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineEditText, setInlineEditText] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null); // focus mode
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [undoStack, setUndoStack] = useState<MindMapNode[][]>([]);
  const [redoStack, setRedoStack] = useState<MindMapNode[][]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; nodeX: number; nodeY: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);

  const fetchNodes = useCallback(async () => {
    const { data } = await supabase.from("mindmap_nodes").select("*").eq("mindmap_id", map.id).order("sort_order");
    setNodes(data ?? []);
    setLoading(false);
  }, [supabase, map.id]);

  useEffect(() => { fetchNodes(); }, [fetchNodes]);

  // Build tree helpers
  const rootNode = useMemo(() => nodes.find(n => !n.parent_id), [nodes]);
  const childrenOf = useCallback((parentId: string) =>
    nodes.filter(n => n.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order),
  [nodes]);

  // Visible nodes (focus mode or all)
  const visibleNodes = useMemo(() => {
    if (!focusNodeId) return nodes;
    // Show focus node and all descendants
    const visible = new Set<string>();
    function walk(id: string) {
      visible.add(id);
      childrenOf(id).forEach(c => walk(c.id));
    }
    walk(focusNodeId);
    // Also add parent chain for context
    let current = nodes.find(n => n.id === focusNodeId);
    while (current?.parent_id) {
      visible.add(current.parent_id);
      current = nodes.find(n => n.id === current!.parent_id);
    }
    return nodes.filter(n => visible.has(n.id));
  }, [nodes, focusNodeId, childrenOf]);

  // Search filtering
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const q = searchQuery.toLowerCase();
    return new Set(nodes.filter(n =>
      n.label.toLowerCase().includes(q) ||
      (n.notes ?? "").toLowerCase().includes(q)
    ).map(n => n.id));
  }, [nodes, searchQuery]);

  // Selected node (primary — first in set)
  const primarySelected = useMemo(() => {
    const first = selectedNodes.values().next().value;
    return first ? nodes.find(n => n.id === first) : null;
  }, [selectedNodes, nodes]);

  // Auto-layout tree positions
  const treePositions = useMemo(() => {
    if (layoutMode !== "tree" || !rootNode) return new Map<string, { x: number; y: number }>();
    const pos = new Map<string, { x: number; y: number }>();
    const NODE_W = 180;
    const NODE_H = 56;

    function countVisibleLeaves(id: string): number {
      const node = nodes.find(n => n.id === id);
      if (node?.collapsed) return 1;
      const children = childrenOf(id);
      if (children.length === 0) return 1;
      return children.reduce((sum, c) => sum + countVisibleLeaves(c.id), 0);
    }

    function layout(id: string, depth: number, startLeaf: number): number {
      const node = nodes.find(n => n.id === id);
      const children = node?.collapsed ? [] : childrenOf(id);
      const x = 60 + depth * (NODE_W + 60);
      if (children.length === 0) {
        pos.set(id, { x, y: 60 + startLeaf * NODE_H });
        return startLeaf + 1;
      }
      let currentLeaf = startLeaf;
      for (const child of children) {
        currentLeaf = layout(child.id, depth + 1, currentLeaf);
      }
      const firstChild = pos.get(children[0].id)!;
      const lastChild = pos.get(children[children.length - 1].id)!;
      pos.set(id, { x, y: (firstChild.y + lastChild.y) / 2 });
      return currentLeaf;
    }

    layout(rootNode.id, 0, 0);
    return pos;
  }, [rootNode, childrenOf, layoutMode, nodes]);

  function getPos(node: MindMapNode) {
    if (layoutMode === "tree") return treePositions.get(node.id) ?? { x: node.pos_x, y: node.pos_y };
    return { x: node.pos_x, y: node.pos_y };
  }

  // ── Pointer helpers ──
  function getPointerPos(e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) {
    if ("touches" in e) {
      const t = e.touches[0] ?? (e as TouchEvent).changedTouches[0];
      return { x: t.clientX, y: t.clientY };
    }
    return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
  }

  function handlePointerDownNode(e: React.MouseEvent | React.TouchEvent, nodeId: string) {
    if (layoutMode !== "free") return;
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const p = getPointerPos(e);
    dragRef.current = { id: nodeId, startX: p.x, startY: p.y, nodeX: node.pos_x, nodeY: node.pos_y };
  }

  function handlePointerDownCanvas(e: React.MouseEvent | React.TouchEvent) {
    const target = e.target as HTMLElement;
    if (target === canvasRef.current || target.classList.contains("canvas-bg")) {
      if ("touches" in e && e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchRef.current = { startDist: Math.hypot(dx, dy), startZoom: zoom };
        return;
      }
      const p = getPointerPos(e);
      panRef.current = { startX: p.x, startY: p.y, panX: pan.x, panY: pan.y };
      setSelectedNodes(new Set());
    }
  }

  useEffect(() => {
    function handlePointerMove(e: MouseEvent | TouchEvent) {
      if (pinchRef.current && "touches" in e && e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const scale = dist / pinchRef.current.startDist;
        setZoom(Math.min(2, Math.max(0.3, pinchRef.current.startZoom * scale)));
        return;
      }
      const p = "touches" in e
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
        : { x: e.clientX, y: e.clientY };

      if (dragRef.current) {
        e.preventDefault();
        const dx = (p.x - dragRef.current.startX) / zoom;
        const dy = (p.y - dragRef.current.startY) / zoom;
        // Move all selected nodes if dragging one of them
        const draggingSelected = selectedNodes.has(dragRef.current.id) && selectedNodes.size > 1;
        setNodes(prev => prev.map(n => {
          if (n.id === dragRef.current!.id) {
            return { ...n, pos_x: dragRef.current!.nodeX + dx, pos_y: dragRef.current!.nodeY + dy };
          }
          if (draggingSelected && selectedNodes.has(n.id)) {
            return { ...n, pos_x: n.pos_x + dx * 0.01, pos_y: n.pos_y + dy * 0.01 };
          }
          return n;
        }));
      }
      if (panRef.current) {
        e.preventDefault();
        setPan({
          x: panRef.current.panX + (p.x - panRef.current.startX),
          y: panRef.current.panY + (p.y - panRef.current.startY),
        });
      }
    }

    async function handlePointerUp() {
      if (dragRef.current) {
        const node = nodes.find(n => n.id === dragRef.current!.id);
        if (node) {
          await supabase.from("mindmap_nodes").update({ pos_x: node.pos_x, pos_y: node.pos_y }).eq("id", node.id);
        }
        dragRef.current = null;
      }
      panRef.current = null;
      pinchRef.current = null;
    }

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchmove", handlePointerMove, { passive: false });
    window.addEventListener("touchend", handlePointerUp);
    window.addEventListener("touchcancel", handlePointerUp);
    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);
      window.removeEventListener("touchcancel", handlePointerUp);
    };
  }, [nodes, zoom, supabase, selectedNodes]);

  // ── Node operations ──
  function pushUndo() {
    setUndoStack(prev => [...prev.slice(-20), [...nodes]]);
    setRedoStack([]);
  }

  async function addChild(parentId: string) {
    pushUndo();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const parent = nodes.find(n => n.id === parentId);
    const siblings = childrenOf(parentId);
    // Uncollapse parent if collapsed
    if (parent?.collapsed) {
      await supabase.from("mindmap_nodes").update({ collapsed: false }).eq("id", parentId);
    }
    const { data } = await supabase.from("mindmap_nodes").insert({
      user_id: user.id,
      mindmap_id: map.id,
      parent_id: parentId,
      label: "",
      color: parent?.color ?? map.color,
      pos_x: (parent?.pos_x ?? 200) + 220,
      pos_y: (parent?.pos_y ?? 50) + siblings.length * 60,
      sort_order: siblings.length,
    }).select().single();
    if (data) {
      await supabase.from("mindmaps").update({ updated_at: new Date().toISOString() }).eq("id", map.id);
      await fetchNodes();
      // Start inline editing immediately
      setInlineEditId(data.id);
      setInlineEditText("");
      setSelectedNodes(new Set([data.id]));
    }
  }

  async function addSibling(nodeId: string) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node?.parent_id) return; // Can't add sibling to root
    pushUndo();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const siblings = childrenOf(node.parent_id);
    const { data } = await supabase.from("mindmap_nodes").insert({
      user_id: user.id,
      mindmap_id: map.id,
      parent_id: node.parent_id,
      label: "",
      color: node.color,
      pos_x: node.pos_x,
      pos_y: node.pos_y + 60,
      sort_order: siblings.length,
    }).select().single();
    if (data) {
      await supabase.from("mindmaps").update({ updated_at: new Date().toISOString() }).eq("id", map.id);
      await fetchNodes();
      setInlineEditId(data.id);
      setInlineEditText("");
      setSelectedNodes(new Set([data.id]));
    }
  }

  async function deleteNode(id: string) {
    const node = nodes.find(n => n.id === id);
    if (!node?.parent_id) return;
    pushUndo();
    await supabase.from("mindmap_nodes").delete().eq("id", id);
    setSelectedNodes(prev => { const next = new Set(prev); next.delete(id); return next; });
    setEditNode(null);
    setInlineEditId(null);
    fetchNodes();
  }

  async function deleteSelected() {
    if (selectedNodes.size === 0) return;
    pushUndo();
    const idsToDelete = Array.from(selectedNodes);
    for (const id of idsToDelete) {
      const node = nodes.find(n => n.id === id);
      if (node?.parent_id) {
        await supabase.from("mindmap_nodes").delete().eq("id", id);
      }
    }
    setSelectedNodes(new Set());
    fetchNodes();
  }

  async function toggleCollapse(id: string) {
    pushUndo();
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    const newCollapsed = !node.collapsed;
    setNodes(prev => prev.map(n => n.id === id ? { ...n, collapsed: newCollapsed } : n));
    await supabase.from("mindmap_nodes").update({ collapsed: newCollapsed }).eq("id", id);
  }

  async function handleInlineEditSubmit(id: string) {
    pushUndo();
    const text = inlineEditText.trim() || t("mindmaps.newNode");
    setInlineEditId(null);
    setNodes(prev => prev.map(n => n.id === id ? { ...n, label: text } : n));
    await supabase.from("mindmap_nodes").update({ label: text }).eq("id", id);
    await supabase.from("mindmaps").update({ updated_at: new Date().toISOString() }).eq("id", map.id);
  }

  async function undoLast() {
    if (undoStack.length === 0) return;
    setRedoStack(prev => [...prev.slice(-20), [...nodes]]);
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    setNodes(prev);
    // Re-sync to DB (simplified: save all positions)
    for (const n of prev) {
      await supabase.from("mindmap_nodes").update({ label: n.label, pos_x: n.pos_x, pos_y: n.pos_y, collapsed: n.collapsed, color: n.color, icon: n.icon, notes: n.notes }).eq("id", n.id);
    }
  }

  async function redoLast() {
    if (redoStack.length === 0) return;
    setUndoStack(prev => [...prev.slice(-20), [...nodes]]);
    const next = redoStack[redoStack.length - 1];
    setRedoStack(s => s.slice(0, -1));
    setNodes(next);
    next.forEach(n => {
      supabase.from("mindmap_nodes").upsert({
        id: n.id, map_id: map.id, label: n.label,
        pos_x: n.pos_x, pos_y: n.pos_y, collapsed: n.collapsed,
        color: n.color, icon: n.icon, notes: n.notes,
      }).then();
    });
  }

  async function toggleLayout() {
    const newMode = layoutMode === "tree" ? "free" : "tree";
    setLayoutMode(newMode);
    await supabase.from("mindmaps").update({ layout_mode: newMode }).eq("id", map.id);
  }

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture when editing inline or in a modal
      if (inlineEditId || editNode) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const sel = primarySelected;

      switch (e.key) {
        case "Tab": // Tab = add child
          e.preventDefault();
          if (sel) addChild(sel.id);
          break;
        case "Enter": // Enter = add sibling
          e.preventDefault();
          if (sel) addSibling(sel.id);
          break;
        case "F2": // F2 = inline edit
        case " ": // Space = inline edit
          e.preventDefault();
          if (sel) {
            setInlineEditId(sel.id);
            setInlineEditText(sel.label);
          }
          break;
        case "Delete":
        case "Backspace":
          if (sel && sel.parent_id) {
            e.preventDefault();
            if (selectedNodes.size > 1) deleteSelected();
            else deleteNode(sel.id);
          }
          break;
        case "Escape":
          setSelectedNodes(new Set());
          setShowSearch(false);
          setFocusNodeId(null);
          break;
        case "ArrowDown": {
          e.preventDefault();
          if (!sel) { if (rootNode) setSelectedNodes(new Set([rootNode.id])); break; }
          const siblings = sel.parent_id ? childrenOf(sel.parent_id) : [sel];
          const idx = siblings.findIndex(s => s.id === sel.id);
          if (idx < siblings.length - 1) setSelectedNodes(new Set([siblings[idx + 1].id]));
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          if (!sel) break;
          const siblings = sel.parent_id ? childrenOf(sel.parent_id) : [sel];
          const idx = siblings.findIndex(s => s.id === sel.id);
          if (idx > 0) setSelectedNodes(new Set([siblings[idx - 1].id]));
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          if (!sel) break;
          const children = childrenOf(sel.id);
          if (sel.collapsed) { toggleCollapse(sel.id); }
          else if (children.length > 0) setSelectedNodes(new Set([children[0].id]));
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          if (!sel) break;
          if (childrenOf(sel.id).length > 0 && !sel.collapsed) { toggleCollapse(sel.id); }
          else if (sel.parent_id) setSelectedNodes(new Set([sel.parent_id]));
          break;
        }
        case "f":
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); setShowSearch(true); }
          else if (sel) { setFocusNodeId(focusNodeId === sel.id ? null : sel.id); }
          break;
        case "z":
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); undoLast(); }
          break;
        case "y":
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); redoLast(); }
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primarySelected, inlineEditId, editNode, nodes, focusNodeId, selectedNodes]);

  // Auto-focus inline input
  useEffect(() => {
    if (inlineEditId) {
      setTimeout(() => inlineInputRef.current?.focus(), 50);
    }
  }, [inlineEditId]);

  // Canvas size
  const canvasW = useMemo(() => {
    const maxX = Math.max(800, ...visibleNodes.map(n => getPos(n).x + 240));
    return maxX + 200;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleNodes, treePositions, layoutMode]);
  const canvasH = useMemo(() => {
    const maxY = Math.max(500, ...visibleNodes.map(n => getPos(n).y + 80));
    return maxY + 200;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleNodes, treePositions, layoutMode]);

  // Auto-fit on initial load
  const hasAutoFit = useRef(false);
  useEffect(() => {
    if (loading || nodes.length === 0 || hasAutoFit.current) return;
    hasAutoFit.current = true;
    const container = canvasRef.current;
    if (!container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const p = getPos(n);
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + 200);
      maxY = Math.max(maxY, p.y + 50);
    }
    const contentW = maxX - minX + 100;
    const contentH = maxY - minY + 100;
    const fitZoom = Math.min(cw / contentW, ch / contentH, 1);
    if (fitZoom < 0.95) {
      const clampedZoom = Math.max(0.3, Math.min(1, fitZoom * 0.9));
      setZoom(clampedZoom);
      setPan({
        x: (cw - contentW * clampedZoom) / 2 - minX * clampedZoom + 40,
        y: (ch - contentH * clampedZoom) / 2 - minY * clampedZoom + 40,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, nodes]);

  // ── Export functions ──
  async function exportPNG() {
    const el = document.getElementById("mindmap-canvas");
    if (!el) return;
    try {
      // Load html2canvas from CDN if not already loaded
      if (!(window as any).html2canvas) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
          s.onload = () => resolve();
          s.onerror = () => reject();
          document.head.appendChild(s);
        });
      }
      const h2c = (window as any).html2canvas;
      if (!h2c) { alert(t("mindmaps.exportFailed")); return; }
      const canvas = await h2c(el, { scale: 2, backgroundColor: "#f8fafc", useCORS: true });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${map.title}.png`;
      a.click();
    } catch {
      alert(t("mindmaps.exportFailed"));
    }
  }

  async function exportJSON() {
    const data = { map, nodes };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${map.title}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportMarkdown() {
    let md = `# ${map.title}\n\n`;
    function walk(parentId: string | null, depth: number) {
      const children = parentId ? childrenOf(parentId) : nodes.filter(n => !n.parent_id);
      for (const n of children) {
        const indent = "  ".repeat(depth);
        md += `${indent}- **${n.label}**`;
        if (n.notes) md += `\n${indent}  ${n.notes}`;
        md += "\n";
        walk(n.id, depth + 1);
      }
    }
    walk(null, 0);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${map.title}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-surface-100 shrink-0 overflow-x-auto">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-brand-600 shrink-0">
          <ArrowLeft size={16} /> {t("mindmaps.back")}
        </button>
        <div className="w-px h-5 bg-surface-200" />
        <h2 className="font-semibold text-surface-900 text-sm truncate">{map.title}</h2>
        <div className="flex-1" />

        {/* Focus mode indicator */}
        {focusNodeId && (
          <button onClick={() => setFocusNodeId(null)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-700 shrink-0">
            <Eye size={12} /> {t("mindmaps.focusMode")}
            <X size={10} />
          </button>
        )}

        <button onClick={toggleLayout}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface-100 hover:bg-brand-100 text-surface-600 hover:text-brand-700 transition-colors shrink-0">
          {layoutMode === "tree" ? <><GitBranch size={12} /> {t("mindmaps.layoutTree")}</> : <><Move size={12} /> {t("mindmaps.layoutFree")}</>}
        </button>

        <button onClick={() => setShowGrid(g => !g)}
          className={`p-1.5 rounded-lg text-xs transition-colors shrink-0 ${showGrid ? "bg-brand-50 text-brand-700" : "bg-surface-100 text-surface-500"}`}
          title={showGrid ? t("mindmaps.hideGrid") : t("mindmaps.showGrid")}>
          <LayoutGrid size={14} />
        </button>

        <button onClick={() => setShowSearch(s => !s)}
          className={`p-1.5 rounded-lg text-xs transition-colors shrink-0 ${showSearch ? "bg-brand-50 text-brand-700" : "bg-surface-100 text-surface-500"}`}
          title="Ctrl+F">
          <Search size={14} />
        </button>

        {undoStack.length > 0 && (
          <button onClick={undoLast} className="p-1.5 rounded-lg bg-surface-100 text-surface-500 hover:bg-surface-200 shrink-0" title="Ctrl+Z">
            <Undo2 size={14} />
          </button>
        )}

        <button onClick={redoLast} disabled={redoStack.length === 0} className="p-1.5 rounded-lg bg-surface-100 text-surface-500 hover:bg-surface-200 disabled:opacity-30 transition" title="Redo (Ctrl+Y)">
          <Undo2 size={14} className="transform scale-x-[-1]" />
        </button>

        <div className="w-px h-5 bg-surface-200" />

        {/* Export dropdown */}
        <div className="relative group/export shrink-0">
          <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface-100 text-surface-600 hover:bg-surface-200">
            <Download size={12} /> {t("mindmaps.export") || "Export"}
          </button>
          <div className="absolute right-0 top-full mt-1 bg-white border border-surface-200 rounded-xl shadow-lg py-1 w-40 opacity-0 invisible group-hover/export:opacity-100 group-hover/export:visible transition-all z-20">
            <button onClick={exportPNG} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-700 hover:bg-surface-50">
              <Image size={12} /> PNG
            </button>
            <button onClick={exportMarkdown} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-700 hover:bg-surface-50">
              <FileText size={12} /> Markdown
            </button>
            <button onClick={exportJSON} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-700 hover:bg-surface-50">
              <FileText size={12} /> JSON
            </button>
          </div>
        </div>

        <div className="flex items-center gap-0.5 bg-surface-100 rounded-lg px-1 shrink-0">
          <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="p-1 hover:bg-surface-200 rounded"><ZoomOut size={13} /></button>
          <span className="text-[10px] text-surface-500 w-8 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1 hover:bg-surface-200 rounded"><ZoomIn size={13} /></button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-1 hover:bg-surface-200 rounded"><Maximize2 size={13} /></button>
        </div>

        <button onClick={() => setShowKeyboardHelp(true)} className="p-1.5 rounded-lg bg-surface-100 text-surface-500 hover:bg-surface-200 shrink-0" title={t("mindmaps.shortcuts")}>
          <Keyboard size={14} />
        </button>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 shrink-0">
          <Search size={14} className="text-amber-600" />
          <input
            autoFocus
            className="flex-1 bg-transparent text-sm outline-none text-surface-800 placeholder:text-amber-400"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t("mindmaps.searchPlaceholder")}
            onKeyDown={e => { if (e.key === "Escape") { setShowSearch(false); setSearchQuery(""); } }}
          />
          {searchMatches.size > 0 && (
            <span className="text-xs text-amber-700 font-medium">{searchMatches.size} {t("mindmaps.found")}</span>
          )}
          <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} className="p-1 rounded hover:bg-amber-200 text-amber-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Canvas */}
      <div
        className="flex-1 overflow-hidden relative"
        style={{
          touchAction: "none",
          backgroundColor: "#f8fafc",
          ...(showGrid ? {
            backgroundImage: "radial-gradient(circle, #cbd5e1 0.8px, transparent 0.8px)",
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
            backgroundPosition: `${pan.x % (24 * zoom)}px ${pan.y % (24 * zoom)}px`,
          } : {}),
        }}
        onMouseDown={handlePointerDownCanvas}
        onTouchStart={handlePointerDownCanvas}
        onWheel={e => {
          e.preventDefault();
          const delta = e.deltaY > 0 ? -0.05 : 0.05;
          setZoom(z => Math.min(2, Math.max(0.3, z + delta)));
        }}
        ref={canvasRef}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full text-surface-400">{t("mindmaps.loading")}</div>
        ) : (
          <div
            id="mindmap-canvas"
            className="canvas-bg"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              width: canvasW,
              height: canvasH,
              position: "relative",
              overflow: "visible",
            }}
          >
            {/* SVG connections */}
            <svg className="absolute inset-0 pointer-events-none" style={{ overflow: "visible" }} width={canvasW} height={canvasH}>
              {visibleNodes.filter(n => n.parent_id).map(n => {
                const parent = visibleNodes.find(p => p.id === n.parent_id);
                if (!parent) return null;
                // Don't draw connections to collapsed children
                if (parent.collapsed && parent.id !== focusNodeId) return null;
                const from = getPos(parent);
                const to = getPos(n);
                const NODE_W = 160;
                const isHighlighted = searchMatches.has(n.id) || searchMatches.has(parent.id);
                return (
                  <path
                    key={n.id}
                    d={`M${from.x + NODE_W} ${from.y + 20} C${from.x + NODE_W + 40} ${from.y + 20}, ${to.x - 40} ${to.y + 20}, ${to.x} ${to.y + 20}`}
                    fill="none"
                    stroke={isHighlighted ? "#f59e0b" : (n.color || "#d1d5db")}
                    strokeWidth={isHighlighted ? 3 : 2}
                    strokeOpacity={isHighlighted ? 0.8 : 0.4}
                  />
                );
              })}
            </svg>

            {/* Nodes */}
            {visibleNodes.map(n => {
              const pos = getPos(n);
              const isRoot = !n.parent_id;
              const isSelected = selectedNodes.has(n.id);
              const children = childrenOf(n.id);
              const hasChildren = children.length > 0;
              const isSearchMatch = searchMatches.has(n.id);
              const isInlineEditing = inlineEditId === n.id;

              return (
                <div
                  key={n.id}
                  className={`absolute select-none ${layoutMode === "free" ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                  style={{
                    left: pos.x, top: pos.y, zIndex: isSelected ? 10 : 1,
                    opacity: searchQuery && !isSearchMatch && searchMatches.size > 0 ? 0.3 : 1,
                    transition: "opacity 0.2s",
                  }}
                  onMouseDown={(e) => handlePointerDownNode(e, n.id)}
                  onTouchStart={(e) => handlePointerDownNode(e, n.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (e.ctrlKey || e.metaKey) {
                      // Multi-select with Ctrl/Cmd
                      setSelectedNodes(prev => {
                        const next = new Set(prev);
                        if (next.has(n.id)) next.delete(n.id);
                        else next.add(n.id);
                        return next;
                      });
                    } else {
                      setSelectedNodes(new Set([n.id]));
                    }
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setInlineEditId(n.id);
                    setInlineEditText(n.label);
                  }}
                >
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 bg-white shadow-sm transition-all min-w-[100px] max-w-[220px] ${
                    isSelected ? "ring-2 ring-brand-400 border-brand-300" :
                    isSearchMatch ? "ring-2 ring-amber-400 border-amber-300" :
                    "border-surface-200 hover:border-surface-300"
                  } ${isRoot ? "border-l-4" : ""}`}
                    style={isRoot ? { borderLeftColor: n.color } : {}}
                  >
                    {/* Collapse toggle */}
                    {hasChildren && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleCollapse(n.id); }}
                        className="text-surface-400 hover:text-surface-600 shrink-0 -ml-1"
                      >
                        {n.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                      </button>
                    )}

                    {n.icon && <span className="text-sm shrink-0">{n.icon}</span>}

                    {isInlineEditing ? (
                      <input
                        ref={inlineInputRef}
                        className="text-sm font-medium text-surface-800 bg-transparent outline-none border-none flex-1 min-w-[60px]"
                        value={inlineEditText}
                        onChange={e => setInlineEditText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") { e.preventDefault(); handleInlineEditSubmit(n.id); }
                          if (e.key === "Escape") { setInlineEditId(null); }
                          if (e.key === "Tab") { e.preventDefault(); handleInlineEditSubmit(n.id); addChild(n.id); }
                        }}
                        onBlur={() => handleInlineEditSubmit(n.id)}
                      />
                    ) : (
                      <span className={`text-sm truncate ${isRoot ? "font-semibold" : "font-medium"} text-surface-800`}>
                        {n.label || t("mindmaps.newNode")}
                      </span>
                    )}

                    {n.notes && <StickyNote size={10} className="text-amber-400 shrink-0" />}
                    {(n.links?.length ?? 0) > 0 && <Link2 size={10} className="text-blue-400 shrink-0" />}
                    {n.collapsed && hasChildren && (
                      <span className="text-[9px] bg-surface-200 text-surface-500 px-1 rounded-full shrink-0">{children.length}</span>
                    )}
                  </div>

                  {/* Quick actions on select */}
                  {isSelected && !isInlineEditing && (
                    <div className="flex gap-0.5 mt-1 justify-center">
                      <button onClick={(e) => { e.stopPropagation(); addChild(n.id); }}
                        className="p-1 rounded bg-brand-600 text-white hover:bg-brand-700" title="Tab">
                        <Plus size={11} />
                      </button>
                      {!isRoot && (
                        <button onClick={(e) => { e.stopPropagation(); addSibling(n.id); }}
                          className="p-1 rounded bg-brand-100 text-brand-700 hover:bg-brand-200" title="Enter">
                          <CornerDownRight size={11} />
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); setEditNode(n); }}
                        className="p-1 rounded bg-surface-200 text-surface-600 hover:bg-surface-300" title="Space">
                        <Pencil size={11} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setFocusNodeId(focusNodeId === n.id ? null : n.id); }}
                        className={`p-1 rounded ${focusNodeId === n.id ? "bg-amber-200 text-amber-700" : "bg-surface-200 text-surface-600 hover:bg-surface-300"}`} title="F">
                        {focusNodeId === n.id ? <EyeOff size={11} /> : <Eye size={11} />}
                      </button>
                      {!isRoot && (
                        <button onClick={(e) => { e.stopPropagation(); deleteNode(n.id); }}
                          className="p-1 rounded bg-red-100 text-red-500 hover:bg-red-200" title="Del">
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Node edit modal */}
      {editNode && (
        <NodeEditModal
          node={editNode}
          isRoot={!editNode.parent_id}
          onClose={() => { setEditNode(null); fetchNodes(); }}
          onSave={async (updates) => {
            await supabase.from("mindmap_nodes").update(updates).eq("id", editNode.id);
            await supabase.from("mindmaps").update({ updated_at: new Date().toISOString() }).eq("id", map.id);
            fetchNodes();
            setEditNode(null);
          }}
          onDelete={async () => {
            await deleteNode(editNode.id);
          }}
        />
      )}

      {/* Keyboard shortcuts help */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowKeyboardHelp(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-surface-900">{t("mindmaps.shortcuts")}</h2>
              <button onClick={() => setShowKeyboardHelp(false)} className="p-1.5 rounded-lg hover:bg-surface-100"><X size={16} /></button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ["Tab", t("mindmaps.shortcutChild")],
                ["Enter", t("mindmaps.shortcutSibling")],
                ["Space / F2", t("mindmaps.shortcutEdit")],
                ["Delete", t("mindmaps.shortcutDelete")],
                ["←→↑↓", t("mindmaps.shortcutNavigate")],
                ["← (collapsed)", t("mindmaps.shortcutCollapse")],
                ["→ (collapsed)", t("mindmaps.shortcutExpand")],
                ["F", t("mindmaps.shortcutFocus")],
                ["Ctrl+F", t("mindmaps.shortcutSearch")],
                ["Ctrl+Z", t("mindmaps.shortcutUndo")],
                ["Ctrl/Cmd+Click", t("mindmaps.shortcutMultiSelect")],
                ["Esc", t("mindmaps.shortcutEscape")],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center gap-3">
                  <kbd className="px-2 py-0.5 bg-surface-100 rounded text-xs font-mono text-surface-600 min-w-[80px] text-center">{key}</kbd>
                  <span className="text-surface-600">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Node Edit Modal ──────────────────────────────────────────────────
function NodeEditModal({ node, isRoot, onClose, onSave, onDelete }: {
  node: MindMapNode;
  isRoot: boolean;
  onClose: () => void;
  onSave: (updates: Partial<MindMapNode>) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [label, setLabel] = useState(node.label);
  const [notes, setNotes] = useState(node.notes ?? "");
  const [color, setColor] = useState(node.color);
  const [icon, setIcon] = useState(node.icon ?? "");
  const [links, setLinks] = useState<{ label: string; url: string }[]>(node.links ?? []);
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkLabel, setNewLinkLabel] = useState("");

  function addLink() {
    if (!newLinkUrl.trim()) return;
    const url = newLinkUrl.trim().startsWith("http") ? newLinkUrl.trim() : `https://${newLinkUrl.trim()}`;
    setLinks([...links, { label: newLinkLabel.trim() || url, url }]);
    setNewLinkUrl("");
    setNewLinkLabel("");
  }

  function removeLink(i: number) {
    setLinks(links.filter((_, idx) => idx !== i));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-surface-100">
          <h2 className="font-semibold text-surface-900">{t("mindmaps.editNode")}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{t("mindmaps.nodeLabel")}</label>
            <input className="input" value={label} onChange={e => setLabel(e.target.value)} autoFocus />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">{t("mindmaps.nodeIcon")}</label>
            <div className="flex gap-1.5 flex-wrap">
              {NODE_ICONS.map(ic => (
                <button key={ic} type="button" onClick={() => setIcon(ic)}
                  className={`w-8 h-8 rounded-lg text-sm flex items-center justify-center border-2 transition-colors ${
                    icon === ic ? "border-brand-500 bg-brand-50" : "border-surface-200 hover:border-surface-300"
                  }`}>
                  {ic || "—"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">{t("mindmaps.color")}</label>
            <div className="flex gap-1.5 flex-wrap">
              {NODE_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? "border-surface-800 scale-110" : "border-transparent"}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{t("mindmaps.nodeNotes")}</label>
            <textarea className="input resize-none text-sm" rows={3} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder={t("mindmaps.placeholder")} />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">{t("mindmaps.nodeLinks")}</label>
            {links.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {links.map((l, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-surface-50 rounded-lg text-xs">
                    <Link2 size={12} className="text-blue-500 shrink-0" />
                    <span className="flex-1 truncate text-surface-700">{l.label}</span>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                      <ExternalLink size={12} />
                    </a>
                    <button onClick={() => removeLink(i)} className="text-surface-400 hover:text-red-500">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-1.5">
              <input className="input flex-1 text-xs" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)}
                placeholder="https://..." onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addLink())} />
              <input className="input w-28 text-xs" value={newLinkLabel} onChange={e => setNewLinkLabel(e.target.value)}
                placeholder={t("mindmaps.linkTitle")} />
              <button onClick={addLink} className="px-2 py-1 rounded-lg bg-brand-600 text-white text-xs hover:bg-brand-700">+</button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            {!isRoot && (
              <button onClick={onDelete} className="px-3 py-2 rounded-xl border border-red-200 text-red-600 text-sm hover:bg-red-50">
                {t("mindmaps.delete")}
              </button>
            )}
            <div className="flex-1" />
            <button onClick={onClose} className="btn-secondary">{t("mindmaps.cancel")}</button>
            <button
              onClick={() => onSave({ label, notes: notes || null, color, icon: icon || null, links })}
              className="btn-primary gap-1.5"
            >
              <Save size={14} /> {t("mindmaps.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
