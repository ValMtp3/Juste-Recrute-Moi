import { openExternalUrl } from "../lib/openExternal";

const CREATOR_URL = "https://www.valentin-fiess.fr/";

export function CreatorFooter({ compact = false }: { compact?: boolean }) {
  return (
    <a
      className={"creator-footer " + (compact ? "compact" : "")}
      href={CREATOR_URL}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => {
        event.preventDefault();
        void openExternalUrl(CREATOR_URL);
      }}
    >
      Cree par Valentin Fiess
    </a>
  );
}
