// Profile / Ingestion view — matte
const Profile = ({ skills, projects, ingested, onIngest, onClear }) => {
  const [over, setOver] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [busy, setBusy] = React.useState(false);

  const handleDrop = (e) => {
    e.preventDefault(); setOver(false);
    if (ingested) return;
    setBusy(true);
    let p = 0;
    const tick = setInterval(() => {
      p += Math.random() * 18 + 6;
      setProgress(Math.min(100, p));
      if (p >= 100) { clearInterval(tick); setBusy(false); onIngest(); setProgress(0); }
    }, 150);
  };

  const tones = ["var(--sage)","var(--mauve)","var(--clay)","var(--sky)","var(--butter)","var(--rose)"];
  const toneInks = ["var(--sage-ink)","var(--mauve-ink)","var(--clay-ink)","var(--sky-ink)","var(--butter-ink)","var(--rose-ink)"];

  return (
    <div style={{ flex: 1, padding: "14px 22px 22px 22px", overflowY: "auto", minHeight: 0 }}>
      <div className="col gap-4">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
          <div className="col gap-2">
            <span className="eyebrow">Profile · The Brain</span>
            <h1 style={{ fontSize: 36, lineHeight: 1.05 }}>Teach the agent <span style={{ color: "var(--ink-3)", fontStyle: "italic" }}>who you are.</span></h1>
            <p style={{ color: "var(--ink-2)", fontSize: 14, maxWidth: 580, margin: 0 }}>
              Drop a resume. Local GraphRAG extracts skills, projects, and experience into your Kùzu graph. Nothing leaves this machine.
            </p>
          </div>
          {ingested && (
            <button className="btn" onClick={onClear} style={{ color: "var(--bad)" }}>
              <Icon name="trash" size={14}/> Clear graph
            </button>
          )}
        </div>

        <div
          className={"dropzone " + (over ? "over" : "")}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={handleDrop}
          onClick={() => !ingested && !busy && handleDrop({ preventDefault: () => {} })}
          style={{ padding: "52px 32px", cursor: ingested ? "default" : "pointer", minHeight: 220 }}
        >
          <div className="col gap-3" style={{ alignItems: "center", textAlign: "center" }}>
            {!ingested && !busy && (
              <>
                <div style={{
                  width: 72, height: 72, borderRadius: 18,
                  background: "var(--card)",
                  border: "1px solid var(--line-2)",
                  display: "grid", placeItems: "center",
                  boxShadow: "var(--shadow-md)",
                }}>
                  <Icon name="upload" size={26} stroke={1.6}/>
                </div>
                <div className="col gap-1" style={{ alignItems: "center" }}>
                  <h2 style={{ fontSize: 22, fontFamily: "var(--font-serif)", fontWeight: 500 }}>Drop your résumé here</h2>
                  <p style={{ color: "var(--ink-3)", fontSize: 13, margin: 0 }}>PDF · DOCX · TXT &nbsp;·&nbsp; up to 10 MB</p>
                </div>
                <button className="btn btn-accent" style={{ marginTop: 6 }}>
                  <Icon name="file" size={14}/> Choose file
                </button>
              </>
            )}
            {busy && (
              <div className="col gap-3" style={{ alignItems: "center", width: "100%", maxWidth: 360 }}>
                <Icon name="spark" size={28} style={{ animation: "spin-slow 2s linear infinite", color: "var(--accent)" }}/>
                <h3 style={{ fontSize: 16 }}>Embedding · {Math.round(progress)}%</h3>
                <div style={{ width: "100%", height: 6, borderRadius: 999, background: "var(--line)", overflow: "hidden" }}>
                  <div style={{
                    width: progress + "%", height: "100%",
                    background: "var(--accent)",
                    transition: "width .12s linear",
                  }}/>
                </div>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>extracting entities · graph.write()</span>
              </div>
            )}
            {ingested && (
              <div className="col gap-3" style={{ alignItems: "center" }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 18,
                  background: "var(--sage)",
                  display: "grid", placeItems: "center",
                  border: "1px solid color-mix(in oklch, var(--sage-ink) 25%, transparent)",
                  color: "var(--sage-ink)",
                }}>
                  <Icon name="check" size={30} stroke={2.2}/>
                </div>
                <div className="col gap-1" style={{ alignItems: "center" }}>
                  <h2 style={{ fontSize: 20, fontFamily: "var(--font-serif)", fontWeight: 500 }}>resume_v4.pdf · ingested</h2>
                  <p className="mono" style={{ color: "var(--ink-3)", fontSize: 11, margin: 0 }}>
                    {skills.length} skills · {projects.length} projects · 8 experiences embedded
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {ingested && (
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
            <div className="card col gap-3" style={{ padding: 22 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="col gap-1">
                  <span className="eyebrow">Extracted · Skills</span>
                  <h3 style={{ fontSize: 18 }}>{skills.length} skill nodes</h3>
                </div>
                <button className="btn btn-icon"><Icon name="plus" size={14}/></button>
              </div>
              <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                {skills.map((s, i) => (
                  <span key={s} style={{
                    padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 500,
                    background: tones[i % tones.length],
                    color: toneInks[i % toneInks.length],
                  }}>{s}</span>
                ))}
              </div>
            </div>

            <div className="card col gap-3" style={{ padding: 22 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="col gap-1">
                  <span className="eyebrow">Extracted · Projects</span>
                  <h3 style={{ fontSize: 18 }}>{projects.length} project nodes</h3>
                </div>
                <button className="btn btn-icon"><Icon name="plus" size={14}/></button>
              </div>
              <div className="col gap-2">
                {projects.map((p, i) => (
                  <div key={p.name} className="row lift" style={{
                    padding: "10px 12px", borderRadius: 10,
                    background: "var(--paper-2)", border: "1px solid var(--line)",
                    justifyContent: "space-between",
                  }}>
                    <div className="row gap-3">
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: tones[i % tones.length], color: toneInks[i % toneInks.length],
                        display: "grid", placeItems: "center",
                      }}>
                        <Icon name="bolt" size={14}/>
                      </div>
                      <div className="col">
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</span>
                        <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{p.note}</span>
                      </div>
                    </div>
                    <button className="btn btn-icon"><Icon name="external" size={13}/></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

window.Profile = Profile;
