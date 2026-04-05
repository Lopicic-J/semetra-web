"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type { TaskAttachment } from "@/types/database";

const log = logger("hook:attachments");

export function useTaskAttachments(taskId?: string) {
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    if (!taskId) { setAttachments([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("task_attachments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });
    setAttachments(data ?? []);
    setLoading(false);
  }, [supabase, taskId]);

  useEffect(() => { fetch(); }, [fetch]);

  /** Add a link attachment */
  async function addLink(label: string, url: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !taskId) return;
    await supabase.from("task_attachments").insert({
      user_id: user.id,
      task_id: taskId,
      kind: "link",
      label,
      url,
    });
    fetch();
  }

  /** Upload a file to Supabase Storage and create attachment record */
  async function uploadFile(file: File) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !taskId) return;

    // Upload to storage: user_id/task_id/filename
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const storagePath = `${user.id}/${taskId}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("task-files")
      .upload(storagePath, file);

    if (uploadError) {
      log.error("Upload failed", uploadError);
      return;
    }

    // Get public/signed URL
    const { data: urlData } = supabase.storage
      .from("task-files")
      .getPublicUrl(storagePath);

    await supabase.from("task_attachments").insert({
      user_id: user.id,
      task_id: taskId,
      kind: "file",
      label: file.name,
      url: urlData?.publicUrl ?? storagePath,
      file_type: ext,
      file_size: file.size,
      storage_path: storagePath,
    });
    fetch();
  }

  /** Delete an attachment (and its storage file if applicable) */
  async function remove(attachment: TaskAttachment) {
    if (attachment.kind === "file" && attachment.storage_path) {
      await supabase.storage.from("task-files").remove([attachment.storage_path]);
    }
    await supabase.from("task_attachments").delete().eq("id", attachment.id);
    fetch();
  }

  /** Get a download URL for a file attachment */
  function getDownloadUrl(attachment: TaskAttachment): string | null {
    if (attachment.kind === "link") return attachment.url;
    if (!attachment.storage_path) return attachment.url;
    const { data } = supabase.storage
      .from("task-files")
      .getPublicUrl(attachment.storage_path);
    return data?.publicUrl ?? null;
  }

  return { attachments, loading, addLink, uploadFile, remove, getDownloadUrl, refetch: fetch };
}
