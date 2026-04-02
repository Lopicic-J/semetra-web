"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModules } from "@/lib/hooks/useModules";
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
  const [maps, setMaps] = useState<MindMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMap, setEditingMap] = useState<MindMap | null>(null);
  const [showCreate, setShowCreate] = useState(false);
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
          <h1 className="text-2xl font-bold text-gray-900">Mind Maps</h1>
          <p className="text-gray-500 text-sm mt-0.5">{maps.length} Mind Map{maps.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary gap-2">
          <Plus size={16} /> Neue Mind Map
        </button>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : maps.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
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
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">{m.title}</h3>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {mod && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">{mod.name}</span>
                  )}
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    {m.layout_mode === "tree" ? "Baum" : "Frei"}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-2">
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
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Neue Mind Map</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
        </div>
        <form onSubmit={handleCreate} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titel</label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="z.B. Mathematik Übersicht" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modul (optional)</label>
              <select className="input text-sm" value={moduleId} onChange={e => setModuleId(e.target.value)}>
                <option value="">— Kein Modul —</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prüfung (optional)</label>
              <select className="input text-sm" value={examId} onChange={e => setExamId(e.target.value)}>
                <option value="">— Keine —</option>
                {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Layout</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setLayout("tree")}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-colors ${layout === "tree" ? "border-violet-400 bg-violet-50 text-violet-700" : "border-gray-200 text-gray-500"}`}>
                <GitBranch size={16} /> Baumstruktur
              </button>
              <button type="button" onClick={() => setLayout("free")}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-colors ${layout === "free" ? "border-violet-400 bg-violet-50 text-violet-700" : "border-gray-200 text-gray-500"}`}>
                <Move size={16} /> Frei positioniert
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Farbe</label>
            <div className="flex gap-1.5 flex-wrap">
              {NODE_COLORS.slice(0, 10).map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${color === c ? "border-gray-800 scale-110" : "border-transparent"}`}
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
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; nodeX: number; nodeY: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

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
        pos.set(id, { x, y: 40 + startLeaf * NODE_H });
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

  // Drag logic (free mode)
  function handleMouseDown(e: React.MouseEvent, nodeId: string) {
    if (layoutMode !== "free") return;
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    dragRef.current = { id: nodeId, startX: e.clientX, startY: e.clientY, nodeX: node.pos_x, nodeY: node.pos_y };
    setSelectedNode(nodeId);
  }

  function handleCanvasMouseDown(e: React.MouseEvent) {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains("canvas-bg")) {
      panRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
      setSelectedNode(null);
    }
  }

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (dragRef.current) {
        const dx = (e.clientX - dragRef.current.startX) / zoom;
        const dy = (e.clientY - dragRef.current.startY) / zoom;
        setNodes(prev => prev.map(n =>
          n.id === dragRef.current!.id
            ? { ...n, pos_x: dragRef.current!.nodeX + dx, pos_y: dragRef.current!.nodeY + dy }
            : n
        ));
      }
      if (panRef.current) {
        setPan({
          x: panRef.current.panX + (e.clientX - panRef.current.startX),
          y: panRef.current.panY + (e.clientY - panRef.current.startY),
        });
      }
    }
    async function handleMouseUp() {
      if (dragRef.current) {
        const node = nodes.find(n => n.id === dragRef.current!.id);
        if (node) {
          await supabase.from("mindmap_nodes").update({ pos_x: node.pos_x, pos_y: node.pos_y }).eq("id", node.id);
        }
        dragRef.current = null;
      }
      panRef.current = null;
    }
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
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

  // Canvas size
  const canvasW = useMemo(() => {
    const maxX = Math.max(800, ...nodes.map(n => getPos(n).x + 200));
    return maxX + 100;
  }, [nodes, treePositions, layoutMode]);
  const canvasH = useMemo(() => {
    const maxY = Math.max(500, ...nodes.map(n => getPos(n).y + 60));
    return maxY + 100;
  }, [nodes, treePositions, layoutMode]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-100 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-violet-600">
          <ArrowLeft size={16} /> Zurück
        </button>
        <div className="w-px h-5 bg-gray-200" />
        <h2 className="font-semibold text-gray-900 text-sm truncate flex-1">{map.title}</h2>
        <button onClick={toggleLayout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 hover:bg-violet-100 text-gray-600 hover:text-violet-700 transition-colors"
          title={layoutMode === "tree" ? "Wechsel zu Frei" : "Wechsel zu Baum"}>
          {layoutMode === "tree" ? <><GitBranch size={13} /> Baum</> : <><Move size={13} /> Frei</>}
        </button>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-1">
          <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="p-1 hover:bg-gray-200 rounded"><ZoomOut size={14} /></button>
          <span className="text-[10px] text-gray-500 w-8 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1 hover:bg-gray-200 rounded"><ZoomIn size={14} /></button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-1 hover:bg-gray-200 rounded"><Maximize2 size={14} /></button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden bg-gray-50 relative" onMouseDown={handleCanvasMouseDown} ref={canvasRef}>
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400">Laden…</div>
        ) : (
          <div
            className="canvas-bg"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              width: canvasW,
              height: canvasH,
              position: "relative",
              cursor: panRef.current ? "grabbing" : "grab",
            }}
          >
            {/* SVG connections */}
            <svg className="absolute inset-0 pointer-events-none" width={canvasW} height={canvasH}>
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
                  onMouseDown={(e) => handleMouseDown(e, n.id)}
                  onClick={(e) => { e.stopPropagation(); setSelectedNode(n.id); }}
                  onDoubleClick={(e) => { e.stopPropagation(); setEditNode(n); }}
                >
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 bg-white shadow-sm transition-all min-w-[120px] max-w-[200px] ${
                    isSelected ? "ring-2 ring-violet-400 border-violet-300" : "border-gray-200 hover:border-gray-300"
                  } ${isRoot ? "border-l-4" : ""}`}
                    style={isRoot ? { borderLeftColor: n.color } : {}}
                  >
                    {n.icon && <span className="text-sm shrink-0">{n.icon}</span>}
                    <span className={`text-sm truncate ${isRoot ? "font-semibold" : "font-medium"} text-gray-800`}>{n.label}</span>
                    {n.notes && <StickyNote size={10} className="text-amber-400 shrink-0" />}
                    {(n.links?.length ?? 0) > 0 && <Link2 size={10} className="text-blue-400 shrink-0" />}
                  </div>

                  {/* Quick actions on select */}
                  {isSelected && (
                    <div className="flex gap-1 mt-1 justify-center">
                      <button onClick={(e) => { e.stopPropagation(); addChild(n.id); }}
                        className="p-1 rounded bg-violet-600 text-white hover:bg-violet-700" title="Kind hinzufügen">
                        <Plus size={12} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setEditNode(n); }}
                        className="p-1 rounded bg-gray-200 text-gray-600 hover:bg-gray-300" title="Bearbeiten">
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
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Knoten bearbeiten</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bezeichnung</label>
            <input className="input" value={label} onChange={e => setLabel(e.target.value)} autoFocus />
          </div>

          {/* Icon */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
            <div className="flex gap-1.5 flex-wrap">
              {NODE_ICONS.map(ic => (
                <button key={ic} type="button" onClick={() => setIcon(ic)}
                  className={`w-8 h-8 rounded-lg text-sm flex items-center justify-center border-2 transition-colors ${
                    icon === ic ? "border-violet-500 bg-violet-50" : "border-gray-200 hover:border-gray-300"
                  }`}>
                  {ic || "—"}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Farbe</label>
            <div className="flex gap-1.5 flex-wrap">
              {NODE_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? "border-gray-800 scale-110" : "border-transparent"}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
            <textarea className="input resize-none text-sm" rows={3} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Erklärungen, Zusammenfassung, Formeln…" />
          </div>

          {/* Links */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Links & Dokumente</label>
            {links.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {links.map((l, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-xs">
                    <Link2 size={12} className="text-blue-500 shrink-0" />
                    <span className="flex-1 truncate text-gray-700">{l.label}</span>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                      <ExternalLink size={12} />
                    </a>
                    <button onClick={() => removeLink(i)} className="text-gray-400 hover:text-red-500">
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
              <button onClick={addLink} className="px-2 py-1 rounded-lg bg-violet-600 text-white text-xs hover:bg-violet-700">+</button>
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
