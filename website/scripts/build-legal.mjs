// Generates on-brand standalone HTML legal pages in website/public/legal/
// from the canonical markdown in docs/legal/. Run from repo root:
//   node website/scripts/build-legal.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const srcDir = join(repoRoot, "docs", "legal");
const outDir = join(repoRoot, "website", "public", "legal");
mkdirSync(outDir, { recursive: true });

const PAGES = [
  { md: "terms-of-use.md", out: "terms-of-use.html", title: "Terms of Use" },
  { md: "privacy-policy.md", out: "privacy-policy.html", title: "Privacy Policy" },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function inline(s) {
  // order matters: escape first, then re-introduce markup
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => {
    // keep same-folder .md links pointing at the generated .html siblings
    const href = u.replace(/\.md(#.*)?$/, ".html$1");
    return `<a href="${href}">${t}</a>`;
  });
  return s;
}

function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let i = 0;
  const flushList = (items) => { if (items.length) out.push("<ul>" + items.map((x) => `<li>${inline(x)}</li>`).join("") + "</ul>"); };
  while (i < lines.length) {
    let line = lines[i];
    if (/^\s*$/.test(line)) { i++; continue; }
    // heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    // hr
    if (/^---+\s*$/.test(line)) { out.push("<hr/>"); i++; continue; }
    // blockquote (collect consecutive >)
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`);
      continue;
    }
    // table
    if (/^\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const row = (l) => l.replace(/^\||\|\s*$/g, "").split("|").map((c) => c.trim());
      const head = row(line);
      i += 2;
      const body = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) { body.push(row(lines[i])); i++; }
      out.push(
        "<table><thead><tr>" + head.map((c) => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>" +
        body.map((r) => "<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") +
        "</tbody></table>"
      );
      continue;
    }
    // list
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^[-*]\s+/, "")); i++; }
      flushList(items);
      continue;
    }
    // ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s+/, "")); i++; }
      out.push("<ol>" + items.map((x) => `<li>${inline(x)}</li>`).join("") + "</ol>");
      continue;
    }
    // paragraph (collect until blank)
    const buf = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,6}\s|>|\||[-*]\s|\d+\.\s|---+\s*$)/.test(lines[i])) { buf.push(lines[i]); i++; }
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  return out.join("\n");
}

const navLinks = PAGES.map((p) => `<a href="${p.out}">${p.title}</a>`).join("");

const template = (title, body) => `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>JustHireMe — ${esc(title)}</title>
<meta name="robots" content="index,follow"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<style>
  :root{--paper:#F4F3EE;--ink:#1F1A14;--ink-2:#4A463E;--ink-3:#8A847A;--line:rgba(31,26,20,.10);--accent:#C96442;--card:#fff}
  *{box-sizing:border-box}
  body{margin:0;background:radial-gradient(1200px 700px at 50% -10%,#FBFAF6,#F1EFE8 60%,#E9E5DB);
    color:var(--ink);font-family:Inter,system-ui,-apple-system,sans-serif;line-height:1.65;font-size:15px}
  .top{position:sticky;top:0;backdrop-filter:blur(10px);background:rgba(244,243,238,.82);
    border-bottom:1px solid var(--line);z-index:10}
  .top .in{max-width:880px;margin:0 auto;padding:14px 22px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
  .top a.brand{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:18px;color:var(--ink);text-decoration:none;margin-right:auto}
  .top nav a{font-size:12.5px;color:var(--ink-2);text-decoration:none;padding:5px 9px;border-radius:8px}
  .top nav a:hover{background:rgba(31,26,20,.06);color:var(--ink)}
  main{max-width:880px;margin:0 auto;padding:34px 22px 80px}
  h1{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:34px;line-height:1.15;margin:.2em 0 .5em}
  h2{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:21px;margin:1.8em 0 .5em;padding-top:.3em}
  h3{font-size:15.5px;font-weight:700;margin:1.4em 0 .4em}
  p{margin:.7em 0;color:var(--ink-2)}
  a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
  ul,ol{margin:.6em 0 .9em;padding-left:1.3em;color:var(--ink-2)}li{margin:.3em 0}
  hr{border:0;border-top:1px solid var(--line);margin:1.8em 0}
  code{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:.86em;background:rgba(31,26,20,.06);
    padding:1px 6px;border-radius:6px;color:var(--ink)}
  blockquote{margin:1.2em 0;padding:12px 16px;background:rgba(201,100,66,.07);
    border-left:3px solid var(--accent);border-radius:0 10px 10px 0;color:var(--ink-2);font-size:13.5px}
  table{width:100%;border-collapse:collapse;margin:1.1em 0;font-size:13.5px}
  th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top}
  th{font-weight:700;color:var(--ink);background:rgba(31,26,20,.03)}
  footer{max-width:880px;margin:0 auto;padding:22px;border-top:1px solid var(--line);
    color:var(--ink-3);font-size:12px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px}
</style></head>
<body>
<div class="top"><div class="in"><a class="brand" href="/">JustHireMe</a><nav>${navLinks}</nav></div></div>
<main>${body}</main>
<footer><span>JustHireMe — local-first AI job intelligence</span><span><a href="/">← Back to site</a> · <a href="https://github.com/vasu-devs/JustHireMe">GitHub</a></span></footer>
</body></html>`;

for (const p of PAGES) {
  const md = readFileSync(join(srcDir, p.md), "utf8");
  writeFileSync(join(outDir, p.out), template(p.title, mdToHtml(md)), "utf8");
  console.log("wrote", join("website/public/legal", p.out));
}
// index
const indexBody = `<h1>Legal &amp; Privacy</h1><p>JustHireMe is local-first — your profile, leads, and generated documents stay on your device. These policies cover both the app and this site.</p><ul>${PAGES.map((p) => `<li><a href="${p.out}">${p.title}</a></li>`).join("")}</ul>`;
writeFileSync(join(outDir, "index.html"), template("Legal & Privacy", indexBody), "utf8");
console.log("wrote website/public/legal/index.html");
