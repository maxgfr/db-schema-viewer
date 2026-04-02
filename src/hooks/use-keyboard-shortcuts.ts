"use client";

import { useEffect } from "react";

interface ShortcutHandlers {
  onSave?: () => void;
  onExport?: () => void;
  onAI?: () => void;
  onEscape?: () => void;
  onImport?: () => void;
  onShare?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      // Cmd+Shift+S — Share (must check before Cmd+S)
      if (isMod && e.shiftKey && key === "s") {
        e.preventDefault();
        handlers.onShare?.();
        return;
      }

      if (isMod && !e.shiftKey && key === "s") {
        e.preventDefault();
        handlers.onSave?.();
        return;
      }

      if (isMod && key === "e") {
        e.preventDefault();
        handlers.onExport?.();
        return;
      }

      if (isMod && key === "k") {
        e.preventDefault();
        handlers.onAI?.();
        return;
      }

      if (isMod && key === "i") {
        e.preventDefault();
        handlers.onImport?.();
        return;
      }

      if (key === "escape") {
        handlers.onEscape?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers]);
}
