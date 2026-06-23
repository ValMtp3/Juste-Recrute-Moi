// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Vasudev Siddh and vasu-devs

import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const repoUrl = "https://github.com/ValMtp3/Juste-Recrute-Moi";
const coffeeUrl = "https://www.valentin-fiess.fr/";
const releaseNotice = {
  title: "Les fichiers de release sont en cours de publication.",
  copy: "Le dernier build est prepare par GitHub Actions. Les boutons seront actifs quand les installateurs seront disponibles.",
};

const navItems = [
  "Parcours",
  "Pourquoi local",
  "Fonctions",
  "Retours",
  "Release",
];

const pipeline = [
  { status: "Offres", count: 128, tone: "blue" },
  { status: "Classees", count: 42, tone: "yellow" },
  { status: "Brouillons", count: 16, tone: "purple" },
];

const features = [
  {
    title: "Trouver",
    copy: "Collecter de meilleures offres depuis plusieurs sources.",
    tone: "blue",
    icon: "layers",
  },
  {
    title: "Filtrer",
    copy: "Ecarter les offres obsoletes, pauvres ou peu fiables.",
    tone: "yellow",
    icon: "filter",
  },
  {
    title: "Classer",
    copy: "Expliquer pourquoi une offre merite votre attention.",
    tone: "purple",
    icon: "graph",
  },
  {
    title: "Adapter",
    copy: "Preparer CV, lettres et messages adaptes.",
    tone: "green",
    icon: "file",
  },
];

const story = [
  {
    title: "Bruit retire",
    copy: "Les mauvaises offres ne polluent pas le pipeline.",
    tone: "yellow",
  },
  {
    title: "Signal utile",
    copy: "Chaque match est note avec des raisons visibles.",
    tone: "blue",
  },
  {
    title: "Dossier pret",
    copy: "Les documents sont prepares pour relecture.",
    tone: "green",
  },
];

const intelligence = [
  {
    title: "Collecter",
    copy: "Les connecteurs normalisent les offres issues des ATS, flux, communautes et sources configurees.",
    icon: "globe",
    tone: "blue",
  },
  {
    title: "Indexer",
    copy: "Les descriptions d offres et les preuves du profil deviennent des vecteurs semantiques recherchables.",
    icon: "pulse",
    tone: "purple",
  },
  {
    title: "Relier",
    copy: "SQLite, LanceDB et le graphe de profil travaillent ensemble en local.",
    icon: "graph",
    tone: "green",
  },
  {
    title: "Classer",
    copy: "Les regles, filtres qualite, signaux profil et matching semantique produisent une pertinence explicable.",
    icon: "filter",
    tone: "yellow",
  },
];

const principles = [
  "Donnees locales par defaut",
  "Scoring explicable",
  "Relecture humaine",
  "Code source disponible",
];

const systemSignals = [
  ["Vecteurs offres", "purple"],
  ["Graphe profil", "green"],
  ["Filtre qualite", "yellow"],
  ["Memoire CRM", "blue"],
];

const platformOptions = [
  { id: "windows", label: "Windows", hint: "Installateur", tone: "blue" },
  { id: "mac", label: "macOS", hint: "DMG / PKG", tone: "purple" },
  { id: "linux", label: "Linux", hint: "AppImage / paquet", tone: "green" },
];
const BROWSER_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const VIEW_COUNTED_KEY = "juste-recrute-moi.views.counted";
const DOWNLOAD_COUNTED_PREFIX = "juste-recrute-moi.downloads.counted.";

function formatCount(value) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function getVisitorId() {
  const key = "juste-recrute-moi.visitorId";
  const existing = localStorage.getItem(key);
  if (existing) return existing;

  const next = crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(key, next);
  return next;
}

function readBrowserCache(key) {
  try {
    const cached = JSON.parse(localStorage.getItem(key) || "null");
    if (cached && Date.now() - cached.savedAt < BROWSER_CACHE_TTL_MS) {
      return cached.value;
    }
  } catch {
    localStorage.removeItem(key);
  }
  return null;
}

function writeBrowserCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value }));
  } catch {
    // Storage can be unavailable in hardened browser modes.
  }
}

async function cachedFetchJson(key, url, options) {
  const cached = readBrowserCache(key);
  if (cached) return cached;

  const response = await fetch(url, options);
  const payload = await response.json();
  writeBrowserCache(key, payload);
  return payload;
}

function hasLocalFlag(key) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function setLocalFlag(key) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Storage can be unavailable in hardened browser modes.
  }
}

function useViewCounter() {
  const [views, setViews] = React.useState(0);
  const [configured, setConfigured] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    const syncViews = async () => {
      const countedLocally = hasLocalFlag(VIEW_COUNTED_KEY);
      const payload = countedLocally
        ? await cachedFetchJson("juste-recrute-moi.views", "/api/views", {
            method: "GET",
          })
        : await cachedFetchJson("juste-recrute-moi.views", "/api/views", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ visitorId: getVisitorId() }),
          });
      if (!cancelled && typeof payload.total === "number") {
        setViews(payload.total);
        setConfigured(Boolean(payload.configured));
        if (
          payload.configured &&
          payload.writable !== false &&
          !payload.error
        ) {
          setLocalFlag(VIEW_COUNTED_KEY);
        }
      }
    };

    syncViews().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return { views, configured };
}

function useDownloadCounter() {
  const [downloads, setDownloads] = React.useState({
    total: 0,
    windows: 0,
    mac: 0,
    linux: 0,
  });
  const [configured, setConfigured] = React.useState(false);

  const syncDownloads = React.useCallback(
    async (method = "GET", platform = null) => {
      const cacheKey = platform ? null : "juste-recrute-moi.downloads";
      const options = {
        method,
        headers: { "content-type": "application/json" },
        body:
          method === "POST"
            ? JSON.stringify({ visitorId: getVisitorId(), platform })
            : undefined,
      };
      const payload = cacheKey
        ? await cachedFetchJson(cacheKey, "/api/downloads", options)
        : await fetch("/api/downloads", options).then((response) =>
            response.json(),
          );

      if (typeof payload.total === "number") {
        setDownloads({
          total: payload.total,
          windows: payload.windows || 0,
          mac: payload.mac || 0,
          linux: payload.linux || 0,
        });
        setConfigured(Boolean(payload.configured));
        writeBrowserCache("juste-recrute-moi.downloads", payload);
      }
      return payload;
    },
    [],
  );

  React.useEffect(() => {
    syncDownloads("GET").catch(() => {});
  }, [syncDownloads]);

  const trackDownload = React.useCallback(
    async (platform) => {
      const countedKey = `${DOWNLOAD_COUNTED_PREFIX}${platform}`;
      if (hasLocalFlag(countedKey)) {
        return syncDownloads("GET");
      }

      const payload = await syncDownloads("POST", platform);
      if (payload.configured && payload.writable !== false && !payload.error) {
        setLocalFlag(countedKey);
      }
      return payload;
    },
    [syncDownloads],
  );

  return { downloads, configured, trackDownload };
}

function getFirstAvailableDownload(assets) {
  for (const platform of platformOptions) {
    const asset = assets?.[platform.id];
    if (asset?.url) {
      return { platformId: platform.id, asset };
    }
  }
  return null;
}

function PlatformDownload({ platform, asset, releaseTag, onDownload }) {
  const available = Boolean(asset?.url);
  const title = available
    ? `Télécharger ${asset.name}`
    : `${platform.label} installateur en cours de publication`;
  const content = (
    <>
      <Icon name={available ? "download" : "pulse"} />
      <span>
        <strong>{platform.label}</strong>
        <small>
          {available ? releaseTag || "Derniere release" : "Publication"}
        </small>
      </span>
    </>
  );

  if (!available) {
    return (
      <button
        className={`platform-button tone-${platform.tone}`}
        type="button"
        disabled
        title={title}
      >
        {content}
      </button>
    );
  }

  return (
    <a
      className={`platform-button tone-${platform.tone}`}
      href={asset.url}
      download={asset.name}
      onClick={() => onDownload(platform.id)}
      title={title}
    >
      {content}
    </a>
  );
}

function getPreferredPlatformId() {
  const platform =
    `${navigator.platform || ""} ${navigator.userAgent || ""}`.toLowerCase();
  if (platform.includes("win")) return "windows";
  if (platform.includes("mac")) return "mac";
  if (platform.includes("linux") || platform.includes("x11")) return "linux";
  return "windows";
}

function ReleaseNoticeBanner({ compact = false, release }) {
  const latestText = release?.tag
    ? `Dernier tag : ${release.tag}`
    : "Fichiers de la derniere release";

  return (
    <div
      className={`release-notice ${compact ? "compact" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="release-notice-icon">
        <Icon name="pulse" />
      </span>
      <div>
        <strong>{release?.available ? latestText : releaseNotice.title}</strong>
        <p>
          {release?.available
            ? "Choisissez une plateforme disponible ci-dessous. Les installateurs manquants restent desactives jusqu a publication des fichiers directs."
            : releaseNotice.copy}
        </p>
      </div>
      <a
        className="button primary"
        href={release?.url || `${repoUrl}/releases`}
      >
        <Icon name="external" />
        Releases
      </a>
    </div>
  );
}

function useGitHubStars() {
  const [github, setGithub] = React.useState({
    etoiles: null,
    pullRequests: null,
  });

  React.useEffect(() => {
    let cancelled = false;

    const loadStars = async () => {
      const payload = await cachedFetchJson(
        "juste-recrute-moi.github",
        "/api/github",
      );
      if (!cancelled) {
        setGithub({
          etoiles: typeof payload.etoiles === "number" ? payload.etoiles : null,
          pullRequests:
            typeof payload.pullRequests === "number"
              ? payload.pullRequests
              : null,
        });
      }
    };

    loadStars().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return github;
}

function useLatestRelease() {
  const [release, setRelease] = React.useState({
    available: false,
    tag: null,
    url: `${repoUrl}/releases`,
    tagsUrl: `${repoUrl}/tags`,
    assets: { windows: null, mac: null, linux: null },
  });

  React.useEffect(() => {
    let cancelled = false;

    const loadRelease = async () => {
      try {
        localStorage.removeItem("juste-recrute-moi.release");
      } catch {
        // Storage can be unavailable in hardened browser modes.
      }

      const response = await fetch(`/api/releases?ts=${Date.now()}`, {
        headers: { "cache-control": "no-cache" },
      });
      const payload = await response.json();
      if (!cancelled) {
        setRelease({
          available: Boolean(payload.available),
          tag: payload.tag || null,
          url: payload.url || `${repoUrl}/releases`,
          tagsUrl: payload.tagsUrl || `${repoUrl}/tags`,
          assets: payload.assets || { windows: null, mac: null, linux: null },
        });
      }
    };

    loadRelease().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return release;
}

function useRetoursForm(kind) {
  const [state, setState] = React.useState({
    name: "",
    email: "",
    rating: kind === "a verifier" ? "5" : "",
    message: "",
    website: "",
  });
  const [status, setStatus] = React.useState({ type: "idle", message: "" });
  const [submitting, setSubmitting] = React.useState(false);

  const update = React.useCallback((event) => {
    const { name, value } = event.target;
    setState((current) => ({ ...current, [name]: value }));
  }, []);

  const submit = React.useCallback(
    async (event) => {
      event.preventDefault();
      setSubmitting(true);
      setStatus({ type: "idle", message: "" });

      try {
        const response = await fetch("/api/feedback", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...state,
            kind,
            path: window.location.pathname,
            userAgent: navigator.userAgent,
          }),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Envoi impossible pour le moment");
        }

        if (payload.delivered) {
          setStatus({
            type: "success",
            message: "Envoye. Merci pour votre aide.",
          });
          setState({
            name: "",
            email: "",
            rating: kind === "a verifier" ? "5" : "",
            message: "",
            website: "",
          });
        } else {
          setStatus({
            type: "warning",
            message:
              "Le formulaire fonctionne, mais la livraison demande les variables GitHub ou email sur le deploiement.",
          });
        }
      } catch (error) {
        setStatus({
          type: "error",
          message: error.message || "Envoi impossible pour le moment.",
        });
      } finally {
        setSubmitting(false);
      }
    },
    [kind, state],
  );

  return { state, status, submitting, update, submit };
}

function RetoursCard({ kind, title, copy, tone }) {
  const { state, status, submitting, update, submit } = useRetoursForm(kind);
  const isAvis = kind === "a verifier";

  return (
    <form className={`feedback-card tone-${tone}`} onSubmit={submit}>
      <div className="feedback-card-head">
        <span className="feature-icon">
          <Icon name={isAvis ? "star" : "message"} />
        </span>
        <div>
          <h3>{title}</h3>
          <p>{copy}</p>
        </div>
      </div>
      <label>
        <span>Nom</span>
        <input
          name="name"
          value={state.name}
          onChange={update}
          placeholder="Votre nom"
          autoComplete="name"
        />
      </label>
      <label>
        <span>Email</span>
        <input
          name="email"
          value={state.email}
          onChange={update}
          placeholder="you@example.com"
          type="email"
          autoComplete="email"
        />
      </label>
      {isAvis && (
        <label>
          <span>Note</span>
          <select name="rating" value={state.rating} onChange={update}>
            <option value="5">5 - Excellent</option>
            <option value="4">4 - Utile</option>
            <option value="3">3 - Prometteur</option>
            <option value="2">2 - A ameliorer</option>
            <option value="1">1 - Pas encore pret</option>
          </select>
        </label>
      )}
      <label className="span-full">
        <span>{isAvis ? "Avis" : "Retours"}</span>
        <textarea
          name="message"
          value={state.message}
          onChange={update}
          placeholder={
            isAvis
              ? "Ce qui fonctionne, ce qui bloque, et a qui recommander l outil ?"
              : "Bug, idee, incomprehension, demande de fonction ou autre retour."
          }
          required
          rows="5"
        />
      </label>
      <input
        className="hidden-field"
        name="website"
        value={state.website}
        onChange={update}
        tabIndex="-1"
        autoComplete="off"
        aria-hidden="true"
      />
      <div className="feedback-actions">
        <button className="button primary" type="submit" disabled={submitting}>
          <Icon name={submitting ? "pulse" : "arrow"} />
          {submitting ? "Envoi" : "Envoyer"}
        </button>
        <a className="button secondary" href={`${repoUrl}/issues/new`}>
          <Icon name="github" />
          Issue GitHub
        </a>
      </div>
      {status.message && (
        <p className={`form-status ${status.type}`}>{status.message}</p>
      )}
    </form>
  );
}

function Icon({ name }) {
  if (name === "logo") {
    return (
      <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="1" y="1" width="30" height="30" rx="9" fill="#1F1A14" />
        <path
          d="M10 21 L10 11 M10 11 L16 11 Q22 11 22 16 Q22 21 16 21 L13 21"
          stroke="#F4EFE6"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="22" cy="11" r="2" fill="#C96442" />
      </svg>
    );
  }

  const paths = {
    download: "M12 3v12 M7 10l5 5 5-5 M5 21h14",
    spark:
      "M12 3v4 M12 17v4 M3 12h4 M17 12h4 M5.6 5.6l2.8 2.8 M15.6 15.6l2.8 2.8 M5.6 18.4l2.8-2.8 M15.6 8.4l2.8-2.8",
    graph:
      "M12 5a2 2 0 1 0 0 .1 M5 18a2 2 0 1 0 0 .1 M19 18a2 2 0 1 0 0 .1 M8.5 11a2 2 0 1 0 0 .1 M15.5 11a2 2 0 1 0 0 .1 M12 7v2 M10 12l-3 4 M14 12l3 4 M10 11h4",
    arrow: "M5 12h14 M13 6l6 6-6 6",
    check: "M5 12l5 5L20 7",
    layers: "M12 3 2 8l10 5 10-5-10-5Z M2 13l10 5 10-5 M2 18l10 5 10-5",
    filter: "M22 3H2l8 9.5V19l4 2v-8.5L22 3z",
    file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6",
    pulse: "M3 12h4l3-8 4 16 3-8h4",
    user: "M12 8a4 4 0 1 0 0 .1 M4 21c0-4 4-7 8-7s8 3 8 7",
    star: "M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1L12 2z",
    github:
      "M9 19c-5 1.5-5-2.5-7-3 M15 22v-3.9a3.4 3.4 0 0 0-.9-2.6c3-.3 6.1-1.5 6.1-6.6a5.2 5.2 0 0 0-1.4-3.6 4.8 4.8 0 0 0-.1-3.6s-1.1-.3-3.7 1.4a12.7 12.7 0 0 0-6.7 0C5.7.4 4.6.7 4.6.7a4.8 4.8 0 0 0-.1 3.6A5.2 5.2 0 0 0 3.1 8c0 5.1 3.1 6.3 6.1 6.6a3.4 3.4 0 0 0-.9 2.6V22",
    globe:
      "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3 12h18 M12 3a14 14 0 0 1 0 18 M12 3a14 14 0 0 0 0 18",
    xlogo: "M4 4l16 16 M20 4L4 20",
    ban: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M5.6 5.6l12.8 12.8",
    external:
      "M14 3h7v7 M21 3l-9 9 M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6",
    tag: "M20.5 13.5l-7 7a2 2 0 0 1-2.8 0L3 12.8V3h9.8l7.7 7.7a2 2 0 0 1 0 2.8z M7.5 7.5h.1",
    laptop: "M4 5h16v10H4z M2 19h20 M8 19h8",
    message: "M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z",
    coffee:
      "M4 7h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V7z M17 9h1.5a2.5 2.5 0 0 1 0 5H17 M6 21h10 M8 3v2 M12 3v2 M16 3v2",
  };

  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name].split(" M").map((d, index) => (
        <path key={index} d={index === 0 ? d : `M${d}`} />
      ))}
    </svg>
  );
}

function ParcoursAsset() {
  const steps = [
    ["Profil", "user", "green"],
    ["Offres", "layers", "blue"],
    ["Score", "graph", "purple"],
    ["Brouillon", "file", "orange"],
  ];

  return (
    <div
      className="workflow-asset"
      aria-label="Parcours anime Juste Recrute Moi"
    >
      {steps.map(([label, icon, tone], index) => (
        <React.Fragment key={label}>
          <div className={`flow-chip tone-${tone}`}>
            <Icon name={icon} />
            <span>{label}</span>
          </div>
          {index < steps.length - 1 && <span className="flow-arrow" />}
        </React.Fragment>
      ))}
    </div>
  );
}

function IntelligenceMap() {
  return (
    <div
      className="intel-map"
      aria-label="Systeme d intelligence Juste Recrute Moi"
    >
      <div className="intel-center">
        <Icon name="logo" />
        <strong>Moteur de matching local</strong>
        <span>Graphe profil + embeddings + CRM</span>
      </div>
      {intelligence.map((item, index) => (
        <article
          className={`intel-node intel-node-${index + 1} tone-${item.tone}`}
          key={item.title}
        >
          <span className="feature-icon">
            <Icon name={item.icon} />
          </span>
          <div>
            <h3>{item.title}</h3>
            <p>{item.copy}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function MiniApp() {
  return (
    <div
      className="app-pa verifier"
      aria-label="Juste Recrute Moi apercu produit"
    >
      <aside className="pa verifier-sidebar">
        <div className="brand-mini">
          <Icon name="logo" />
          <span>Juste Recrute Moi</span>
        </div>
        {[
          "Adapter",
          "Tableau de bord",
          "Offres",
          "Pipeline d offres",
          "Connaissances",
        ].map((item, index) => (
          <div
            className={`pa verifier-nav ${index === 3 ? "active" : ""}`}
            key={item}
          >
            <span
              className={`nav-dot tone-${["green", "blue", "orange", "purple", "teal"][index]}`}
            />
            {item}
          </div>
        ))}
        <div className="pa verifier-status">
          <span className="live-dot" />
          Agent local pret
          <small>derniere release active</small>
        </div>
      </aside>
      <main className="pa verifier-main">
        <div className="pa verifier-top">
          <div>
            <span className="eyebrow">Pipeline</span>
            <h3>Recherche d emploi orientee signal</h3>
          </div>
          <button className="tiny-button">
            <Icon name="spark" /> Scan
          </button>
        </div>
        <div className="score-card">
          <div>
            <span className="eyebrow">Aujourd hui</span>
            <strong>3 offres tres pertinentes</strong>
            <small>2 brouillons prets a relire</small>
          </div>
          <span className="score-ring">94</span>
        </div>
        <div className="system-signals" aria-label="Signaux de matching">
          {systemSignals.map(([label, tone]) => (
            <span className={`tone-${tone}`} key={label}>
              {label}
            </span>
          ))}
        </div>
        <div className="pa verifier-grid">
          {pipeline.map((item) => (
            <div className={`metric tone-${item.tone}`} key={item.status}>
              <strong>{item.count}</strong>
              <span>{item.status}</span>
            </div>
          ))}
        </div>
        <div className="job-list">
          {[
            ["Ingenieur founding", "Remote - infra produit - 94%"],
            ["Ingenieur outils IA", "Hybride - TypeScript - 88%"],
            [
              "Developpeur full-stack",
              "Remote - culture build in public - 82%",
            ],
          ].map(([title, meta], index) => (
            <div className="job-row" key={title}>
              <span
                className={`job-mark tone-${["green", "purple", "orange"][index]}`}
              >
                {title[0]}
              </span>
              <div>
                <strong>{title}</strong>
                <small>{meta}</small>
              </div>
              <span className="a verifier-pill">a verifier</span>
            </div>
          ))}
        </div>
        <div className="pa verifier-docs">
          <div className="doc-card resume-doc">
            <span className="doc-icon">
              <Icon name="file" />
            </span>
            <strong>CV adapte</strong>
            <small>Projets relies aux preuves demandees</small>
            <div className="doc-lines">
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="doc-card outreach-doc">
            <span className="doc-icon">
              <Icon name="pulse" />
            </span>
            <strong>Message d approche</strong>
            <small>Message fondateur + variante LinkedIn</small>
            <div className="doc-lines">
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function App() {
  const { views, configured } = useViewCounter();
  const { downloads, trackDownload } = useDownloadCounter();
  const github = useGitHubStars();
  const release = useLatestRelease();
  const hasReleaseAssets = platformOptions.some(
    (platform) => release.assets?.[platform.id]?.url,
  );
  const preferredPlatformId = React.useMemo(getPreferredPlatformId, []);
  const preferredAsset = release.assets?.[preferredPlatformId];
  const availableDownload = preferredAsset?.url
    ? { platformId: preferredPlatformId, asset: preferredAsset }
    : getFirstAvailableDownload(release.assets);

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Juste Recrute Moi accueil">
          <Icon name="logo" />
          <span>Juste Recrute Moi</span>
        </a>
        <nav aria-label="Navigation principale">
          {navItems.map((item) => (
            <a key={item} href={`#${item.toLowerCase().replace(" ", "-")}`}>
              {item}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <a
            className="header-link hide-mobile"
            href="https://www.valentin-fiess.fr/"
          >
            <Icon name="globe" /> <span>Portfolio</span>
          </a>
          <a
            className="header-link hide-mobile"
            href="https://www.valentin-fiess.fr/"
          >
            <Icon name="xlogo" /> <span>X</span>
          </a>
          <a className="header-link support-link" href={coffeeUrl}>
            <Icon name="coffee" /> <span>Support</span>
          </a>
          <a className="header-link" href={repoUrl}>
            <Icon name="github" /> <span>GitHub</span>
          </a>
        </div>
      </header>

      <main id="top">
        <section className="hero band">
          <div className="hero-copy">
            <span className="eyebrow">
              Agregateur local-first d offres d emploi
            </span>
            <h1>Juste Recrute Moi</h1>
            <p>
              A local-first workbench that turns noisy job hunting into a clear,
              a verifierable pipeline.
            </p>
            <div className="proof-line">
              <span>Matching semantique</span>
              <span>Construit publiquement</span>
              <span>Desktop d abord</span>
            </div>
            <div className="hero-actions">
              {availableDownload ? (
                <a
                  className="button primary"
                  href={availableDownload.asset.url}
                  download={availableDownload.asset.name}
                  onClick={() => trackDownload(availableDownload.platformId)}
                  title={`Télécharger ${availableDownload.asset.name}`}
                >
                  <Icon name="download" />
                  Télécharger
                </a>
              ) : (
                <button
                  className="button primary"
                  type="button"
                  disabled
                  title="Les installateurs sont encore en publication"
                >
                  <Icon name="pulse" />
                  Téléchargement en attente
                </button>
              )}
              <a className="button secondary" href={repoUrl}>
                <Icon name="star" />
                {github.etoiles == null
                  ? "Etoiles GitHub"
                  : `${formatCount(github.etoiles)} etoiles`}
              </a>
            </div>
            <div
              className="hero-downloads"
              aria-label="Derniers téléchargements"
            >
              {platformOptions.map((platform) => (
                <PlatformDownload
                  key={platform.id}
                  platform={platform}
                  asset={release.assets?.[platform.id]}
                  releaseTag={release.tag}
                  onDownload={trackDownload}
                />
              ))}
            </div>
            {!hasReleaseAssets && (
              <div className="wait-note">
                <span className="spinner" />
                Les installateurs sont encore en publication. Télécharger
                controls will stay disabled until direct assets are ready.
              </div>
            )}
            <div
              className="live-counter"
              title={
                configured
                  ? "Alimente par le compteur de vues deploye"
                  : "Relier Upstash Redis on Vercel to persist this counter"
              }
            >
              <span className="live-dot" />
              <strong>{formatCount(views)}</strong>
              <span>vues uniques suivies</span>
            </div>
            <div className="metric-strip">
              {[
                [
                  github.etoiles == null ? "-" : formatCount(github.etoiles),
                  "Etoiles GitHub",
                ],
                [
                  github.pullRequests == null
                    ? "-"
                    : formatCount(github.pullRequests),
                  "PR ouvertes",
                ],
                [formatCount(downloads.total), "téléchargements"],
                [formatCount(views), "vues uniques"],
              ].map(([value, label]) => (
                <div key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <MiniApp />
        </section>

        <section id="workflow" className="section band paper-2">
          <div className="section-head">
            <span className="eyebrow">Parcours</span>
            <h2>
              Trouvez l offre, comprenez la pertinence, preparez la candidature.
            </h2>
          </div>
          <ParcoursAsset />
          <div className="story-grid">
            {story.map((item) => (
              <article
                className={`story-card tone-${item.tone}`}
                key={item.title}
              >
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </article>
            ))}
          </div>
          <div className="workflow">
            {[
              "Importer le profil",
              "Collecter les offres",
              "Filtre qualite",
              "Scorer la pertinence",
              "Adapter les brouillons",
            ].map((step, index) => (
              <div className="workflow-step" key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{step}</strong>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="section band">
          <div className="section-head">
            <span className="eyebrow">Ce que fait l app</span>
            <h2>
              Pour les candidats qui veulent du signal, du controle et de la
              vitesse.
            </h2>
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <article
                className={`feature tone-${feature.tone}`}
                key={feature.title}
              >
                <span className="feature-icon">
                  <Icon name={feature.icon} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section band paper-2">
          <div className="section-head">
            <span className="eyebrow">Couche d intelligence</span>
            <h2>Un matching avance, explique sans boite noire.</h2>
          </div>
          <IntelligenceMap />
          <div className="tech-strip">
            {[
              "Collecteurs",
              "Indexerdings d offres",
              "Indexerdings profil",
              "LanceDB",
              "SQLite CRM",
              "Kuzu graph",
              "Filtres qualite",
              "Ranker semantique",
            ].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </section>

        <section id="why-local" className="section split band paper-3">
          <div>
            <span className="eyebrow">Pourquoi local-first</span>
            <h2>
              Votre recherche doit rester privee, lisible et sous votre
              controle.
            </h2>
          </div>
          <div className="principle-list">
            {principles.map((item) => (
              <div className="principle" key={item}>
                <Icon name="check" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="feedback" className="section band paper-2">
          <div className="section-head">
            <span className="eyebrow">Retours</span>
            <h2>Dites ce qu il faut corriger, polir ou garder tel quel.</h2>
          </div>
          <div className="feedback-grid">
            <RetoursCard
              kind="feedback"
              title="Formulaire de retour"
              copy="Partagez bugs, irritants, sources manquantes, problemes d installation ou idees de parcours."
              tone="blue"
            />
            <RetoursCard
              kind="a verifier"
              title="Avis utilisateur"
              copy="Laissez un avis court avec une note et des remarques concretes."
              tone="green"
            />
          </div>
          <div className="support-callout">
            <div>
              <span className="eyebrow">Soutenir le projet</span>
              <h3>Faire avancer la feuille de route open source.</h3>
              <p>
                Juste Recrute Moi est construit publiquement. Le soutien aide a
                maintenir les releases, les connecteurs et la documentation.
              </p>
            </div>
            <a className="button primary" href={coffeeUrl}>
              <Icon name="coffee" />
              Site de Valentin
            </a>
          </div>
        </section>

        <section id="release" className="section final-cta band">
          <span className="eyebrow">Statut de release</span>
          <h2>
            {release.tag
              ? `${release.tag} - telechargements`
              : "Derniers téléchargements"}
          </h2>
          <p>
            Telechargez le dernier build public. Les statistiques restent a jour
            et les liens se synchronisent avec GitHub Releases.
          </p>
          <div
            className="hero-downloads release-downloads"
            aria-label="Derniers telechargements par plateforme"
          >
            {platformOptions.map((platform) => (
              <PlatformDownload
                key={platform.id}
                platform={platform}
                asset={release.assets?.[platform.id]}
                releaseTag={release.tag}
                onDownload={trackDownload}
              />
            ))}
          </div>
          {!hasReleaseAssets && <ReleaseNoticeBanner release={release} />}
          <div className="download-proof">
            <Icon name="download" />
            <strong>{formatCount(downloads.total)}</strong>
            <span>téléchargements suivis</span>
          </div>
          <div className="download-breakdown">
            {platformOptions.map((platform) => (
              <span className={`tone-${platform.tone}`} key={platform.id}>
                {platform.label}
                <strong>{formatCount(downloads[platform.id] || 0)}</strong>
              </span>
            ))}
          </div>
          <div className="hero-actions centered">
            <a
              className="button primary"
              href={release.url || `${repoUrl}/releases`}
            >
              <Icon name="external" /> Release GitHub
            </a>
            <a className="button secondary" href={repoUrl}>
              <Icon name="github" /> Voir le code
            </a>
          </div>
          <div className="creator-links" aria-label="Liens createur">
            <a href="https://www.valentin-fiess.fr/">valentin-fiess.fr</a>
            <a href="https://www.valentin-fiess.fr/">Valentin Fiess</a>
            <a href={coffeeUrl}>Site de Valentin</a>
          </div>
        </section>
      </main>

      <footer>
        <span>Juste Recrute Moi</span>
        <span className="footer-legal">
          <a href="/legal/terms-of-use.html">Conditions</a>
          <a href="/legal/privacy-policy.html">Confidentialite</a>
        </span>
        <span>Cree par Valentin Fiess</span>
      </footer>
    </>
  );
}

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(<App />);
}
