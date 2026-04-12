"use client";

import { LayoutEditorProvider, useLayoutEditorState } from "@/lib/hooks/useLayoutEditor";
import LayoutEditorToggle from "@/components/ui/LayoutEditorToggle";

export default function LayoutEditorWrapper({ children }: { children: React.ReactNode }) {
  const state = useLayoutEditorState();

  return (
    <LayoutEditorProvider value={state}>
      {children}
      <LayoutEditorToggle />
    </LayoutEditorProvider>
  );
}
