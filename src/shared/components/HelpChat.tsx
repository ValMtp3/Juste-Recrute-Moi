import { useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import type { ApiFetch } from "../../types";

type Msg = { role: "user" | "assistant"; content: string };

const STARTER: Msg = {
  role: "assistant",
  content: "Demandez-moi comment utiliser Juste Recrute Moi, configurer les sources, générer un dossier ou comprendre une offre.",
};

const HELP_SUGGESTIONS = [
  "Comment lancer un scan efficace ?",
  "Pourquoi j'ai peu d'offres visibles ?",
  "Comment configurer France Travail ?",
  "Comment générer un dossier de candidature ?",
];

async function helpErrorMessage(response: Response) {
  const detail = await response.clone().json().then((data: { detail?: unknown; message?: unknown }) => (
    String(data.detail || data.message || "")
  )).catch(() => "");

  if (response.status === 404) {
    return "L'aide intégrée n'est pas disponible dans le backend actif. Redémarrez l'application si le backend vient de changer, puis vérifiez l'onglet Activité.";
  }
  if (response.status >= 500) {
    return `L'aide backend a échoué (${response.status}). Consultez l'onglet Activité pour voir l'erreur serveur.`;
  }
  return detail ? `L'aide a refusé la demande (${response.status}) : ${detail}` : `L'aide a retourné ${response.status}.`;
}

function readableFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("network") || lower.includes("timed out") || lower.includes("aborted")) {
    return "Backend local injoignable. Relancez Juste Recrute Moi ou ouvrez l'onglet Activité pour confirmer que le service est démarré.";
  }
  return message || "Le chat d'aide a échoué.";
}

export function HelpChat({ api }: { api: ApiFetch }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([STARTER]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const canSend = Boolean(draft.trim()) && !busy;

  const subtitle = useMemo(() => busy ? "Réflexion..." : "Aide projet", [busy]);

  const scrollToBottom = () => {
    window.setTimeout(() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }), 0);
  };

  const send = async (forcedQuestion?: string) => {
    const question = (forcedQuestion ?? draft).trim();
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
      if (!r.ok) throw new Error(await helpErrorMessage(r));
      const data = await r.json();
      setMessages([...next, { role: "assistant", content: data.answer || "Je ne peux pas encore répondre à ça." }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: readableFailure(e) }]);
    } finally {
      setBusy(false);
      scrollToBottom();
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
            {messages.length === 1 && !busy && (
              <div className="help-chat-suggestions" aria-label="Questions rapides">
                {HELP_SUGGESTIONS.map(question => (
                  <button key={question} type="button" onClick={() => void send(question)}>
                    {question}
                  </button>
                ))}
              </div>
            )}
            {busy && <div className="help-chat-msg assistant">Je vérifie les infos disponibles...</div>}
          </div>
          <div className="help-chat-input">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              placeholder="Demande comment scanner, trier, adapter ou configurer..."
            />
            <button className="btn btn-accent btn-icon" onClick={() => void send()} disabled={!canSend} aria-label="Envoyer la question">
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
