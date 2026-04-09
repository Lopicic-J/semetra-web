"use client";
import { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from "react";
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
  CornerDownRight, ArrowRight, Undo2, CheckSquare, Square, Upload
} from "lucide-react";
import type { MindMap, MindMapNode, CalendarEvent, Task } from "@/types/database";
import { useTranslation } from "@/lib/i18n";
import { useTheme } from "@/components/providers/ThemeProvider";
import { nodeGradient, DK, dk } from "@/lib/design-tokens";

const NODE_COLORS = [
  "#6d28d9","#2563eb","#059669","#dc2626","#d97706",
  "#db2777","#0891b2","#7c3aed","#16a34a","#ea580c",
  "#6366f1","#0d9488","#f59e0b","#ef4444","#8b5cf6",
];

const NODE_ICONS = ["", "💡","📌","⭐","🔥","✅","❓","📖","🎯","⚠️","💎","🧩","🔬","📝","🏗️","🧪"];

const TEXT_COLORS = [
  null,        // Standard (surface-900 — schwarz/weiss je nach mode)
  "#000000",   // Schwarz
  "#ffffff",   // Weiss
  "#1e293b",   // Slate 800
  "#475569",   // Slate 600
  "#6d28d9",   // Violet
  "#2563eb",   // Blue
  "#059669",   // Emerald
  "#dc2626",   // Red
  "#d97706",   // Amber
  "#db2777",   // Pink
  "#0891b2",   // Cyan
];

// ─── Main Page ────────────────────────────────────────────────────────
export default function MindMapsPage() {
  const { t } = useTranslation();
  const supabase = createClient();
  const { modules } = useModules();
  const { isPro } = useProfile();
  const { resolvedMode } = useTheme();
  const isDark = resolvedMode === "dark";
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
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
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
      <div className="bg-surface-100 rounded-2xl shadow-xl w-full max-w-md">
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

// ─── Mind Map Editor ────────────────────────────────────────────────────
function MindMapEditor({ map, modules, onBack }: {
  map: MindMap; modules: any[]; onBack: () => void;
}) {
  const { t } = useTranslation();
  const supabase = createClient();
  const { resolvedMode } = useTheme();
  const isDark = resolvedMode === "dark";
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
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showExport, setShowExport] = useState(false);
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

  // Close export dropdown when clicking outside (use mousedown + skip first frame)
  const exportOpenedRef = useRef(false);
  const exportBtnRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showExport) { exportOpenedRef.current = false; return; }
    // Skip the first frame so the opening click doesn't immediately close
    requestAnimationFrame(() => { exportOpenedRef.current = true; });
    function handleClickOutside(e: MouseEvent) {
      if (!exportOpenedRef.current) return;
      const target = e.target as HTMLElement;
      if (!target.closest('.export-dropdown')) {
        setShowExport(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExport]);

  // Build tree helpers
  const rootNode = useMemo(() => nodes.find(n => !n.parent_id), [nodes]);
  const childrenOf = useCallback((parentId: string) =>
    nodes.filter(n => n.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order),
  [nodes]);

  // Visible nodes (focus mode or all)
  const visibleNodes = useMemo(() => {
    // Build set of visible nodes: exclude descendants of collapsed nodes
    const hidden = new Set<string>();
    function markHidden(parentId: string) {
      childrenOf(parentId).forEach(c => {
        hidden.add(c.id);
        markHidden(c.id);
      });
    }
    // Find all collapsed nodes and hide their descendants
    nodes.forEach(n => {
      if (n.collapsed) markHidden(n.id);
    });

    let result = nodes.filter(n => !hidden.has(n.id));

    // If focus mode, further filter to only focus subtree + ancestors
    if (focusNodeId) {
      const visible = new Set<string>();
      const walk = (id: string): void => {
        visible.add(id);
        const node = nodes.find(nn => nn.id === id);
        if (node?.collapsed) return; // Don't walk into collapsed
        childrenOf(id).forEach(c => walk(c.id));
      }
      walk(focusNodeId);
      let current = nodes.find(n => n.id === focusNodeId);
      while (current?.parent_id) {
        visible.add(current.parent_id);
        current = nodes.find(n => n.id === current!.parent_id);
      }
      result = result.filter(n => visible.has(n.id));
    }

    return result;
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

  // Selected node (primary)
  const primarySelected = useMemo(() => {
    const first = selectedNodes.values().next().value;
    return first ? nodes.find(n => n.id === first) : null;
  }, [selectedNodes, nodes]);

  // Auto-layout tree positions with improved spacing
  const treePositions = useMemo(() => {
    if (layoutMode !== "tree" || !rootNode) return new Map<string, { x: number; y: number }>();
    const pos = new Map<string, { x: number; y: number }>();
    const NODE_W = 200;
    const NODE_H = 64;
    const HORIZONTAL_GAP = 80;
    const VERTICAL_GAP = 40;

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
      const x = 80 + depth * (NODE_W + HORIZONTAL_GAP);
      if (children.length === 0) {
        pos.set(id, { x, y: 100 + startLeaf * (NODE_H + VERTICAL_GAP) });
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

  // Generate SVG path for connections with proper edge detection
  // Measure actual node dimensions from DOM for accurate connections
  const nodeDimsRef = useRef<Map<string, { w: number; h: number }>>(new Map());
  const [dimsTick, setDimsTick] = useState(0);

  // Use useLayoutEffect to measure BEFORE paint, then trigger one re-render
  // so SVG paths use accurate dimensions
  useLayoutEffect(() => {
    const canvas = document.getElementById("mindmap-canvas");
    if (!canvas) return;
    const nodeEls = canvas.querySelectorAll("[data-nodeid]");
    let changed = false;
    nodeEls.forEach(el => {
      const id = el.getAttribute("data-nodeid");
      if (id) {
        const box = el.querySelector(".node-box");
        if (box) {
          const rect = box.getBoundingClientRect();
          const z = zoom || 1;
          const newW = Math.round(rect.width / z);
          const newH = Math.round(rect.height / z);
          const prev = nodeDimsRef.current.get(id);
          if (!prev || prev.w !== newW || prev.h !== newH) {
            nodeDimsRef.current.set(id, { w: newW, h: newH });
            changed = true;
          }
        }
      }
    });
    if (changed) {
      setDimsTick(t => t + 1);
    }
  });

  function getNodeDims(nodeId: string) {
    // dimsTick dependency ensures this is called after measurement
    void dimsTick;
    return nodeDimsRef.current.get(nodeId) ?? { w: 180, h: 48 };
  }

  function generateConnectionPath(parentId: string, childId: string, from: { x: number; y: number }, to: { x: number; y: number }) {
    const parentDims = getNodeDims(parentId);
    const childDims = getNodeDims(childId);

    // Parent center & child center
    const pcx = from.x + parentDims.w / 2;
    const pcy = from.y + parentDims.h / 2;
    const ccx = to.x + childDims.w / 2;
    const ccy = to.y + childDims.h / 2;

    const dx = ccx - pcx;
    const dy = ccy - pcy;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    let fromPoint: { x: number; y: number };
    let toPoint: { x: number; y: number };

    if (layoutMode === "tree") {
      // Tree: always right→left
      if (dx > 0) {
        fromPoint = { x: from.x + parentDims.w, y: pcy };
        toPoint = { x: to.x, y: ccy };
      } else {
        fromPoint = { x: from.x, y: pcy };
        toPoint = { x: to.x + childDims.w, y: ccy };
      }
    } else {
      // Free mode: pick best exit/entry edges based on angle
      const angle = Math.atan2(dy, dx);
      const PI = Math.PI;

      // Parent exit point
      if (angle > -PI/4 && angle <= PI/4) {
        // → right
        fromPoint = { x: from.x + parentDims.w, y: pcy };
      } else if (angle > PI/4 && angle <= 3*PI/4) {
        // ↓ bottom
        fromPoint = { x: pcx, y: from.y + parentDims.h };
      } else if (angle > -3*PI/4 && angle <= -PI/4) {
        // ↑ top
        fromPoint = { x: pcx, y: from.y };
      } else {
        // ← left
        fromPoint = { x: from.x, y: pcy };
      }

      // Child entry point (opposite side)
      const revAngle = Math.atan2(-dy, -dx);
      if (revAngle > -PI/4 && revAngle <= PI/4) {
        toPoint = { x: to.x + childDims.w, y: ccy };
      } else if (revAngle > PI/4 && revAngle <= 3*PI/4) {
        toPoint = { x: ccx, y: to.y + childDims.h };
      } else if (revAngle > -3*PI/4 && revAngle <= -PI/4) {
        toPoint = { x: ccx, y: to.y };
      } else {
        toPoint = { x: to.x, y: ccy };
      }
    }

    // Smooth cubic Bezier — control points follow the exit/entry direction
    const dist = Math.hypot(toPoint.x - fromPoint.x, toPoint.y - fromPoint.y);
    const tension = Math.max(30, dist * 0.4);

    // Determine control point direction from exit/entry edges
    const fromIsHoriz = fromPoint.y === pcy;
    const toIsHoriz = toPoint.y === ccy;

    const ctrl1 = fromIsHoriz
      ? { x: fromPoint.x + (dx > 0 ? tension : -tension), y: fromPoint.y }
      : { x: fromPoint.x, y: fromPoint.y + (dy > 0 ? tension : -tension) };

    const ctrl2 = toIsHoriz
      ? { x: toPoint.x + (dx > 0 ? -tension : tension), y: toPoint.y }
      : { x: toPoint.x, y: toPoint.y + (dy > 0 ? -tension : tension) };

    return `M${fromPoint.x} ${fromPoint.y} C${ctrl1.x} ${ctrl1.y}, ${ctrl2.x} ${ctrl2.y}, ${toPoint.x} ${toPoint.y}`;
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
  }, [nodes, zoom, supabase, selectedNodes, layoutMode]);

  // ── Node operations ──
  function pushUndo() {
    setUndoStack(prev => [...prev.slice(-20), [...nodes]]);
    setRedoStack([]);
  }

  async function addChild(parentId: string, direction: "right" | "left" | "top" | "bottom" = "right") {
    pushUndo();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const parent = nodes.find(n => n.id === parentId);
    const siblings = childrenOf(parentId);
    if (parent?.collapsed) {
      await supabase.from("mindmap_nodes").update({ collapsed: false }).eq("id", parentId);
    }

    const baseX = parent?.pos_x ?? 200;
    const baseY = parent?.pos_y ?? 50;
    const offsets = {
      right: { x: baseX + 220, y: baseY + siblings.length * 60 },
      left: { x: baseX - 220, y: baseY + siblings.length * 60 },
      top: { x: baseX + siblings.length * 200, y: baseY - 120 },
      bottom: { x: baseX + siblings.length * 200, y: baseY + 120 },
    };
    const pos = offsets[direction];

    const { data } = await supabase.from("mindmap_nodes").insert({
      user_id: user.id,
      mindmap_id: map.id,
      parent_id: parentId,
      label: "",
      color: parent?.color ?? map.color,
      pos_x: pos.x,
      pos_y: pos.y,
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

  async function addSibling(nodeId: string) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node?.parent_id) return;
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
    for (const n of prev) {
      await supabase.from("mindmap_nodes").update({ label: n.label, pos_x: n.pos_x, pos_y: n.pos_y, collapsed: n.collapsed, color: n.color, text_color: n.text_color, icon: n.icon, notes: n.notes }).eq("id", n.id);
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
        color: n.color, text_color: n.text_color, icon: n.icon, notes: n.notes,
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
      if (inlineEditId || editNode) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const sel = primarySelected;

      switch (e.key) {
        case "Tab":
          e.preventDefault();
          if (sel) addChild(sel.id);
          break;
        case "Enter":
          e.preventDefault();
          if (sel) addSibling(sel.id);
          break;
        case "F2":
        case " ":
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
    const maxX = Math.max(800, ...visibleNodes.map(n => getPos(n).x + 400));
    return maxX + 300;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleNodes, treePositions, layoutMode]);
  const canvasH = useMemo(() => {
    const maxY = Math.max(500, ...visibleNodes.map(n => getPos(n).y + 150));
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
      maxY = Math.max(maxY, p.y + 64);
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

      // 1. Walk ALL ancestors and temporarily remove overflow clipping
      const ancestors: { el: HTMLElement; orig: string }[] = [];
      let parent = el.parentElement;
      while (parent && parent !== document.body) {
        const cs = getComputedStyle(parent);
        if (cs.overflow !== "visible" || cs.overflowX !== "visible" || cs.overflowY !== "visible") {
          ancestors.push({ el: parent, orig: parent.style.overflow });
          parent.style.overflow = "visible";
        }
        parent = parent.parentElement;
      }

      // 2. Save original canvas styles
      const origTransform = el.style.transform;
      const origOrigin = el.style.transformOrigin;
      const origWidth = el.style.width;
      const origHeight = el.style.height;
      const origOverflow = el.style.overflow;
      const origMinWidth = el.style.minWidth;
      const origMinHeight = el.style.minHeight;
      const origPosition = el.style.position;

      // 3. Remove zoom/pan transform
      el.style.transform = "none";
      el.style.transformOrigin = "0 0";
      el.style.overflow = "visible";

      // Force reflow so getBoundingClientRect is accurate
      el.offsetHeight;

      // 4. Measure actual bounding box of ALL child elements (track all edges)
      const canvasRect = el.getBoundingClientRect();
      let minLeft = Infinity, minTop = Infinity, maxRight = 0, maxBottom = 0;
      el.querySelectorAll("*").forEach(child => {
        const r = (child as HTMLElement).getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return;
        const left = r.left - canvasRect.left;
        const top = r.top - canvasRect.top;
        const right = r.right - canvasRect.left;
        const bottom = r.bottom - canvasRect.top;
        if (left < minLeft) minLeft = left;
        if (top < minTop) minTop = top;
        if (right > maxRight) maxRight = right;
        if (bottom > maxBottom) maxBottom = bottom;
      });

      // Handle case where there are no children
      if (minLeft === Infinity) minLeft = 0;
      if (minTop === Infinity) minTop = 0;

      // 5. Calculate export dimensions with generous padding
      const padding = 80;
      const offsetX = Math.min(0, minLeft) - padding;
      const offsetY = Math.min(0, minTop) - padding;
      const exportW = Math.max(Math.ceil(maxRight - offsetX) + padding, 800);
      const exportH = Math.max(Math.ceil(maxBottom - offsetY) + padding, 500);

      // 6. Expand canvas element to contain everything
      el.style.width = `${exportW}px`;
      el.style.height = `${exportH}px`;
      el.style.minWidth = `${exportW}px`;
      el.style.minHeight = `${exportH}px`;

      // 7. Expand SVG to match
      const svg = el.querySelector("svg");
      const origSvgW = svg?.getAttribute("width") ?? "";
      const origSvgH = svg?.getAttribute("height") ?? "";
      const origSvgStyle = svg?.getAttribute("style") ?? "";
      if (svg) {
        svg.setAttribute("width", String(exportW));
        svg.setAttribute("height", String(exportH));
        svg.style.width = `${exportW}px`;
        svg.style.height = `${exportH}px`;
      }

      // Force another reflow after resize
      el.offsetHeight;

      // 8. Replace SVG gradient strokes with solid colors (html2canvas can't render gradients)
      const svgPaths = el.querySelectorAll("svg path");
      const origStrokes: string[] = [];
      svgPaths.forEach((path, i) => {
        origStrokes[i] = (path as SVGPathElement).getAttribute("stroke") || "";
        if (origStrokes[i].startsWith("url(")) {
          (path as SVGPathElement).setAttribute("stroke", "#8b5cf6");
        }
      });

      // 9. Capture with html2canvas — use x/y to offset if nodes extend left/above origin
      const canvas = await h2c(el, {
        scale: 2,
        backgroundColor: "#f8fafc",
        useCORS: true,
        allowTaint: true,
        width: exportW,
        height: exportH,
        x: offsetX,
        y: offsetY,
        scrollX: -window.scrollX,
        scrollY: -window.scrollY,
        windowWidth: exportW + 200,
        windowHeight: exportH + 200,
        foreignObjectRendering: false,
        logging: false,
      });

      // 10. Restore everything
      svgPaths.forEach((path, i) => {
        (path as SVGPathElement).setAttribute("stroke", origStrokes[i]);
      });
      if (svg) {
        svg.setAttribute("width", origSvgW);
        svg.setAttribute("height", origSvgH);
        svg.setAttribute("style", origSvgStyle);
      }
      el.style.transform = origTransform;
      el.style.transformOrigin = origOrigin;
      el.style.width = origWidth;
      el.style.height = origHeight;
      el.style.overflow = origOverflow;
      el.style.minWidth = origMinWidth;
      el.style.minHeight = origMinHeight;
      el.style.position = origPosition;

      // Restore all ancestor overflow
      ancestors.forEach(a => { a.el.style.overflow = a.orig; });

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
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-100 border-b border-surface-100 shrink-0 overflow-x-auto relative z-30">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-brand-600 shrink-0">
          <ArrowLeft size={16} /> {t("mindmaps.back")}
        </button>
        <div className="w-px h-5 bg-surface-200" />
        <h2 className="font-semibold text-surface-900 text-sm truncate">{map.title}</h2>
        <div className="flex-1" />

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

        {/* Export dropdown — uses fixed positioning to escape toolbar overflow clip */}
        <div className="shrink-0 export-dropdown" ref={exportBtnRef}>
          <button onClick={() => setShowExport(!showExport)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface-100 text-surface-600 hover:bg-surface-200">
            <Download size={12} /> {t("mindmaps.export") || "Export"}
          </button>
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

      {/* Export dropdown portal — rendered outside toolbar to avoid overflow clipping */}
      {showExport && exportBtnRef.current && (() => {
        const rect = exportBtnRef.current!.getBoundingClientRect();
        return (
          <div className="fixed bg-surface-100 border border-surface-200 rounded-xl shadow-lg py-1 w-40 export-dropdown"
            style={{ top: rect.bottom + 4, left: rect.right - 160, zIndex: 9999 }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => { exportPNG(); setShowExport(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-700 hover:bg-surface-50">
              <Image size={12} /> PNG
            </button>
            <button onClick={() => { exportMarkdown(); setShowExport(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-700 hover:bg-surface-50">
              <FileText size={12} /> Markdown
            </button>
            <button onClick={() => { exportJSON(); setShowExport(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-700 hover:bg-surface-50">
              <FileText size={12} /> JSON
            </button>
          </div>
        );
      })()}

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
            {/* SVG connections with gradient strokes */}
            <svg className="absolute inset-0 pointer-events-none" style={{ overflow: "visible" }} width={canvasW} height={canvasH}>
              <defs>
                {visibleNodes.filter(n => n.parent_id).map(n => {
                  const parent = visibleNodes.find(p => p.id === n.parent_id);
                  if (!parent) return null;
                  return (
                    <linearGradient key={`grad-${n.id}`} id={`grad-${n.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={parent.color || "#d1d5db"} />
                      <stop offset="100%" stopColor={n.color || "#d1d5db"} />
                    </linearGradient>
                  );
                })}
              </defs>
              {visibleNodes.filter(n => n.parent_id).map(n => {
                const parent = visibleNodes.find(p => p.id === n.parent_id);
                if (!parent) return null;
                if (parent.collapsed && parent.id !== focusNodeId) return null;
                const from = getPos(parent);
                const to = getPos(n);
                const isHighlighted = searchMatches.has(n.id) || searchMatches.has(parent.id);
                const pathD = generateConnectionPath(parent.id, n.id, from, to);
                return (
                  <path
                    key={n.id}
                    d={pathD}
                    fill="none"
                    stroke={isHighlighted ? "#f59e0b" : `url(#grad-${n.id})`}
                    strokeWidth={isHighlighted ? 3 : 2.5}
                    strokeOpacity={isHighlighted ? 0.9 : 0.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
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
              const documentLinks = (n.links ?? []).filter(l => l.url.includes("mindmap-files")).slice(0, 2);
              const hasMoreFiles = (n.links ?? []).filter(l => l.url.includes("mindmap-files")).length > 2;

              return (
                <div
                  key={n.id}
                  data-nodeid={n.id}
                  className={`absolute select-none ${layoutMode === "free" ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                  style={{
                    left: pos.x, top: pos.y, zIndex: isSelected ? 10 : 1,
                    opacity: searchQuery && !isSearchMatch && searchMatches.size > 0 ? 0.3 : 1,
                    transition: "opacity 0.2s",
                    position: "absolute",
                  }}
                  onMouseDown={(e) => handlePointerDownNode(e, n.id)}
                  onTouchStart={(e) => handlePointerDownNode(e, n.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (e.ctrlKey || e.metaKey) {
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
                  <div style={{ position: "relative" }}>
                    {/* Modern node design with gradient background */}
                    <div className={`node-box flex flex-col items-start gap-1.5 px-3 py-2.5 rounded-2xl border-2 transition-all min-w-[180px] max-w-[220px] ${
                      isSelected ? "ring-2 ring-brand-400 border-brand-300 shadow-md" :
                      isSearchMatch ? "ring-2 ring-amber-400 border-amber-300" :
                      "border-surface-200 hover:border-surface-300 shadow-sm hover:shadow-md"
                    }`}
                      style={{
                        background: nodeGradient(n.color, isDark, isRoot),
                        backdropFilter: "blur(4px)",
                        borderLeftWidth: isRoot ? "4px" : "2px",
                        borderLeftColor: isRoot ? n.color : isDark ? "rgba(255,255,255,0.1)" : "inherit",
                      }}
                    >
                      {/* Node image */}
                      {n.image_url && (
                        <div className="w-full -mt-0.5 mb-1">
                          <img
                            src={n.image_url}
                            alt={n.label}
                            className="w-full max-h-[100px] object-cover rounded-xl"
                            loading="lazy"
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-2 w-full">
                        {/* Collapse toggle */}
                        {hasChildren && (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleCollapse(n.id); }}
                            className="text-surface-400 hover:text-surface-600 shrink-0 transition-transform"
                          >
                            {n.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          </button>
                        )}

                        {n.icon && <span className="text-sm shrink-0">{n.icon}</span>}

                        {isInlineEditing ? (
                          <input
                            ref={inlineInputRef}
                            className="text-sm font-medium bg-transparent outline-none border-none flex-1 min-w-[60px]"
                            style={{ color: n.text_color || "#000000" }}
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
                          <span
                            className={`text-sm truncate ${isRoot ? "font-bold" : "font-medium"}`}
                            style={{ color: n.text_color || "#000000" }}
                          >
                            {n.label || t("mindmaps.newNode")}
                          </span>
                        )}

                        {n.notes && <StickyNote size={12} className="text-amber-400 shrink-0" />}
                        {(n.links?.length ?? 0) > 0 && <Link2 size={12} className="text-blue-400 shrink-0" />}
                      </div>

                      {/* File badges */}
                      {documentLinks.length > 0 && (
                        <div className="flex gap-1 flex-wrap w-full">
                          {documentLinks.map((link, idx) => {
                            const fileName = link.label.replace(/^[^a-zA-Z0-9]*/, "").split("/").pop() || "file";
                            const shortName = fileName.length > 12 ? fileName.substring(0, 10) + ".." : fileName;
                            return (
                              <a
                                key={idx}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors truncate max-w-full"
                                title={fileName}
                              >
                                📎 {shortName}
                              </a>
                            );
                          })}
                          {hasMoreFiles && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-200 text-surface-600">
                              +{(n.links ?? []).filter(l => l.url.includes("mindmap-files")).length - 2}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Collapsed indicator */}
                      {n.collapsed && hasChildren && (
                        <div className="flex items-center gap-1.5 w-full">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 font-medium animate-pulse">
                            +{children.length}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Quick actions on select */}
                    {isSelected && !isInlineEditing && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); addChild(n.id, "top"); }}
                          className="absolute -top-5 left-1/2 -translate-x-1/2 p-1 rounded-full bg-brand-600 text-white hover:bg-brand-700 w-6 h-6 flex items-center justify-center text-[10px] font-bold transition-transform hover:scale-110"
                          title="Add child (top)"
                        >
                          ↑
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); addChild(n.id, "left"); }}
                          className="absolute top-1/2 -left-5 -translate-y-1/2 p-1 rounded-full bg-brand-600 text-white hover:bg-brand-700 w-6 h-6 flex items-center justify-center text-[10px] font-bold transition-transform hover:scale-110"
                          title="Add child (left)"
                        >
                          ←
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); addChild(n.id, "right"); }}
                          className="absolute top-1/2 -right-5 -translate-y-1/2 p-1 rounded-full bg-brand-600 text-white hover:bg-brand-700 w-6 h-6 flex items-center justify-center text-[10px] font-bold transition-transform hover:scale-110"
                          title="Add child (right)"
                        >
                          →
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); addChild(n.id, "bottom"); }}
                          className="absolute -bottom-5 left-1/2 -translate-x-1/2 p-1 rounded-full bg-brand-600 text-white hover:bg-brand-700 w-6 h-6 flex items-center justify-center text-[10px] font-bold transition-transform hover:scale-110"
                          title="Add child (bottom)"
                        >
                          ↓
                        </button>

                        <div className="flex gap-1 mt-2 justify-center">
                          {!isRoot && (
                            <button onClick={(e) => { e.stopPropagation(); addSibling(n.id); }}
                              className="p-1.5 rounded-lg bg-brand-100 text-brand-700 hover:bg-brand-200 transition-colors" title="Enter">
                              <CornerDownRight size={12} />
                            </button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); setEditNode(n); }}
                            className="p-1.5 rounded-lg bg-surface-200 text-surface-600 hover:bg-surface-300 transition-colors" title="Space">
                            <Pencil size={12} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setFocusNodeId(focusNodeId === n.id ? null : n.id); }}
                            className={`p-1.5 rounded-lg transition-colors ${focusNodeId === n.id ? "bg-amber-200 text-amber-700" : "bg-surface-200 text-surface-600 hover:bg-surface-300"}`} title="F">
                            {focusNodeId === n.id ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                          {!isRoot && (
                            <button onClick={(e) => { e.stopPropagation(); deleteNode(n.id); }}
                              className="p-1.5 rounded-lg bg-red-100 text-red-500 hover:bg-red-200 transition-colors" title="Del">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
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
            const { error } = await supabase.from("mindmap_nodes").update(updates).eq("id", editNode.id);
            if (error) {
              // If image_url column doesn't exist yet, retry without it
              const { image_url, ...rest } = updates as any;
              await supabase.from("mindmap_nodes").update(rest).eq("id", editNode.id);
            }
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
          <div className="bg-surface-100 rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
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
  const supabase = createClient();
  const [label, setLabel] = useState(node.label);
  const [notes, setNotes] = useState(node.notes ?? "");
  const [color, setColor] = useState(node.color);
  const [textColor, setTextColor] = useState<string | null>(node.text_color ?? null);
  const [icon, setIcon] = useState(node.icon ?? "");
  const [imageUrl, setImageUrl] = useState(node.image_url ?? "");
  const [links, setLinks] = useState<{ label: string; url: string }[]>(node.links ?? []);
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploadingImage(false); return; }
    try {
      const fileName = `${node.id}/img-${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("mindmap-files").upload(fileName, file, { upsert: false });
      if (error) { console.error("Image upload error:", error); return; }
      const { data: { publicUrl } } = supabase.storage.from("mindmap-files").getPublicUrl(fileName);
      setImageUrl(publicUrl);
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

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

  function isDocumentLink(url: string): boolean {
    return url.startsWith("https://") && url.includes("mindmap-files");
  }

  function getFileIcon(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    const iconMap: { [key: string]: string } = {
      pdf: "📄",
      docx: "📄",
      doc: "📄",
      pptx: "📊",
      ppt: "📊",
      xlsx: "📈",
      xls: "📈",
      txt: "📝",
      md: "📝",
      png: "🖼️",
      jpg: "🖼️",
      jpeg: "🖼️",
      gif: "🖼️",
    };
    return iconMap[ext] ?? "📎";
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setUploading(false);
      return;
    }

    try {
      for (const file of Array.from(files)) {
        const allowedTypes = [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "application/vnd.ms-powerpoint",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "text/plain",
          "text/markdown",
          "image/png",
          "image/jpeg",
          "image/gif",
        ];

        if (!allowedTypes.includes(file.type)) {
          continue;
        }

        const fileName = `${node.id}/${Date.now()}-${file.name}`;
        const { data, error } = await supabase.storage
          .from("mindmap-files")
          .upload(fileName, file, { upsert: false });

        if (error) {
          console.error("Upload error:", error);
          continue;
        }

        if (data) {
          const { data: { publicUrl } } = supabase.storage
            .from("mindmap-files")
            .getPublicUrl(fileName);

          const displayName = `${getFileIcon(file.name)} ${file.name}`;
          setLinks(prev => [...prev, { label: displayName, url: publicUrl }]);
        }
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface-100 rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto">
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
            <label className="block text-sm font-medium text-surface-700 mb-2">{t("mindmaps.textColor")}</label>
            <div className="flex gap-1.5 flex-wrap items-center">
              {TEXT_COLORS.map((tc, i) => (
                <button key={tc ?? "default"} type="button" onClick={() => setTextColor(tc)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform flex items-center justify-center text-[10px] font-bold ${textColor === tc ? "border-surface-800 scale-110" : "border-surface-300"}`}
                  style={{ background: tc ?? undefined }}
                  title={tc === null ? "Standard" : tc}
                >
                  {tc === null ? <span className="text-surface-500">A</span> : null}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{t("mindmaps.nodeNotes")}</label>
            <textarea className="input resize-none text-sm" rows={3} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder={t("mindmaps.placeholder")} />
          </div>

          {/* Image upload */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">{t("mindmaps.nodeImage") || "Bild"}</label>
            {imageUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-surface-200 mb-2">
                <img src={imageUrl} alt={label} className="w-full max-h-[140px] object-cover" />
                <button
                  onClick={() => setImageUrl("")}
                  className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white hover:bg-red-600"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="w-full px-2 py-2 rounded-lg border-2 border-dashed border-surface-300 text-surface-500 text-xs hover:border-brand-400 hover:text-brand-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Image size={14} />
                  {uploadingImage ? "Uploading..." : (t("mindmaps.uploadImage") || "Bild hochladen")}
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">{t("mindmaps.nodeLinks")}</label>
            {links.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {links.map((l, i) => {
                  const isDoc = isDocumentLink(l.url);
                  return (
                    <div key={i} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${isDoc ? "bg-amber-50" : "bg-surface-50"}`}>
                      {isDoc ? (
                        <span className="text-base shrink-0">{l.label.match(/^[^a-zA-Z0-9]/)?.[0] ?? "📎"}</span>
                      ) : (
                        <Link2 size={12} className="text-blue-500 shrink-0" />
                      )}
                      <span className="flex-1 truncate text-surface-700">{l.label}</span>
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className={isDoc ? "text-amber-600 hover:text-amber-700" : "text-blue-500 hover:text-blue-700"}>
                        <ExternalLink size={12} />
                      </a>
                      <button onClick={() => removeLink(i)} className="text-surface-400 hover:text-red-500">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="space-y-2">
              <div className="flex gap-1.5">
                <input className="input flex-1 text-xs" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)}
                  placeholder="https://..." onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addLink())} />
                <input className="input w-28 text-xs" value={newLinkLabel} onChange={e => setNewLinkLabel(e.target.value)}
                  placeholder={t("mindmaps.linkTitle")} />
                <button onClick={addLink} className="px-2 py-1 rounded-lg bg-brand-600 text-white text-xs hover:bg-brand-700">+</button>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.txt,.md,.png,.jpg,.jpeg,.gif"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full px-2 py-2 rounded-lg bg-amber-100 text-amber-700 text-xs hover:bg-amber-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Upload size={14} />
                  {uploading ? "Uploading..." : t("mindmaps.uploadFile")}
                </button>
              </div>
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
              onClick={() => onSave({ label, notes: notes || null, color, text_color: textColor, icon: icon || null, image_url: imageUrl || null, links })}
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
