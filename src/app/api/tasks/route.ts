import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Tasks CRUD API
 *
 * GET    /api/tasks              — list tasks (optional ?module_id=X&status=Y)
 * POST   /api/tasks              — create task
 * PATCH  /api/tasks              — update task (body: { id, ...fields })
 * DELETE /api/tasks?id=X         — delete task
 */

const VALID_PRIORITIES = ["low", "medium", "high"] as const;
const VALID_STATUSES = ["todo", "in_progress", "done"] as const;

// ── GET ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { searchParams } = req.nextUrl;
    const moduleId = searchParams.get("module_id");
    const status = searchParams.get("status");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("tasks")
      .select("*, modules(name, color)", { count: "exact" })
      .eq("user_id", user.id)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("priority", { ascending: false })
      .range(offset, offset + limit - 1);

    if (moduleId) query = query.eq("module_id", moduleId);
    if (status && VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      query = query.eq("status", status);
    }

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ tasks: data ?? [], total: count ?? 0 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

// ── POST ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const body = await req.json();
    const { title, description, due_date, priority, status, module_id } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Titel ist erforderlich" }, { status: 400 });
    }
    if (title.trim().length > 500) {
      return NextResponse.json({ error: "Titel darf max. 500 Zeichen lang sein" }, { status: 400 });
    }

    const taskPriority = VALID_PRIORITIES.includes(priority) ? priority : "medium";
    const taskStatus = VALID_STATUSES.includes(status) ? status : "todo";

    const insert: Record<string, unknown> = {
      user_id: user.id,
      title: title.trim(),
      description: description?.trim() || null,
      due_date: due_date || null,
      priority: taskPriority,
      status: taskStatus,
      module_id: module_id || null,
    };

    // If created directly as done, set completed_at
    if (taskStatus === "done") {
      insert.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert(insert)
      .select("*, modules(name, color)")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ task: data }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

// ── PATCH ──────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const body = await req.json();
    const { id, title, description, due_date, priority, status, module_id } = body;

    if (!id) return NextResponse.json({ error: "Task-ID ist erforderlich" }, { status: 400 });

    // Build update object — only include provided fields
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (title !== undefined) {
      if (typeof title !== "string" || title.trim().length === 0) {
        return NextResponse.json({ error: "Titel darf nicht leer sein" }, { status: 400 });
      }
      updates.title = title.trim();
    }
    if (description !== undefined) updates.description = description?.trim() || null;
    if (due_date !== undefined) updates.due_date = due_date || null;
    if (priority !== undefined && VALID_PRIORITIES.includes(priority)) updates.priority = priority;
    if (module_id !== undefined) updates.module_id = module_id || null;

    // Status change with completed_at tracking
    if (status !== undefined && VALID_STATUSES.includes(status)) {
      updates.status = status;

      // Fetch current task to check status transition
      const { data: current } = await supabase
        .from("tasks")
        .select("status, completed_at")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (status === "done" && current?.status !== "done") {
        // Transitioning to done → set completed_at
        updates.completed_at = new Date().toISOString();
      } else if (status !== "done" && current?.status === "done") {
        // Reopening task → clear completed_at
        updates.completed_at = null;
      }
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*, modules(name, color)")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Task nicht gefunden" }, { status: 404 });

    return NextResponse.json({ task: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

// ── DELETE ──────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Task-ID ist erforderlich" }, { status: 400 });

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
