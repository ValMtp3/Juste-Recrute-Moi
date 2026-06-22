// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Vasudev Siddh and vasu-devs

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./shared/components/ErrorBoundary";
import { initTheme } from "./shared/lib/theme";
import "./index.css";

initTheme();

function renderFatalStartupError(error: unknown) {
  const root = document.getElementById("root");
  if (!root) return;

  const message = error instanceof Error ? error.message : String(error);
  root.innerHTML = `
    <div style="min-height:100vh;display:grid;place-items:center;background:#f6f3ec;color:#201b16;padding:24px;font-family:'Space Grotesk',Inter,Segoe UI,Arial,sans-serif">
      <section style="width:min(720px,100%);background:#fffdf8;border:1px solid #ded8cc;border-radius:12px;padding:28px;box-shadow:0 18px 48px rgba(32,27,22,.08)">
        <div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#7b7165">Erreur de démarrage Juste Recrute Moi</div>
        <h1 style="font-size:28px;line-height:1.15;margin:10px 0 12px">L'interface n'a pas fini de charger</h1>
        <p style="color:#5d544b;line-height:1.6;margin:0 0 16px">Relance Juste Recrute Moi une fois. Si ce message reste visible, envoie-le avec ton OS et le type d'installateur.</p>
        <pre style="white-space:pre-wrap;background:#f3eee6;border:1px solid #ded8cc;border-radius:8px;padding:12px;color:#9b2f1f;font-size:12px;line-height:1.5">${message.replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] ?? c))}</pre>
      </section>
    </div>
  `;
}

try {
  const root = document.getElementById("root");
  if (!root) throw new Error("Missing #root mount node");

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      {/* Last-resort boundary: the try/catch below only covers the synchronous
          initial render, not crashes on later re-renders. */}
      <ErrorBoundary label="Juste Recrute Moi">
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
} catch (error) {
  renderFatalStartupError(error);
}
