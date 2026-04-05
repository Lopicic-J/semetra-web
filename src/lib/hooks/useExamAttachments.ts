"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type { ExamAttachment } from "@/types/database";

const log = logger("hook:exam-attachments");

export function useExamAttachments(examId?: string) {
  const [attachments, setAttachments] = useState<ExamAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    if (!examId) { setAttachments([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("exam_attachments")
      .select("*")
      .eq("exam_id", examId)
      .order("created_at", { ascending: false });
    setAttachments(data ?? []);
    setLoading(false);
  }, [supabase, examId]);

  useEffect(() => { fetch(); }, [fetch]);

  /** Add a note */
  async function addNote(content: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !examId) return;
    await supabase.from("exam_attachments").insert({
      user_id: user.id,
      exam_id: examId,
      kind: "note",
      label: content.slice(0, 80) + (content.length > 80 ? "…" : ""),
      content,
    });
    fetch();
  }

  /** Update a note */
  async function updateNote(id: string, content: string) {
    await supabase.from("exam_attachments").update({
      content,
      label: content.slice(0, 80) + (content.length > 80 ? "…" : ""),
    }).eq("id", id);
    fetch();
  }

  /** Add a link attachment */
  async function addLink(label: string, url: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !examId) return;
    await supabase.from("exam_attachments").insert({
      user_id: user.id,
      exam_id: examId,
      kind: "link",
      label,
      url,
    });
    fetch();
  }

  /** Upload a file to Supabase Storage and create attachment record */
  async function uploadFile(file: File) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !examId) return;

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const storagePath = `${user.id}/${examId}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("exam-files")
      .upload(storagePath, file);

    if (uploadError) {
      log.error("Upload failed", uploadError);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("exam-files")
      .getPublicUrl(storagePath);

    await supabase.from("exam_attachments").insert({
      user_id: user.id,
      exam_id: examId,
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
  async function remove(attachment: ExamAttachment) {
    if (attachment.kind === "file" && attachment.storage_path) {
      await supabase.storage.from("exam-files").remove([attachment.storage_path]);
    }
    await supabase.from("exam_attachments").delete().eq("id", attachment.id);
    fetch();
  }

  /** Get a download URL for a file attachment */
  function getDownloadUrl(attachment: ExamAttachment): string | null {
    if (attachment.kind === "link") return attachment.url;
    if (attachment.kind === "note") return null;
    if (!attachment.storage_path) return attachment.url;
    const { data } = supabase.storage
      .from("exam-files")
      .getPublicUrl(attachment.storage_path);
    return data?.publicUrl ?? null;
  }

  return { attachments, loading, addNote, updateNote, addLink, uploadFile, remove, getDownloadUrl, refetch: fetch };
}
