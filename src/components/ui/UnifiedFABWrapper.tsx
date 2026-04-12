"use client";

import { useState, useCallback } from "react";
import UnifiedFAB from "./UnifiedFAB";
import ChatBubble from "@/components/chat/ChatBubble";

/**
 * Combines UnifiedFAB (draggable bubble with 3 options)
 * and ChatBubble (hidden bubble, panel only).
 */
export default function UnifiedFABWrapper() {
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleToggleChat = useCallback(() => {
    setChatOpen(prev => !prev);
  }, []);

  const handleUnreadChange = useCallback((count: number) => {
    setUnreadCount(count);
  }, []);

  return (
    <>
      <UnifiedFAB
        unreadCount={unreadCount}
        chatOpen={chatOpen}
        onToggleChat={handleToggleChat}
      />
      <ChatBubble
        hideBubble
        externalOpen={chatOpen}
        onExternalToggle={handleToggleChat}
        onUnreadChange={handleUnreadChange}
      />
    </>
  );
}
