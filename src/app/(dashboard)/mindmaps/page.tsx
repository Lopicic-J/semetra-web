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
  Network, LayoutGrid, ZoomIn, ZoomOut, Maximize2, GraduationCap
} from "lucide-react";
import type { MindMap, MindMapNode, CalendarEvent, Task } from "@/types/database";

const NODE_COLORS = [
  "#6d28d9","#2563eb","#059669","#dc2626","#d97706",
  "#db2777","#0891b2","#7c3aed","#16a34a","#ea580c",
  "#6366f1","#0d9488","#f59e0b","#ef4444","#8b5cf6",
];

const NODE_ICONS = ["", "💡","📌","⭐","🔥","✅","❓","📖","🎯","⚠️","💎","🧩","🔬","📝","🏗️","🧪"];

// ─── Main Page ────────────────────────────────────────────────────────
export default function MindMapsPage() {
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
          <h1 className="text-2xl font-bold text-surface-900">Mind Maps</h1>
          <p className="text-surface-500 text-sm mt-0.5">{maps.length} Mind Map{maps.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <LimitCounter current={maps.length} max={FREE_LIMITS.mindMaps} isPro={isPro} />
          <button onClick={() => {
            const check = withinFreeLimit("mindMaps", maps.length, isPro);
            if (!check.allowed) { setShowUpgrade(true); return; }
            setShowCreate(true);
          }} className="btn-primary gap-2">
            <Plus size={16} /> Neue Mind Map
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
          <p className="font-medium">Noch keine Mind Maps</p>
          <p className="text-sm mt-1">Erstelle deine erste Mind Map um Wissen zu strukturieren.</p>
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
                      if (!confirm("Mind Map löschen?")) return;
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
                    {m.layout_mode === "tree" ? "Baum" : "Frei"}
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
      title: title || "Neue Mind Map",
      module_id: moduleId || null,
      exam_id: examId || null,
      task_id: taskId || null,
      layout_mode: layout,
      color,
    }).select().single();
    if (data) {
      // Create root node
      await supabase.from("mindmap_nodes").insert({
        user_id: user.id,
        mindmap_id: data.id,
        parent_id: null,
        label: title || "Hauptthema",
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
          <h2 className="font-semibold text-surface-900">Neue Mind Map</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100"><X size={16} /></button>
        </div>
        <form onSubmit={handleCreate} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Titel</label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="z.B. Mathematik Übersicht" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Modul (optional)</label>
              <select className="input text-sm" value={moduleId} onChange={e => setModuleId(e.target.value)}>
                <option value="">— Kein Modul —</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Prüfung (optional)</label>
              <select className="input text-sm" value={examId} onChange={e => setExamId(e.target.value)}>
                <option value="">— Keine —</option>
                {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">Layout</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setLayout("tree")}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-colors ${layout === "tree" ? "border-brand-400 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>
                <GitBranch size={16} /> Baumstruktur
              </button>
              <button type="button" onClick={() => setLayout("free")}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-colors ${layout === "free" ? "border-brand-400 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>
                <Move size={16} /> Frei positioniert
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">Farbe</label>
            <div className="flex gap-1.5 flex-wrap">
              {NODE_COLORS.slice(0, 10).map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${color === c ? "border-surface-800 scale-110" : "border-transparent"}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Abbrechen</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? "Erstellen…" : "Erstellen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Mind Map Editor ──────────────────────────────────────────────────
function MindMapEditor({ map, modules, onBack }: {
  map: MindMap; modules: any[]; onBack: () => void;
}) {
  const supabase = createClient();
  const [nodes, setNodes] = useState<MindMapNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [layoutMode, setLayoutMode] = useState<"tree"|"free">(map.layout_mode as "tree"|"free");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [editNode, setEditNode] = useState<MindMapNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; nodeX: number; nodeY: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);

  const fetchNodes = useCallback(async () => {
    const { data } = await supabase.from("mindmap_nodes").select("*").eq("mindmap_id", map.id).order("sort_order");
    setNodes(data ?? []);
    setLoading(false);
  }, [supabase, map.id]);

  useEffect(() => { fetchNodes(); }, [fetchNodes]);

  // Build tree structure
  const rootNode = useMemo(() => nodes.find(n => !n.parent_id), [nodes]);
  const childrenOf = useCallback((parentId: string) =>
    nodes.filter(n => n.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order),
  [nodes]);

  // Auto-layout tree positions
  const treePositions = useMemo(() => {
    if (layoutMode !== "tree" || !rootNode) return new Map<string, { x: number; y: number }>();
    const pos = new Map<string, { x: number; y: number }>();
    const NODE_W = 180;
    const NODE_H = 70;
    let leafIndex = 0;

    function countLeaves(id: string): number {
      const children = childrenOf(id);
      if (children.length === 0) return 1;
      return children.reduce((sum, c) => sum + countLeaves(c.id), 0);
    }

    function layout(id: string, depth: number, startLeaf: number): number {
      const children = childrenOf(id);
      const x = 60 + depth * (NODE_W + 60);
      if (children.length === 0) {
        pos.set(id, { x, y: 80 + startLeaf * NODE_H });
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
  }, [rootNode, childrenOf, layoutMode]);

  function getPos(node: MindMapNode) {
    if (layoutMode === "tree") return treePositions.get(node.id) ?? { x: node.pos_x, y: node.pos_y };
    return { x: node.pos_x, y: node.pos_y };
  }

  // ── Pointer helpers (mouse + touch) ──
  function getPointerPos(e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) {
    if ("touches" in e) {
      const t = e.touches[0] ?? (e as TouchEvent).changedTouches[0];
      return { x: t.clientX, y: t.clientY };
    }
    return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
  }

  // Drag logic (free mode)
  function handlePointerDownNode(e: React.MouseEvent | React.TouchEvent, nodeId: string) {
    if (layoutMode !== "free") return;
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const p = getPointerPos(e);
    dragRef.current = { id: nodeId, startX: p.x, startY: p.y, nodeX: node.pos_x, nodeY: node.pos_y };
    setSelectedNode(nodeId);
  }

  function handlePointerDownCanvas(e: React.MouseEvent | React.TouchEvent) {
    const target = e.target as HTMLElement;
    if (target === canvasRef.current || target.classList.contains("canvas-bg")) {
      // Pinch-to-zoom: if 2 fingers, start pinch instead of pan
      if ("touches" in e && e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchRef.current = { startDist: Math.hypot(dx, dy), startZoom: zoom };
        return;
      }
      const p = getPointerPos(e);
      panRef.current = { startX: p.x, startY: p.y, panX: pan.x, panY: pan.y };
      setSelectedNode(null);
    }
  }

  useEffect(() => {
    function handlePointerMove(e: MouseEvent | TouchEvent) {
      // Pinch-to-zoom
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
        setNodes(prev => prev.map(n =>
          n.id === dragRef.current!.id
            ? { ...n, pos_x: dragRef.current!.nodeX + dx, pos_y: dragRef.current!.nodeY + dy }
            : n
        ));
      }
      if (panRef.current) {
        e.preventDefault();
        setPan({
          x: panRef.current.panX + (p.x - panRef.current.startX),
          y: panRef.current.panY + (p.y - panRef.current.startY),
        });
      }
    }

    async function handlePointerUp(e: MouseEvent | TouchEvent) {
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
  }, [nodes, zoom, supabase]);

  async function addChild(parentId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const parent = nodes.find(n => n.id === parentId);
    const siblings = childrenOf(parentId);
    const { data } = await supabase.from("mindmap_nodes").insert({
      user_id: user.id,
      mindmap_id: map.id,
      parent_id: parentId,
      label: "Neuer Knoten",
      color: parent?.color ?? map.color,
      pos_x: (parent?.pos_x ?? 200) + 220,
      pos_y: (parent?.pos_y ?? 50) + siblings.length * 70,
      sort_order: siblings.length,
    }).select().single();
    if (data) {
      await supabase.from("mindmaps").update({ updated_at: new Date().toISOString() }).eq("id", map.id);
      fetchNodes();
      setEditNode(data as MindMapNode);
    }
  }

  async function deleteNode(id: string) {
    const node = nodes.find(n => n.id === id);
    if (!node?.parent_id) return; // can't delete root
    await supabase.from("mindmap_nodes").delete().eq("id", id);
    setSelectedNode(null);
    setEditNode(null);
    fetchNodes();
  }

  async function toggleLayout() {
    const newMode = layoutMode === "tree" ? "free" : "tree";
    setLayoutMode(newMode);
    await supabase.from("mindmaps").update({ layout_mode: newMode }).eq("id", map.id);
  }

  // Canvas size — generous padding so edges/nodes are never cut off
  const canvasW = useMemo(() => {
    const maxX = Math.max(800, ...nodes.map(n => getPos(n).x + 240));
    return maxX + 200;
  }, [nodes, treePositions, layoutMode]);
  const canvasH = useMemo(() => {
    const maxY = Math.max(500, ...nodes.map(n => getPos(n).y + 80));
    return maxY + 200;
  }, [nodes, treePositions, layoutMode]);

  // Auto-fit: scale mind map to fit viewport on initial load (especially for mobile)
  const hasAutoFit = useRef(false);
  useEffect(() => {
    if (loading || nodes.length === 0 || hasAutoFit.current) return;
    hasAutoFit.current = true;
    const container = canvasRef.current;
    if (!container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    // Calculate bounding box of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const p = getPos(n);
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + 200); // node width ~200
      maxY = Math.max(maxY, p.y + 50);  // node height ~50
    }
    const contentW = maxX - minX + 100; // padding
    const contentH = maxY - minY + 100;
    const fitZoom = Math.min(cw / contentW, ch / contentH, 1);
    if (fitZoom < 0.95) {
      // Only auto-fit if content doesn't already fit
      const clampedZoom = Math.max(0.3, Math.min(1, fitZoom * 0.9));
      setZoom(clampedZoom);
      // Center the content
      setPan({
        x: (cw - contentW * clampedZoom) / 2 - minX * clampedZoom + 40,
        y: (ch - contentH * clampedZoom) / 2 - minY * clampedZoom + 40,
      });
    }
  }, [loading, nodes]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-surface-100 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-brand-600">
          <ArrowLeft size={16} /> Zurück
        </button>
        <div className="w-px h-5 bg-surface-200" />
        <h2 className="font-semibold text-surface-900 text-sm truncate flex-1">{map.title}</h2>
        <button onClick={toggleLayout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-100 hover:bg-brand-100 text-surface-600 hover:text-brand-700 transition-colors"
          title={layoutMode === "tree" ? "Wechsel zu Frei" : "Wechsel zu Baum"}>
          {layoutMode === "tree" ? <><GitBranch size={13} /> Baum</> : <><Move size={13} /> Frei</>}
        </button>
        <button onClick={() => setShowGrid(g => !g)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            showGrid ? "bg-brand-50 text-brand-700" : "bg-surface-100 text-surface-500 hover:bg-surface-200"
          }`}
          title={showGrid ? "Raster ausblenden" : "Raster einblenden"}>
          <LayoutGrid size={13} /> Raster
        </button>
        <div className="flex items-center gap-1 bg-surface-100 rounded-lg px-1">
          <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="p-1 hover:bg-surface-200 rounded"><ZoomOut size={14} /></button>
          <span className="text-[10px] text-surface-500 w-8 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1 hover:bg-surface-200 rounded"><ZoomIn size={14} /></button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-1 hover:bg-surface-200 rounded"><Maximize2 size={14} /></button>
        </div>
      </div>

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
        ref={canvasRef}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full text-surface-400">Laden…</div>
        ) : (
          <div
            className="canvas-bg"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              width: canvasW,
              height: canvasH,
              position: "relative",
              overflow: "visible",
              cursor: panRef.current ? "grabbing" : "grab",
            }}
          >
            {/* SVG connections */}
            <svg className="absolute inset-0 pointer-events-none" style={{ overflow: "visible" }} width={canvasW} height={canvasH}>
              {nodes.filter(n => n.parent_id).map(n => {
                const parent = nodes.find(p => p.id === n.parent_id);
                if (!parent) return null;
                const from = getPos(parent);
                const to = getPos(n);
                const NODE_W = 160;
                return (
                  <path
                    key={n.id}
                    d={`M${from.x + NODE_W} ${from.y + 22} C${from.x + NODE_W + 40} ${from.y + 22}, ${to.x - 40} ${to.y + 22}, ${to.x} ${to.y + 22}`}
                    fill="none"
                    stroke={n.color || "#d1d5db"}
                    strokeWidth="2"
                    strokeOpacity="0.5"
                  />
                );
              })}
            </svg>

            {/* Nodes */}
            {nodes.map(n => {
              const pos = getPos(n);
              const isRoot = !n.parent_id;
              const isSelected = selectedNode === n.id;
              const children = childrenOf(n.id);
              return (
                <div
                  key={n.id}
                  className={`absolute select-none transition-shadow ${layoutMode === "free" ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                  style={{ left: pos.x, top: pos.y, zIndex: isSelected ? 10 : 1 }}
                  onMouseDown={(e) => handlePointerDownNode(e, n.id)}
                  onTouchStart={(e) => handlePointerDownNode(e, n.id)}
                  onClick={(e) => { e.stopPropagation(); setSelectedNode(n.id); }}
                  onDoubleClick={(e) => { e.stopPropagation(); setEditNode(n); }}
                >
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 bg-white shadow-sm transition-all min-w-[120px] max-w-[200px] ${
                    isSelected ? "ring-2 ring-brand-400 border-brand-300" : "border-surface-200 hover:border-surface-300"
                  } ${isRoot ? "border-l-4" : ""}`}
                    style={isRoot ? { borderLeftColor: n.color } : {}}
                  >
                    {n.icon && <span className="text-sm shrink-0">{n.icon}</span>}
                    <span className={`text-sm truncate ${isRoot ? "font-semibold" : "font-medium"} text-surface-800`}>{n.label}</span>
                    {n.notes && <StickyNote size={10} className="text-amber-400 shrink-0" />}
                    {(n.links?.length ?? 0) > 0 && <Link2 size={10} className="text-blue-400 shrink-0" />}
                  </div>

                  {/* Quick actions on select */}
                  {isSelected && (
                    <div className="flex gap-1 mt-1 justify-center">
                      <button onClick={(e) => { e.stopPropagation(); addChild(n.id); }}
                        className="p-1 rounded bg-brand-600 text-white hover:bg-brand-700" title="Kind hinzufügen">
                        <Plus size={12} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setEditNode(n); }}
                        className="p-1 rounded bg-surface-200 text-surface-600 hover:bg-surface-300" title="Bearbeiten">
                        <Pencil size={12} />
                      </button>
                      {!isRoot && (
                        <button onClick={(e) => { e.stopPropagation(); deleteNode(n.id); }}
                          className="p-1 rounded bg-red-100 text-red-500 hover:bg-red-200" title="Löschen">
                          <Trash2 size={12} />
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
          <h2 className="font-semibold text-surface-900">Knoten bearbeiten</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Bezeichnung</label>
            <input className="input" value={label} onChange={e => setLabel(e.target.value)} autoFocus />
          </div>

          {/* Icon */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">Icon</label>
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

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">Farbe</label>
            <div className="flex gap-1.5 flex-wrap">
              {NODE_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? "border-surface-800 scale-110" : "border-transparent"}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Notizen</label>
            <textarea className="input resize-none text-sm" rows={3} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Erklärungen, Zusammenfassung, Formeln…" />
          </div>

          {/* Links */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">Links & Dokumente</label>
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
                placeholder="Titel" />
              <button onClick={addLink} className="px-2 py-1 rounded-lg bg-brand-600 text-white text-xs hover:bg-brand-700">+</button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {!isRoot && (
              <button onClick={onDelete} className="px-3 py-2 rounded-xl border border-red-200 text-red-600 text-sm hover:bg-red-50">
                Löschen
              </button>
            )}
            <div className="flex-1" />
            <button onClick={onClose} className="btn-secondary">Abbrechen</button>
            <button
              onClick={() => onSave({ label, notes: notes || null, color, icon: icon || null, links })}
              className="btn-primary gap-1.5"
            >
              <Save size={14} /> Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
