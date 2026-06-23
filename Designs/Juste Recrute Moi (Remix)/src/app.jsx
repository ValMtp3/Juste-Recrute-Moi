// App root — orchestrates everything
const { useState, useEffect, useRef } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "showTweaks": true
}/*EDITMODE-END*/;

const App = () => {
  const [view, setView] = useState("dashboard");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const [ghost, setGhost] = useState(false);
  const [terminal, setTerminal] = useState(TERMINAL_LINES.slice(0, 8));
  const [leads, setLeads] = useState(LEADS);
  const [uptime, setUptime] = useState({ d: 2, h: 14, m: 22 });

  // Live terminal stream
  useEffect(() => {
    let i = 8;
    const id = setInterval(() => {
      const next = TERMINAL_LINES[i % TERMINAL_LINES.length];
      setTerminal(t => [...t, next].slice(-200));
      i++;
    }, 2400);
    return () => clearInterval(id);
  }, []);

  // Uptime ticker
  useEffect(() => {
    const id = setInterval(() => {
      setUptime(u => {
        let m = u.m + 1, h = u.h, d = u.d;
        if (m >= 60) { m = 0; h++; }
        if (h >= 24) { h = 0; d++; }
        return { d, h, m };
      });
    }, 60000);
    return () => clearInterval(id);
  }, []);

  const leadCounts = {
    total:      leads.length,
    discovered: leads.filter(l=>l.status==="discovered").length,
    evaluating: leads.filter(l=>l.status==="evaluating").length,
    tailoring:  leads.filter(l=>l.status==="tailoring").length,
    approved:   leads.filter(l=>l.status==="approved").length,
    applied:    leads.filter(l=>l.status==="applied").length,
  };

  const onFire = (lead) => {
    setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, status: "applied" } : l));
    setTerminal(t => [...t, { lvl: "ok", t: "playwright", m: `submitted to ${lead.platform.toLowerCase()} · ${lead.company}` }]);
    setTimeout(() => setDrawer(null), 1200);
  };

  const uptimeStr = `${uptime.d}d ${uptime.h}h ${uptime.m}m`;

  return (
    <div className="row" style={{ height: "100vh" }}>
      <Sidebar
        view={view}
        setView={setView}
        leadCounts={leadCounts}
        online={true}
        latency={42}
        uptime={uptimeStr}
        onSettings={() => setSettingsOpen(true)}
      />
      <div className="app-main">
        <Topbar view={view} leadCounts={leadCounts} ghost={ghost} setGhost={setGhost}/>
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: "var(--paper)" }}>
          {view === "dashboard" && <DashboardView leads={leads} terminal={terminal} setView={setView} openDrawer={setDrawer}/>}
          {view === "pipeline"  && <PipelineView leads={leads} terminal={terminal} openDrawer={setDrawer}/>}
          {view === "graph"     && <GraphView/>}
          {view === "activity"  && <ActivityView terminal={terminal}/>}
          {view === "profile"   && <ProfileView/>}
        </div>
      </div>

      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} ghost={ghost} setGhost={setGhost}/>
      {drawer && <Drawer lead={drawer} onClose={() => setDrawer(null)} onFire={onFire}/>}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
