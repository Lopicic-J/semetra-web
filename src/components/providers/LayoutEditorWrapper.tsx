"use client";

import { LayoutEditorProvider, useLayoutEditorState } from "@/lib/hooks/useLayoutEditor";

export default function LayoutEditorWrapper({ children }: { children: React.ReactNode }) {
  const state = useLayoutEditorState();

  return (
    <LayoutEditorProvider value={state}>
      {children}
    </LayoutEditorProvider>
  );
}
