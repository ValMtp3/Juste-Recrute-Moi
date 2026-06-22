export function CreatorFooter({ compact = false }: { compact?: boolean }) {
  return (
    <a
      className={"creator-footer " + (compact ? "compact" : "")}
      href="https://www.valentin-fiess.fr/"
      target="_blank"
      rel="noreferrer"
    >
      cree par Valentin Fiess 🦞
    </a>
  );
}
