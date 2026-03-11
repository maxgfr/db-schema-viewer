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

      // Cmd+Shift+S — Share (must check before Cmd+S)
      if (isMod && e.shiftKey && e.key === "S") {
        e.preventDefault();
        handlers.onShare?.();
        return;
      }

      if (isMod && !e.shiftKey && e.key === "s") {
        e.preventDefault();
        handlers.onSave?.();
        return;
      }

      if (isMod && e.key === "e") {
        e.preventDefault();
        handlers.onExport?.();
        return;
      }

      if (isMod && e.key === "k") {
        e.preventDefault();
        handlers.onAI?.();
        return;
      }

      if (isMod && e.key === "i") {
        e.preventDefault();
        handlers.onImport?.();
        return;
      }

      if (e.key === "Escape") {
        handlers.onEscape?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers]);
}
