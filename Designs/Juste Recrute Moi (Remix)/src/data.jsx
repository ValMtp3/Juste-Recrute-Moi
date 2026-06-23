// Sample data
const COMPANIES = [
  { name: "Linear",     mark: "L", tone: "purple" },
  { name: "Vercel",     mark: "▲", tone: "blue" },
  { name: "Stripe",     mark: "S", tone: "purple" },
  { name: "Anthropic",  mark: "A", tone: "orange" },
  { name: "Figma",      mark: "F", tone: "pink" },
  { name: "Ramp",       mark: "R", tone: "yellow" },
  { name: "Notion",     mark: "N", tone: "teal" },
  { name: "Cursor",     mark: "C", tone: "green" },
  { name: "Replit",     mark: "R", tone: "coral" },
  { name: "Supabase",   mark: "S", tone: "green" },
  { name: "Mercury",    mark: "M", tone: "blue" },
  { name: "Pitch",      mark: "P", tone: "pink" },
];

const ROLES = [
  "Senior Frontend Engineer",
  "Staff Software Engineer",
  "Full-Stack Engineer (AI Tools)",
  "Product Engineer",
  "Senior Platform Engineer",
  "Founding Engineer",
  "AI Infra Engineer",
  "Design Engineer",
  "Senior Backend Engineer",
  "Engineering Manager",
];

const STATUS_TONE = {
  discovered: { tone: "blue",   label: "Discovered" },
  evaluating: { tone: "yellow", label: "Evaluating" },
  tailoring:  { tone: "purple", label: "Tailoring"  },
  approved:   { tone: "green",  label: "Approved"   },
  applied:    { tone: "orange", label: "Applied"    },
  rejected:   { tone: "pink",   label: "Rejected"   },
};

const PLATFORMS = ["Lever", "Greenhouse", "Ashby", "Workable", "LinkedIn"];

const seed = (i) => {
  const c = COMPANIES[i % COMPANIES.length];
  const r = ROLES[i % ROLES.length];
  const stArr = ["discovered","evaluating","tailoring","approved","applied","rejected"];
  const status = stArr[(i*3+2) % stArr.length];
  return {
    id: "lead-" + (1000 + i),
    title: r,
    company: c.name,
    mark: c.mark,
    tone: c.tone,
    platform: PLATFORMS[i % PLATFORMS.length],
    location: ["Remote · US", "SF, CA", "NYC", "Remote · EU", "Remote · Global"][i % 5],
    salary: ["$180k–$230k", "$210k–$260k", "$160k–$200k", "$240k–$300k", "$190k–$240k"][i % 5],
    match: 72 + ((i * 7) % 27),
    posted: ["2h ago","6h ago","1d ago","2d ago","4h ago","12h ago"][i%6],
    status,
    asset_path: "/cache/resume_" + (1000+i) + ".pdf",
    reasoning: [
      "Your 4 years on real-time React systems (Linear-like collab tools) maps directly to their product engineer remit.",
      "Strong overlap on TypeScript, Postgres, and AI tooling. Flagged 3 of their 5 core requirements as 'expert' in your graph.",
      "Open-source contribution to LangChain raises this above their ATS threshold. Compensation band aligns with your floor.",
    ][i % 3],
  };
};

const LEADS = Array.from({ length: 18 }, (_, i) => seed(i));

const TERMINAL_LINES = [
  { lvl: "info",  t: "scraper.lever",   m: "fetched 24 listings from lever.co/linear" },
  { lvl: "ok",    t: "evaluator",       m: "match score: 0.94 · Senior Frontend (Linear)" },
  { lvl: "info",  t: "graphrag",        m: "embedding 3 new skill nodes → kuzu" },
  { lvl: "warn",  t: "rate-limit",      m: "linkedin throttled, backing off 47s" },
  { lvl: "info",  t: "tailor.resume",   m: "regenerating PDF with skills [react, ts, ws]" },
  { lvl: "ok",    t: "playwright",      m: "form filled 11/11 fields · ready" },
  { lvl: "info",  t: "scraper.gh",      m: "queued: stripe, vercel, ramp, anthropic" },
  { lvl: "info",  t: "evaluator",       m: "match score: 0.71 · Engineering Manager" },
  { lvl: "ok",    t: "tailor.resume",   m: "PDF generated · 1.2s · /cache/resume_1003.pdf" },
  { lvl: "info",  t: "graphrag",        m: "kuzu nodes: 1,247 · edges: 3,891" },
  { lvl: "warn",  t: "evaluator",       m: "skill gap detected: 'rust' · suggesting upskill" },
  { lvl: "ok",    t: "playwright",      m: "submitted application to ashby.hq/figma" },
  { lvl: "info",  t: "scraper.ashby",   m: "polling 14 boards · interval 5m" },
  { lvl: "info",  t: "ws",              m: "client connected · session 7f2a..." },
];

const SKILLS = [
  { name: "TypeScript",     years: 6, tone: "blue" },
  { name: "React",          years: 7, tone: "blue" },
  { name: "Python",         years: 5, tone: "yellow" },
  { name: "Node.js",        years: 6, tone: "green" },
  { name: "PostgreSQL",     years: 4, tone: "blue" },
  { name: "GraphQL",        years: 3, tone: "pink" },
  { name: "WebSockets",     years: 4, tone: "purple" },
  { name: "LangChain",      years: 1, tone: "orange" },
  { name: "Tailwind",       years: 3, tone: "teal" },
  { name: "AWS",            years: 4, tone: "yellow" },
  { name: "Docker",         years: 5, tone: "blue" },
  { name: "Framer Motion",  years: 2, tone: "pink" },
];

const PROJECTS = [
  { name: "Realtime collab editor", company: "Self", year: "2024", tone: "purple" },
  { name: "GraphRAG inference engine", company: "Open source", year: "2025", tone: "orange" },
  { name: "Design system @ scale", company: "Acme Co", year: "2023", tone: "pink" },
  { name: "Distributed scraper",    company: "Side project", year: "2024", tone: "green" },
];

const EXPERIENCES = [
  { role: "Senior Frontend Engineer", company: "Acme Co",   period: "2022 — Present", tone: "blue" },
  { role: "Full-Stack Engineer",      company: "Beam Labs", period: "2020 — 2022",    tone: "purple" },
  { role: "Software Engineer",        company: "Nimbus",    period: "2018 — 2020",    tone: "green" },
];

const GRAPH_STATS = [
  { key: "Candidate",  count: 1,    tone: "orange" },
  { key: "Experience", count: 14,   tone: "blue" },
  { key: "Project",    count: 23,   tone: "purple" },
  { key: "Skill",      count: 187,  tone: "green" },
  { key: "JobLead",    count: 412,  tone: "pink" },
];

window.LEADS = LEADS;
window.STATUS_TONE = STATUS_TONE;
window.TERMINAL_LINES = TERMINAL_LINES;
window.SKILLS = SKILLS;
window.PROJECTS = PROJECTS;
window.EXPERIENCES = EXPERIENCES;
window.GRAPH_STATS = GRAPH_STATS;
window.COMPANIES = COMPANIES;
