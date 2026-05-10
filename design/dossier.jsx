// DOSSIER — investigative document aesthetic
// Mono type, off-white paper, redactions, classified stamps, transcript layout.
// All four screens for the Paranoia game, mobile-sized (375x812).

const dossier = {
  paper: "#efe9dc",
  paper2: "#e8e1d0",
  ink: "#1a1815",
  ink2: "#3a3530",
  faded: "#7a6f60",
  rule: "#1a1815",
  red: "#a32118",
  redInk: "#8a1c14",
  stampBg: "rgba(163,33,24,0.08)",
  font: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace",
};

// ---------- shared chrome ----------

const DossierFrame = ({ children, caseNo = "PR-2148-09", classification = "CONFIDENTIAL", page = 1, totalPages = 4 }) => (
  <div style={{
    width: 375, height: 812, background: dossier.paper, color: dossier.ink,
    fontFamily: dossier.font, fontSize: 11, lineHeight: 1.5, position: "relative",
    overflow: "hidden",
    backgroundImage: `repeating-linear-gradient(0deg, rgba(0,0,0,0.012) 0 1px, transparent 1px 4px),
                      radial-gradient(circle at 30% 20%, rgba(120,90,40,0.04), transparent 60%),
                      radial-gradient(circle at 80% 80%, rgba(80,40,20,0.05), transparent 50%)`,
  }}>
    {/* top header strip */}
    <div style={{
      borderBottom: `1.5px solid ${dossier.ink}`,
      padding: "10px 14px 8px",
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      fontSize: 9, letterSpacing: 0.5, textTransform: "uppercase",
    }}>
      <span style={{ fontWeight: 700 }}>FORM 14-B / PARANOIA</span>
      <span style={{ color: dossier.faded }}>{caseNo}</span>
    </div>
    <div style={{
      borderBottom: `0.5px solid ${dossier.ink}`,
      padding: "4px 14px",
      display: "flex", justifyContent: "space-between",
      fontSize: 8.5, letterSpacing: 1.2, color: dossier.redInk, fontWeight: 700,
    }}>
      <span>// {classification} //</span>
      <span>PG {String(page).padStart(2,"0")}/{String(totalPages).padStart(2,"0")}</span>
    </div>
    {children}
    {/* bottom footer */}
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0,
      borderTop: `0.5px solid ${dossier.ink}`,
      padding: "6px 14px",
      display: "flex", justifyContent: "space-between",
      fontSize: 8, letterSpacing: 1, color: dossier.faded,
    }}>
      <span>DO NOT REPRODUCE</span>
      <span>05·10·26 · 14:22Z</span>
    </div>
  </div>
);

const Stamp = ({ children, color = dossier.redInk, rotate = -8, style = {} }) => (
  <div style={{
    display: "inline-block",
    border: `2.5px solid ${color}`,
    color, fontWeight: 800, letterSpacing: 2,
    fontSize: 10, padding: "5px 9px",
    transform: `rotate(${rotate}deg)`,
    background: "transparent",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.4)",
    fontFamily: dossier.font,
    opacity: 0.92,
    ...style,
  }}>{children}</div>
);

const FieldRow = ({ label, value, mono = true }) => (
  <div style={{ display: "flex", borderBottom: `0.5px dashed ${dossier.ink}`, padding: "5px 0", fontSize: 10 }}>
    <span style={{ width: 90, color: dossier.faded, letterSpacing: 0.5, textTransform: "uppercase", fontSize: 9 }}>{label}</span>
    <span style={{ flex: 1, fontWeight: mono ? 600 : 400 }}>{value}</span>
  </div>
);

// ---------- 1a. SETUP (host picks options) ----------

const SelectRow = ({ label, value, options, active }) => (
  <div style={{ borderBottom: `0.5px dashed ${dossier.ink}`, padding: "10px 0 12px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
      <span style={{ fontSize: 9, letterSpacing: 1.2, color: dossier.faded, fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 9, color: dossier.ink }}>{value}</span>
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      {options.map((o) => (
        <span key={o} style={{
          padding: "5px 9px",
          border: `1px solid ${dossier.ink}`,
          background: o === active ? dossier.ink : "transparent",
          color: o === active ? dossier.paper : dossier.ink,
          fontSize: 10, letterSpacing: 0.5, fontWeight: 600,
          fontFamily: dossier.font, cursor: "pointer",
        }}>{o}</span>
      ))}
    </div>
  </div>
);

const DossierSetup = () => (
  <DossierFrame page={1}>
    <div style={{ padding: "18px 14px 0" }}>
      <div style={{ fontSize: 9, letterSpacing: 1.5, color: dossier.faded, marginBottom: 4 }}>SECTION 0 — REQUISITION</div>
      <div style={{
        fontFamily: dossier.font, fontWeight: 800, fontSize: 30, lineHeight: 1.05,
        letterSpacing: -0.5,
      }}>
        OPEN A<br/>NEW FILE.
      </div>
      <div style={{ fontSize: 10, color: dossier.ink2, marginTop: 8, maxWidth: 290 }}>
        Configure conditions of conversation. You are the case officer.
        Your counterpart will inherit these terms.
      </div>
    </div>

    <div style={{ padding: "16px 14px 0" }}>
      <SelectRow label="HOST" value="YOU · REN" options={["REN"]} active="REN" />
      <SelectRow label="TOPIC CATEGORY"
        value="SUBJECT'S CHOICE"
        options={["BELIEF", "MEMORY", "CONFESSION", "WHAT-IF", "RANDOM"]}
        active="BELIEF" />
      <SelectRow label="MODIFIER MODEL"
        value="anthropic/claude-haiku-4.5"
        options={["HAIKU 4.5", "SONNET 4.5", "GPT-4o-MINI", "GLM 4 9B", "RANDOM"]}
        active="HAIKU 4.5" />
      <SelectRow label="TURNS PER SUBJECT"
        value="5"
        options={["3", "5", "7", "10"]}
        active="5" />
      <SelectRow label="GAME MODE"
        value="PARANOIA · SYMMETRIC"
        options={["PARANOIA", "CONSPIRATOR"]}
        active="PARANOIA" />
    </div>

    <div style={{ position: "absolute", top: 196, right: 10 }}>
      <Stamp rotate={4}>DRAFT</Stamp>
    </div>

    <div style={{ position: "absolute", bottom: 60, left: 0, right: 0, padding: "0 14px" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{
          flex: 1,
          border: `1.5px solid ${dossier.ink}`, padding: "12px 14px",
          background: dossier.ink, color: dossier.paper,
          textAlign: "center", letterSpacing: 2.5, fontWeight: 800, fontSize: 12,
          fontFamily: dossier.font, cursor: "pointer",
        }}>◆ CREATE ROOM</div>
        <div style={{
          border: `1.5px solid ${dossier.ink}`, padding: "12px 14px",
          background: dossier.paper, color: dossier.ink,
          textAlign: "center", letterSpacing: 2, fontWeight: 700, fontSize: 12,
          fontFamily: dossier.font, cursor: "pointer",
        }}>JOIN ↵</div>
      </div>
      <div style={{ textAlign: "center", marginTop: 8, fontSize: 9, color: dossier.faded, letterSpacing: 1.5 }}>
        FILING NEW CASE — KEEP THIS FORM CONFIDENTIAL
      </div>
    </div>
  </DossierFrame>
);

// ---------- 1b. LOBBY (room created, awaiting opponent) ----------

const DossierLobby = () => (
  <DossierFrame page={2}>
    <div style={{ padding: "18px 14px 0" }}>
      <div style={{ fontSize: 9, letterSpacing: 1.5, color: dossier.faded, marginBottom: 4 }}>SECTION I — INTAKE</div>
      <div style={{
        fontFamily: dossier.font, fontWeight: 800, fontSize: 30, lineHeight: 1.05,
        letterSpacing: -0.5, marginBottom: 2,
      }}>
        AWAITING<br/>SECOND<br/>SUBJECT.
      </div>
      <div style={{ fontSize: 10, color: dossier.ink2, marginTop: 10, maxWidth: 280 }}>
        Room established. Share the code below or send the invitation link.
        File opens when the second subject attaches.
      </div>
    </div>

    <div style={{ margin: "22px 14px 0", border: `1.5px solid ${dossier.ink}`, position: "relative" }}>
      <div style={{
        background: dossier.ink, color: dossier.paper, padding: "5px 8px",
        fontSize: 9, letterSpacing: 1.5,
      }}>ROOM CODE / SUBJECT MAY READ ALOUD</div>
      <div style={{
        textAlign: "center", padding: "18px 0 14px",
        fontSize: 56, fontWeight: 800, letterSpacing: 8,
        fontFamily: dossier.font,
      }}>K7N4-Q2</div>
      <div style={{ borderTop: `0.5px dashed ${dossier.ink}`, padding: "6px 10px", fontSize: 9, color: dossier.faded, display: "flex", justifyContent: "space-between" }}>
        <span>EXPIRES IN 09:42</span>
        <span>AUTH · DRAGONFLY</span>
      </div>
    </div>

    <div style={{ padding: "18px 14px 0" }}>
      <div style={{ fontSize: 9, letterSpacing: 1.5, color: dossier.faded, marginBottom: 6 }}>SUBJECT REGISTRY</div>
      <FieldRow label="Subject A" value="REN · ready" />
      <FieldRow label="Subject B" value={<span style={{ color: dossier.faded, fontStyle: "italic" }}>—— pending arrival</span>} />
      <FieldRow label="Total Turns" value="5 PER PARTY" />
      <FieldRow label="Modifier" value="anthropic/claude-haiku-4.5" />
      <FieldRow label="Prompt v." value="modifier · v.07" />
    </div>

    <div style={{ position: "absolute", top: 200, right: 12 }}>
      <Stamp rotate={6}>PROVISIONAL</Stamp>
    </div>

    <div style={{ position: "absolute", bottom: 60, left: 0, right: 0, padding: "0 14px" }}>
      <div style={{
        border: `1.5px solid ${dossier.ink}`, padding: "12px 14px",
        background: dossier.ink, color: dossier.paper,
        textAlign: "center", letterSpacing: 3, fontWeight: 800, fontSize: 13,
        fontFamily: dossier.font, cursor: "pointer",
      }}>
        ◆ COPY LINK · INVITE
      </div>
      <div style={{ textAlign: "center", marginTop: 8, fontSize: 9, color: dossier.faded, letterSpacing: 1.5 }}>
        OR FILE A NEW CASE · ↩ EXIT
      </div>
    </div>
  </DossierFrame>
);

// ---------- 1c. READY (both joined, host starts) ----------

const DossierReady = () => (
  <DossierFrame page={3}>
    <div style={{ padding: "18px 14px 0", position: "relative" }}>
      <div style={{ fontSize: 9, letterSpacing: 1.5, color: dossier.faded, marginBottom: 4 }}>SECTION I — INTAKE</div>
      <div style={{
        fontFamily: dossier.font, fontWeight: 800, fontSize: 30, lineHeight: 1.05,
        letterSpacing: -0.5,
      }}>BOTH PARTIES<br/>ATTACHED.</div>
      <div style={{ fontSize: 10, color: dossier.ink2, marginTop: 10, maxWidth: 290 }}>
        File is ready to open. Once you proceed, the topic is sealed and the
        modifier begins listening. Initiate when ready.
      </div>
      <div style={{ position: "absolute", top: 6, right: 0 }}>
        <Stamp rotate={-8} color={dossier.redInk}>READY</Stamp>
      </div>
    </div>

    <div style={{ margin: "20px 14px 0", border: `1.5px solid ${dossier.ink}` }}>
      <div style={{ background: dossier.ink, color: dossier.paper, padding: "5px 8px", fontSize: 9, letterSpacing: 1.5 }}>
        SUBJECT REGISTRY · 2/2 ATTACHED
      </div>
      <div style={{ padding: "10px 12px", borderBottom: `0.5px dashed ${dossier.ink}`, display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 700 }}>SUBJ A · REN</span>
        <span style={{ fontSize: 10, color: dossier.redInk, fontWeight: 700, letterSpacing: 1 }}>● HOST · READY</span>
      </div>
      <div style={{ padding: "10px 12px", display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 700 }}>SUBJ B · MIRA</span>
        <span style={{ fontSize: 10, color: dossier.redInk, fontWeight: 700, letterSpacing: 1 }}>● ATTACHED · READY</span>
      </div>
    </div>

    <div style={{ margin: "14px 14px 0" }}>
      <div style={{ fontSize: 9, letterSpacing: 1.5, color: dossier.faded, marginBottom: 6 }}>CONDITIONS OF FILING</div>
      <FieldRow label="Topic Pool" value="BELIEF · 14 SEEDED" />
      <FieldRow label="Total Turns" value="5 PER PARTY" />
      <FieldRow label="Modifier" value="anthropic/claude-haiku-4.5" />
      <FieldRow label="Mod Cap" value="≤ 40% OF MESSAGES" />
      <FieldRow label="Mode" value="PARANOIA · SYMMETRIC" />
    </div>

    <div style={{ position: "absolute", bottom: 60, left: 0, right: 0, padding: "0 14px" }}>
      <div style={{
        border: `2px solid ${dossier.ink}`, padding: "14px 14px",
        background: dossier.ink, color: dossier.paper,
        textAlign: "center", letterSpacing: 3, fontWeight: 800, fontSize: 14,
        fontFamily: dossier.font, cursor: "pointer",
      }}>▸ INITIATE CONVERSATION</div>
      <div style={{ textAlign: "center", marginTop: 8, fontSize: 9, color: dossier.faded, letterSpacing: 1.5 }}>
        HOST AUTHORITY — SUBJECT B IS WAITING
      </div>
    </div>
  </DossierFrame>
);

// ---------- 2. ACTIVE — bubble chat ----------

const Bubble = ({ text, mine, tail = true, time, showTime = false }) => {
  const r = 18;
  return (
    <div style={{
      display: "flex", justifyContent: mine ? "flex-end" : "flex-start",
      marginTop: 2, marginBottom: tail ? 4 : 1,
    }}>
      <div style={{ maxWidth: "78%", display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
        <div style={{
          background: mine ? dossier.ink : dossier.paper2,
          color: mine ? dossier.paper : dossier.ink,
          border: mine ? "none" : `1px solid ${dossier.ink}`,
          padding: "8px 12px",
          fontSize: 13.5, lineHeight: 1.38,
          fontFamily: dossier.font, fontWeight: 500,
          borderRadius: r,
          borderBottomRightRadius: mine && tail ? 4 : r,
          borderBottomLeftRadius: !mine && tail ? 4 : r,
        }}>{text}</div>
        {showTime && (
          <div style={{
            fontSize: 8.5, letterSpacing: 1.5, color: dossier.faded,
            fontFamily: dossier.font, marginTop: 4, padding: "0 4px",
          }}>{time}</div>
        )}
      </div>
    </div>
  );
};

const TimeDivider = ({ children }) => (
  <div style={{
    textAlign: "center", margin: "10px 0 8px",
    fontSize: 8.5, letterSpacing: 2, color: dossier.faded,
    fontFamily: dossier.font, fontWeight: 700,
  }}>— {children} —</div>
);

const DossierActive = () => (
  <DossierFrame page={2}>
    {/* topic chip */}
    <div style={{ padding: "10px 14px 10px", borderBottom: `1px solid ${dossier.ink}`, background: dossier.paper2 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, letterSpacing: 1.2, color: dossier.faded, marginBottom: 4 }}>
        <span>SUBJ B · MIRA</span>
        <span>TURN 03/05</span>
      </div>
      <div style={{ fontSize: 11, lineHeight: 1.35, color: dossier.ink, fontWeight: 500 }}>
        <span style={{ color: dossier.faded, fontWeight: 700, letterSpacing: 1, marginRight: 6 }}>TOPIC ↳</span>
        "Something you used to believe that turned out to be wrong."
      </div>
    </div>

    {/* bubble feed */}
    <div style={{ padding: "10px 12px 0", maxHeight: 510, overflow: "hidden" }}>
      <TimeDivider>14:08</TimeDivider>
      <Bubble mine={false}
        text="I was certain my grandfather hated me until I found his notebook after the funeral. Every page mentioned me by name." />
      <Bubble mine
        text="wow. how old were you when you found it?" time="14:09" showTime />
      <Bubble mine={false}
        text="Twelve. He'd been gone three years by then." tail={false} />
      <Bubble mine={false}
        text="My mom kept his study sealed for some reason." time="14:11" />
      <Bubble mine
        text="do you still have the notebook?" time="14:12" showTime />
      <Bubble mine={false}
        text="Complicated. He wrote about me like I was a stranger he was trying to understand." time="14:14" />

      {/* typing */}
      <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 4 }}>
        <div style={{
          background: dossier.paper2, border: `1px solid ${dossier.ink}`,
          padding: "8px 14px", borderRadius: 18, borderBottomLeftRadius: 4,
          display: "flex", gap: 4, alignItems: "center",
        }}>
          <span className="dot d1" style={{ width: 5, height: 5, borderRadius: "50%", background: dossier.ink2 }}/>
          <span className="dot d2" style={{ width: 5, height: 5, borderRadius: "50%", background: dossier.ink2 }}/>
          <span className="dot d3" style={{ width: 5, height: 5, borderRadius: "50%", background: dossier.ink2 }}/>
        </div>
      </div>
    </div>

    {/* compose footer */}
    <div style={{
      position: "absolute", bottom: 22, left: 0, right: 0,
      borderTop: `1.5px solid ${dossier.ink}`,
      background: dossier.paper2,
    }}>
      <div style={{
        padding: "4px 14px",
        display: "flex", justifyContent: "space-between",
        fontSize: 8.5, letterSpacing: 1.5, color: dossier.redInk,
        fontWeight: 700, borderBottom: `0.5px dashed ${dossier.ink}`,
      }}>
        <span>● INTERLOCUTOR LISTENING</span>
        <span style={{ color: dossier.faded }}>62 / 280</span>
      </div>
      <div style={{
        display: "flex", alignItems: "flex-end", gap: 8,
        padding: "10px 12px",
      }}>
        <div style={{
          flex: 1,
          background: dossier.paper, border: `1px solid ${dossier.ink}`,
          padding: "9px 12px", minHeight: 18, borderRadius: 18,
          fontSize: 13, color: dossier.ink2, fontFamily: dossier.font, fontWeight: 500,
        }}>
          that's brutal. so the version of him you grew up afraid of wasn't real<span style={{ color: dossier.ink }} className="dossierCaret">▌</span>
        </div>
        <button style={{
          width: 38, height: 38, borderRadius: "50%",
          background: dossier.ink, color: dossier.paper, border: "none",
          fontFamily: dossier.font, fontSize: 16, fontWeight: 700, cursor: "pointer",
        }}>↑</button>
      </div>
    </div>

    <style>{`
      @keyframes dossierBlink{50%{opacity:0}}
      .dossierCaret{animation:dossierBlink 1s step-end infinite}
      @keyframes dossierDot{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-2px)}}
      .dot{animation:dossierDot 1.2s ease-in-out infinite}
      .d2{animation-delay:.15s}
      .d3{animation-delay:.30s}
    `}</style>
  </DossierFrame>
);

// ---------- 3. VOTING ----------

const VoteCard = ({ idx, speaker, text, flagged, isFinal = false }) => (
  <div style={{
    border: `1px solid ${dossier.ink}`,
    background: flagged ? "rgba(163,33,24,0.06)" : dossier.paper,
    padding: "9px 11px", marginBottom: 8,
    position: "relative",
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: dossier.faded, letterSpacing: 1, marginBottom: 5 }}>
      <span>EXHIBIT {String(idx).padStart(2,"0")} · {speaker}</span>
      <span>TURN {Math.ceil(idx/2)}</span>
    </div>
    <div style={{ fontSize: 11.5, lineHeight: 1.42, color: dossier.ink, marginBottom: 8 }}>{text}</div>
    <div style={{ display: "flex", gap: 6, fontSize: 9, letterSpacing: 1.2 }}>
      <button style={{
        flex: 1, padding: "6px 0", border: `1px solid ${dossier.ink}`,
        background: flagged ? "transparent" : dossier.paper2,
        fontFamily: dossier.font, fontWeight: 700, letterSpacing: 1.2,
        color: dossier.ink, cursor: "pointer",
      }}>☐ AS-WRITTEN</button>
      <button style={{
        flex: 1, padding: "6px 0", border: `1.5px solid ${dossier.redInk}`,
        background: flagged ? dossier.redInk : "transparent",
        color: flagged ? dossier.paper : dossier.redInk,
        fontFamily: dossier.font, fontWeight: 700, letterSpacing: 1.2, cursor: "pointer",
      }}>{flagged ? "▣ COMPROMISED" : "☐ COMPROMISED"}</button>
    </div>
    {flagged && (
      <div style={{ position: "absolute", top: -8, right: 8 }}>
        <Stamp rotate={-12} style={{ fontSize: 8, padding: "3px 6px" }}>FLAGGED</Stamp>
      </div>
    )}
  </div>
);

const DossierVoting = () => (
  <DossierFrame page={3}>
    <div style={{ padding: "12px 14px 6px", borderBottom: `1px solid ${dossier.ink}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, letterSpacing: 1.2, color: dossier.faded, marginBottom: 4 }}>
        <span>SECTION III — REVIEW</span>
        <span style={{ color: dossier.redInk, fontWeight: 700 }}>2/5 FLAGGED</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.1 }}>
        Mark each statement<br/>by SUBJECT B that you<br/>suspect was altered.
      </div>
    </div>

    <div style={{ padding: "10px 14px 80px", overflow: "auto", maxHeight: 620 }}>
      <VoteCard idx={1} speaker="SUBJ B" flagged={false}
        text="I was certain my grandfather hated me until I found his notebook after the funeral." />
      <VoteCard idx={3} speaker="SUBJ B" flagged={false}
        text="Twelve. He'd been gone three years by then. My mom kept his study sealed for some reason." />
      <VoteCard idx={5} speaker="SUBJ B" flagged={true}
        text="Complicated, mostly. He wrote about me like I was a stranger he was trying to understand." />
      <VoteCard idx={7} speaker="SUBJ B" flagged={true}
        text="He was real. He just couldn't reach me. I think he was scared of how much he loved me." />
    </div>

    <div style={{
      position: "absolute", bottom: 22, left: 0, right: 0,
      borderTop: `1.5px solid ${dossier.ink}`,
      background: dossier.paper2, padding: "10px 14px",
      display: "flex", gap: 8, alignItems: "center",
    }}>
      <div style={{ flex: 1, fontSize: 9, color: dossier.faded, letterSpacing: 1 }}>
        OPPOSING SUBJECT: <span style={{ color: dossier.redInk, fontWeight: 700 }}>FILING…</span>
      </div>
      <div style={{
        border: `2px solid ${dossier.ink}`, background: dossier.ink, color: dossier.paper,
        padding: "8px 14px", fontSize: 11, letterSpacing: 2, fontWeight: 800,
      }}>SUBMIT FILING ▸</div>
    </div>
  </DossierFrame>
);

// ---------- 4. RESULTS ----------

const Diff = ({ original, delivered }) => (
  <div style={{ marginTop: 4, fontSize: 10.5, lineHeight: 1.45 }}>
    <div style={{ display: "flex", gap: 6, marginBottom: 3 }}>
      <span style={{ width: 38, fontSize: 8, color: dossier.faded, letterSpacing: 1, paddingTop: 2 }}>SENT</span>
      <span style={{ flex: 1, color: dossier.ink2, textDecoration: "line-through", textDecorationColor: dossier.redInk }}>{original}</span>
    </div>
    <div style={{ display: "flex", gap: 6 }}>
      <span style={{ width: 38, fontSize: 8, color: dossier.redInk, letterSpacing: 1, paddingTop: 2, fontWeight: 700 }}>DELIV</span>
      <span style={{
        flex: 1, color: dossier.ink, fontWeight: 600,
        background: "rgba(163,33,24,0.10)", padding: "2px 4px", margin: "-2px -4px",
      }}>{delivered}</span>
    </div>
  </div>
);

const ResultRow = ({ idx, speaker, original, delivered, modified, suspected, correct }) => (
  <div style={{
    borderBottom: `0.5px dashed ${dossier.ink}`,
    padding: "9px 0",
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: dossier.faded, letterSpacing: 1, marginBottom: 4 }}>
      <span>EX {String(idx).padStart(2,"0")} · {speaker}</span>
      <span>
        {modified
          ? <span style={{ color: dossier.redInk, fontWeight: 700 }}>● ALTERED</span>
          : <span>○ AS-WRITTEN</span>}
        {" · "}
        {correct ? <span style={{ fontWeight: 700 }}>✓ YOU CALLED IT</span> : <span style={{ color: dossier.faded }}>✗ MISSED</span>}
      </span>
    </div>
    {modified
      ? <Diff original={original} delivered={delivered} />
      : <div style={{ fontSize: 11, lineHeight: 1.45, color: dossier.ink2 }}>{delivered}</div>}
  </div>
);

const DossierResults = () => (
  <DossierFrame page={4}>
    <div style={{ padding: "14px 14px 8px", borderBottom: `1.5px solid ${dossier.ink}`, position: "relative" }}>
      <div style={{ fontSize: 9, letterSpacing: 1.2, color: dossier.faded, marginBottom: 4 }}>SECTION IV — DISPOSITION</div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, lineHeight: 1 }}>1 of 3</div>
          <div style={{ fontSize: 10, color: dossier.faded, marginTop: 4, letterSpacing: 0.5 }}>alterations identified by you</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, lineHeight: 1, color: dossier.redInk }}>0.74</div>
          <div style={{ fontSize: 10, color: dossier.faded, marginTop: 4, letterSpacing: 0.5 }}>composite reward</div>
        </div>
      </div>
      <div style={{ position: "absolute", top: -2, right: 92, transform: "rotate(2deg)" }}>
        <Stamp rotate={-8} color={dossier.redInk}>CASE CLOSED</Stamp>
      </div>
    </div>

    <div style={{ padding: "8px 14px", maxHeight: 500, overflow: "hidden" }}>
      <ResultRow idx={4} speaker="SUBJ A → B" modified suspected={false} correct={false}
        original="do you still have the notebook?"
        delivered="Did reading it change how you remember him, or just complicate it?" />
      <ResultRow idx={7} speaker="SUBJ B → A" modified suspected correct
        original="He was real. Just not for me. I think he was scared of how much he loved me and didn't know what to do with it."
        delivered="He was real. He just couldn't reach me. I think he was scared of how much he loved me and didn't know what to do." />
      <ResultRow idx={10} speaker="SUBJ A → B" modified suspected={false} correct={false}
        original="she wanted you to find it."
        delivered="she wanted you to find it on your own time." />
      <ResultRow idx={5} speaker="SUBJ B → A" modified={false} correct
        original="" delivered="Complicated, mostly. He wrote about me like I was a stranger…" />
    </div>

    <div style={{
      position: "absolute", bottom: 22, left: 0, right: 0,
      borderTop: `1.5px solid ${dossier.ink}`, padding: "10px 14px",
      background: dossier.paper2,
      display: "flex", gap: 8, alignItems: "center",
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 9, color: dossier.faded, letterSpacing: 1.2 }}>POST-FILE SURVEY</div>
        <div style={{ display: "flex", gap: 5, marginTop: 4, fontSize: 14, letterSpacing: 2 }}>
          <span style={{ color: dossier.ink }}>★</span>
          <span style={{ color: dossier.ink }}>★</span>
          <span style={{ color: dossier.ink }}>★</span>
          <span style={{ color: dossier.ink }}>★</span>
          <span style={{ color: dossier.faded }}>☆</span>
        </div>
      </div>
      <div style={{
        border: `2px solid ${dossier.ink}`, background: dossier.ink, color: dossier.paper,
        padding: "8px 12px", fontSize: 10.5, letterSpacing: 2, fontWeight: 800,
      }}>OPEN NEW FILE ▸</div>
    </div>
  </DossierFrame>
);

Object.assign(window, { DossierSetup, DossierLobby, DossierReady, DossierActive, DossierVoting, DossierResults });
