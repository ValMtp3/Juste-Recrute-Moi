import { useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import type { ApiFetch } from "../../types";

type Msg = { role: "user" | "assistant"; content: string };

const STARTER: Msg = {
  role: "assistant",
  content: "Demande-moi comment utiliser Juste Recrute Moi, configurer les sources, générer un dossier ou comprendre une offre.",
};

export function HelpChat({ api }: { api: ApiFetch }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([STARTER]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const canSend = Boolean(draft.trim()) && !busy;

  const subtitle = useMemo(() => busy ? "Réflexion..." : "Aide projet", [busy]);

  const send = async () => {
    const question = draft.trim();
    if (!question || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setDraft("");
    setBusy(true);
    try {
      const r = await api("/api/v1/help/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history: next.slice(-8) }),
      });
      if (!r.ok) throw new Error(`L'aide a retourné ${r.status}`);
      const data = await r.json();
      setMessages([...next, { role: "assistant", content: data.answer || "Je ne peux pas encore répondre à ça." }]);
      window.setTimeout(() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }), 0);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: e instanceof Error ? e.message : "Le chat d'aide a échoué." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="help-chat">
      {open && (
        <section className="help-chat-panel">
          <div className="help-chat-head">
            <div>
              <div className="eyebrow">Assistant Juste Recrute Moi</div>
              <div className="help-chat-title">{subtitle}</div>
            </div>
            <button className="btn btn-icon" onClick={() => setOpen(false)} aria-label="Fermer l'aide">
              <Icon name="x" size={14} />
            </button>
          </div>
          <div className="help-chat-messages" ref={scroller}>
            {messages.map((m, i) => (
              <div key={i} className={`help-chat-msg ${m.role}`}>
                {m.content}
              </div>
            ))}
          </div>
          <div className="help-chat-input">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={2}
              placeholder="Demande comment scanner, trier, adapter ou configurer..."
            />
            <button className="btn btn-accent btn-icon" onClick={send} disabled={!canSend} aria-label="Envoyer la question">
              <Icon name="arrow-up" size={14} color="#fff" />
            </button>
          </div>
        </section>
      )}
      <button className="help-chat-fab" onClick={() => setOpen(v => !v)} aria-label="Ouvrir l'aide">
        <Icon name="spark" size={18} color="#fff" />
      </button>
    </div>
  );
}
