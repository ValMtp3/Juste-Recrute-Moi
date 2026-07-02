import { useEffect } from "react";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

export function useKeyboardShortcuts(config: {
  onEscape: () => void;
  onCmdK: () => void;
  onCmdComma: () => void;
}) {
  const { onEscape, onCmdK, onCmdComma } = config;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      if (isEditableTarget(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === "Escape") {
        onEscape();
      }
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onCmdK();
      }
      if (mod && e.key === ",") {
        e.preventDefault();
        onCmdComma();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onEscape, onCmdK, onCmdComma]);
}
