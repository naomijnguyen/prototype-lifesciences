import { useState, useRef } from "react";

const ROWS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const COLS = Array.from({ length: 12 }, (_, i) => i + 1);

const GROUP_PALETTE = [
  { bg: "#1b4332", text: "#d8f3dc" },
  { bg: "#0f4c75", text: "#e8f4f8" },
  { bg: "#3c1361", text: "#e8d5f5" },
  { bg: "#6b0f1a", text: "#fce4e4" },
  { bg: "#8b6914", text: "#fff8e1" },
  { bg: "#2e4057", text: "#c8dbe8" },
  { bg: "#74546a", text: "#f5e6f0" },
  { bg: "#4a6fa5", text: "#e0ecf8" },
  { bg: "#6b4226", text: "#fde8d0" },
  { bg: "#2d6a4f", text: "#d8f3dc" },
  { bg: "#b07d62", text: "#fff8e1" },
  { bg: "#40916c", text: "#1b4332" },
];

const SPECIAL_PALETTE = {
  STD: { bg: "#1a1a2e", text: "#a0a0ff" },
  BLK: { bg: "#0c0c14", text: "#4a4a6a" },
  BLANK: { bg: "#0c0c14", text: "#4a4a6a" },
  POS: { bg: "#1a3a1a", text: "#6bff6b" },
  NEG: { bg: "#3a1a1a", text: "#ff6b6b" },
};

const mono = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";
const sans = "'Inter', 'Segoe UI', system-ui, sans-serif";

function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
function stdev(a) { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)) : 0; }
function semCalc(a) { return stdev(a) / Math.sqrt(a.length || 1); }

const inputStyle = {
  padding: "8px 10px", background: "#0c0c14", border: "1px solid #1e1e30",
  borderRadius: 4, color: "#c8cad0", fontSize: 13, fontFamily: mono, boxSizing: "border-box", width: "100%",
};

const sectionStyle = {
  background: "#12121e", border: "1px solid #1e1e30", borderRadius: 8, padding: 20, marginBottom: 20,
};

const headerStyle = {
  fontSize: 14, fontWeight: 600, color: "#9090b0", margin: "0 0 12px",
  textTransform: "uppercase", letterSpacing: "0.05em",
};

function parseSampleList(str) {
  if (!str) return [];
  const parts = str.split(/[,;\s]+/).filter(Boolean);
  const result = [];
  for (const p of parts) {
    const rangeMatch = p.match(/^(\D*)(\d+)\s*-\s*(\D*)(\d+)$/);
    if (rangeMatch) {
      const prefix = rangeMatch[1] || rangeMatch[3] || "";
      const start = parseInt(rangeMatch[2]);
      const end = parseInt(rangeMatch[4]);
      for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
        result.push(prefix + i);
      }
    } else {
      result.push(p);
    }
  }
  return result;
}

export default function PlateAnalyzer() {
  const [step, setStep] = useState("map");
  const [plateIds, setPlateIds] = useState(ROWS.map(() => COLS.map(() => "")));
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupSamples, setNewGroupSamples] = useState("");
  const [assay, setAssay] = useState({
    name: "", readout: "", units: "U/g",
    signalWL: "450", refWL: "430", subtractRef: true,
    date: new Date().toISOString().split("T")[0], notes: "",
  });
  const [rawSignal, setRawSignal] = useState("");
  const [rawRef, setRawRef] = useState("");
  const [parsedSignal, setParsedSignal] = useState(null);
  const [parsedRef, setParsedRef] = useState(null);
  const [results, setResults] = useState(null);
  const [bulkPaste, setBulkPaste] = useState("");
  const fileInputRef = useRef(null);

  const sampleGroupMap = {};
  groups.forEach((g, gi) => {
    parseSampleList(g.sampleIds).forEach(sid => {
      sampleGroupMap[sid.toUpperCase()] = { groupIdx: gi, name: g.name };
    });
  });

  function getWellColor(sampleId) {
    if (!sampleId) return null;
    const upper = sampleId.toUpperCase();
    for (const [key, pal] of Object.entries(SPECIAL_PALETTE)) {
      if (upper === key || upper.startsWith(key)) return pal;
    }
    const gInfo = sampleGroupMap[upper];
    if (gInfo) return GROUP_PALETTE[gInfo.groupIdx % GROUP_PALETTE.length];
    return { bg: "#1a1a22", text: "#888" };
  }

  function handleCellChange(r, c, val) {
    const p = plateIds.map(row => [...row]);
    p[r][c] = val;
    setPlateIds(p);
  }

  function handleBulkPaste() {
    if (!bulkPaste.trim()) return;
    const lines = bulkPaste.trim().split("\n");
    const p = plateIds.map(row => [...row]);
    for (let r = 0; r < Math.min(lines.length, 8); r++) {
      const cells = lines[r].split(/\t/);
      let offset = 0;
      if (cells[0]?.trim().match(/^[A-H]$/i)) offset = 1;
      for (let c = 0; c < Math.min(cells.length - offset, 12); c++) {
        p[r][c] = cells[c + offset]?.trim() || "";
      }
    }
    setPlateIds(p);
    setBulkPaste("");
  }

  function handlePlateMapUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = ev.target.result.trim().split("\n");
      const p = ROWS.map(() => COLS.map(() => ""));
      for (let r = 0; r < Math.min(lines.length, 8); r++) {
        const cells = lines[r].split(/[\t,]+/);
        let offset = 0;
        if (cells[0]?.trim().match(/^[A-H]$/i)) offset = 1;
        for (let c = 0; c < Math.min(cells.length - offset, 12); c++) {
          p[r][c] = cells[c + offset]?.trim() || "";
        }
      }
      setPlateIds(p);
    };
    reader.readAsText(file);
  }

  function addGroup() {
    if (!newGroupName.trim()) return;
    setGroups([...groups, { name: newGroupName.trim(), sampleIds: newGroupSamples.trim() }]);
    setNewGroupName("");
    setNewGroupSamples("");
  }

  function parseDataBlock(text) {
    if (!text.trim()) return null;
    const lines = text.trim().split("\n");
    const matrix = [];
    for (const line of lines) {
      const parts = line.split(/[\t,]+/).map(v => v.trim());
      let nums = parts.map(Number);
      if (isNaN(nums[0]) && !isNaN(nums[1])) nums = nums.slice(1);
      if (nums.length > 12) {
        const last = nums[nums.length - 1];
        if (last > 300 && last < 800) nums = nums.slice(0, -1);
      }
      const valid = nums.filter(n => !isNaN(n));
      if (valid.length >= 10) matrix.push(valid.slice(0, 12));
    }
    return matrix.length >= 8 ? matrix.slice(0, 8) : null;
  }

  function analyze() {
    if (!parsedSignal) return;
    let dm = parsedSignal.map(r => [...r]);
    if (parsedRef && assay.subtractRef) {
      dm = parsedSignal.map((row, r) => row.map((v, c) => v - (parsedRef[r]?.[c] ?? 0)));
    }
    const groupResults = {};
    const ungrouped = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 12; c++) {
        const sid = plateIds[r][c];
        const val = dm[r]?.[c];
        if (val === undefined) continue;
        const well = `${ROWS[r]}${COLS[c]}`;
        if (!sid) continue;
        const gInfo = sampleGroupMap[sid.toUpperCase()];
        if (gInfo) {
          const gi = gInfo.groupIdx;
          if (!groupResults[gi]) groupResults[gi] = { name: groups[gi].name, values: [], wells: [], sampleIds: [] };
          groupResults[gi].values.push(val);
          groupResults[gi].wells.push(well);
          groupResults[gi].sampleIds.push(sid);
        } else {
          ungrouped.push({ well, sampleId: sid, value: val });
        }
      }
    }
    const stats = {};
    for (const [idx, data] of Object.entries(groupResults)) {
      const v = data.values;
      stats[idx] = {
        ...data, n: v.length, mean: mean(v), std: stdev(v), sem: semCalc(v),
        min: Math.min(...v), max: Math.max(...v),
        cv: Math.abs(mean(v)) > 0 ? (stdev(v) / Math.abs(mean(v))) * 100 : 0,
      };
    }
    setResults({ stats, dataMatrix: dm, ungrouped });
    setStep("results");
  }

  const maxBarVal = results?.stats
    ? Math.max(...Object.values(results.stats).map(s => Math.abs(s.mean) + s.sem), 0.001) : 1;

  const tabBtn = (key, label) => (
    <button key={key} onClick={() => setStep(key)} style={{
      padding: "8px 20px", fontSize: 13,
      fontWeight: step === key ? 600 : 400,
      background: step === key ? "#1a1a2e" : "transparent",
      color: step === key ? "#a0a0ff" : "#6b6d78",
      border: step === key ? "1px solid #2a2a4e" : "1px solid transparent",
      borderRadius: 6, cursor: "pointer",
    }}>{label}</button>
  );

  return (
    <div style={{ fontFamily: sans, background: "#0c0c14", color: "#c8cad0", minHeight: "100vh", padding: "24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#e8e8f0", margin: 0, letterSpacing: "-0.02em" }}>Plate Analyzer</h1>
          <p style={{ fontSize: 13, color: "#6b6d78", margin: "4px 0 16px" }}>Sample IDs -- Groups -- Data -- Results</p>
          <div style={{ display: "flex", gap: 2 }}>
            {tabBtn("map", "1. Plate Map")}
            {tabBtn("groups", "2. Groups")}
            {tabBtn("data", "3. Data")}
            {tabBtn("results", "4. Results")}
          </div>
        </div>

        {/* STEP 1: PLATE MAP */}
        {step === "map" && (
          <div>
            <div style={sectionStyle}>
              <h3 style={headerStyle}>Assay Details</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {[
                  { key: "name", label: "Assay Name", ph: "e.g. Microvessel Activity" },
                  { key: "readout", label: "Readout", ph: "Absorbance, Luminescence..." },
                  { key: "units", label: "Units", ph: "U/g, pg/mL, OD" },
                  { key: "signalWL", label: "Signal Wavelength (nm)" },
                  { key: "refWL", label: "Ref Wavelength (nm)" },
                ].map(f => (
                  <label key={f.key} style={{ fontSize: 12, color: "#6b6d78" }}>
                    {f.label}
                    <input value={assay[f.key]} onChange={e => setAssay({...assay, [f.key]: e.target.value})}
                      placeholder={f.ph || ""} style={{...inputStyle, display: "block", marginTop: 4}} />
                  </label>
                ))}
                <label style={{ fontSize: 12, color: "#6b6d78", display: "flex", alignItems: "flex-end", gap: 8, paddingBottom: 8 }}>
                  <input type="checkbox" checked={assay.subtractRef} onChange={e => setAssay({...assay, subtractRef: e.target.checked})} />
                  Subtract reference
                </label>
              </div>
            </div>

            <div style={sectionStyle}>
              <h3 style={headerStyle}>Paste or Upload Sample IDs</h3>
              <p style={{ fontSize: 12, color: "#6b6d78", margin: "0 0 10px" }}>
                Paste an 8x12 grid from Excel (tab-separated), or upload a CSV/TSV. Use STD for standards, BLK for blanks, POS/NEG for controls.
              </p>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <textarea value={bulkPaste} onChange={e => setBulkPaste(e.target.value)}
                  placeholder={"Paste from Excel (8 rows x 12 cols):\nS1\tS2\tS3\t...\tSTD1\tSTD1"}
                  style={{...inputStyle, height: 120, resize: "vertical", flex: 2, fontSize: 11}} />
                <div style={{ flex: 0, minWidth: 130, display: "flex", flexDirection: "column", gap: 8 }}>
                  <button onClick={handleBulkPaste} style={{ padding: "10px 16px", fontSize: 12, fontWeight: 600, background: "#1a1a2e", color: "#a0a0ff", border: "1px solid #2a2a4e", borderRadius: 4, cursor: "pointer" }}>Apply Paste</button>
                  <input type="file" ref={fileInputRef} accept=".csv,.tsv,.txt" onChange={handlePlateMapUpload} style={{ display: "none" }} />
                  <button onClick={() => fileInputRef.current?.click()} style={{ padding: "10px 16px", fontSize: 12, background: "#12121e", color: "#6b6d78", border: "1px solid #1e1e30", borderRadius: 4, cursor: "pointer" }}>Upload File</button>
                  <button onClick={() => setPlateIds(ROWS.map(() => COLS.map(() => "")))} style={{ padding: "10px 16px", fontSize: 12, background: "#12121e", color: "#ff6b6b", border: "1px solid #2a1a1a", borderRadius: 4, cursor: "pointer" }}>Clear</button>
                </div>
              </div>
            </div>

            <div style={sectionStyle}>
              <h3 style={headerStyle}>Plate Map (editable cells)</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "separate", borderSpacing: 3 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 24 }}></th>
                      {COLS.map(c => <th key={c} style={{ fontSize: 11, color: "#4a4a6a", width: 72, textAlign: "center" }}>{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map((row, r) => (
                      <tr key={row}>
                        <td style={{ fontSize: 12, fontWeight: 600, color: "#4a4a6a", textAlign: "center" }}>{row}</td>
                        {COLS.map((col, c) => {
                          const sid = plateIds[r][c];
                          const color = getWellColor(sid);
                          return (
                            <td key={col} style={{ padding: 0 }}>
                              <input value={sid} onChange={e => handleCellChange(r, c, e.target.value)}
                                style={{
                                  width: 72, height: 38, textAlign: "center", fontSize: 10, fontFamily: mono,
                                  background: color?.bg || "#16161f", color: color?.text || "#3a3a4a",
                                  border: sid ? "1px solid #2a2a3a" : "1px solid #1a1a28",
                                  borderRadius: 4, outline: "none", boxSizing: "border-box", padding: "2px 4px",
                                }}
                                placeholder={`${row}${col}`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button onClick={() => setStep("groups")} style={{
              padding: "12px 32px", fontSize: 14, fontWeight: 600,
              background: "#1a1a2e", color: "#a0a0ff", border: "1px solid #2a2a4e", borderRadius: 6, cursor: "pointer",
            }}>Next: Define Groups</button>
          </div>
        )}

        {/* STEP 2: GROUPS */}
        {step === "groups" && (
          <div>
            <div style={sectionStyle}>
              <h3 style={headerStyle}>Define Experimental Groups</h3>
              <p style={{ fontSize: 12, color: "#6b6d78", margin: "0 0 16px" }}>
                Assign sample IDs to groups. Use ranges (1-10) or lists (S1, S2, S3). IDs must match the plate map.
              </p>
              {groups.map((g, i) => {
                const pc = GROUP_PALETTE[i % GROUP_PALETTE.length];
                const matched = parseSampleList(g.sampleIds);
                const wells = [];
                matched.forEach(sid => {
                  for (let r = 0; r < 8; r++) for (let c = 0; c < 12; c++)
                    if (plateIds[r][c].toUpperCase() === sid.toUpperCase()) wells.push(`${ROWS[r]}${COLS[c]}`);
                });
                return (
                  <div key={i} style={{
                    display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10,
                    padding: 12, background: pc.bg + "33", border: `1px solid ${pc.bg}`, borderRadius: 6,
                  }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, background: pc.bg, flexShrink: 0, marginTop: 6 }} />
                    <div style={{ flex: 1 }}>
                      <input value={g.name} onChange={e => setGroups(groups.map((gg, j) => j === i ? {...gg, name: e.target.value} : gg))}
                        style={{...inputStyle, fontWeight: 600, marginBottom: 6, background: "transparent", border: "none", padding: "4px 0", color: pc.text}} />
                      <input value={g.sampleIds} onChange={e => setGroups(groups.map((gg, j) => j === i ? {...gg, sampleIds: e.target.value} : gg))}
                        placeholder="Sample IDs: 1-10, S1, S2..."
                        style={{...inputStyle, fontSize: 11, background: "transparent", border: "1px solid #2a2a3a"}} />
                      <div style={{ fontSize: 10, color: "#6b6d78", marginTop: 4 }}>
                        {matched.length} samples{wells.length > 0 && ` | Wells: ${wells.join(", ")}`}
                      </div>
                    </div>
                    <button onClick={() => setGroups(groups.filter((_, j) => j !== i))}
                      style={{ background: "none", border: "none", color: "#ff6b6b", cursor: "pointer", fontSize: 16, padding: 4 }}>x</button>
                  </div>
                );
              })}

              <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginTop: 16, padding: 16, border: "1px dashed #2a2a3a", borderRadius: 6 }}>
                <label style={{ flex: 1, fontSize: 12, color: "#6b6d78" }}>
                  Group Name
                  <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                    placeholder="Vehicle, Treatment 10mg/kg..." style={{...inputStyle, display: "block", marginTop: 4}}
                    onKeyDown={e => e.key === "Enter" && addGroup()} />
                </label>
                <label style={{ flex: 1, fontSize: 12, color: "#6b6d78" }}>
                  Sample IDs
                  <input value={newGroupSamples} onChange={e => setNewGroupSamples(e.target.value)}
                    placeholder="1-10, or S1, S2, S3" style={{...inputStyle, display: "block", marginTop: 4}}
                    onKeyDown={e => e.key === "Enter" && addGroup()} />
                </label>
                <button onClick={addGroup} style={{
                  padding: "8px 20px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
                  background: newGroupName ? "#1b4332" : "#16161f", color: newGroupName ? "#d8f3dc" : "#3a3a4a",
                  border: "1px solid #2a4a3a", borderRadius: 4, cursor: newGroupName ? "pointer" : "default",
                }}>+ Add Group</button>
              </div>
            </div>

            {/* Preview */}
            <div style={sectionStyle}>
              <h3 style={headerStyle}>Preview</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "separate", borderSpacing: 2 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 24 }}></th>
                      {COLS.map(c => <th key={c} style={{ fontSize: 10, color: "#4a4a6a", width: 68, textAlign: "center" }}>{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map((row, r) => (
                      <tr key={row}>
                        <td style={{ fontSize: 11, fontWeight: 600, color: "#4a4a6a", textAlign: "center" }}>{row}</td>
                        {COLS.map((col, c) => {
                          const sid = plateIds[r][c];
                          const color = getWellColor(sid);
                          const gInfo = sid ? sampleGroupMap[sid.toUpperCase()] : null;
                          return (
                            <td key={col} style={{
                              width: 68, height: 42, background: color?.bg || "#16161f",
                              borderRadius: 4, textAlign: "center", verticalAlign: "middle", border: "1px solid #1a1a28",
                            }}>
                              <div style={{ fontSize: 10, fontFamily: mono, color: color?.text || "#3a3a4a" }}>{sid}</div>
                              {gInfo && <div style={{ fontSize: 7, color: color?.text || "#3a3a4a", opacity: 0.6, marginTop: 1 }}>{gInfo.name?.substring(0, 12)}</div>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setStep("map")} style={{ padding: "10px 20px", fontSize: 13, background: "transparent", color: "#6b6d78", border: "1px solid transparent", borderRadius: 6, cursor: "pointer" }}>Back</button>
              <button onClick={() => setStep("data")} style={{
                padding: "12px 32px", fontSize: 14, fontWeight: 600,
                background: "#1a1a2e", color: "#a0a0ff", border: "1px solid #2a2a4e", borderRadius: 6, cursor: "pointer",
              }}>Next: Paste Data</button>
            </div>
          </div>
        )}

        {/* STEP 3: DATA */}
        {step === "data" && (
          <div>
            <div style={sectionStyle}>
              <h3 style={headerStyle}>Signal Data ({assay.signalWL}nm)</h3>
              <p style={{ fontSize: 12, color: "#6b6d78", margin: "0 0 8px" }}>
                Paste 8x12 numeric data. Row letters, column numbers, and wavelength columns will be auto-stripped.
              </p>
              <textarea value={rawSignal} onChange={e => setRawSignal(e.target.value)}
                placeholder="Paste signal data (8 rows x 12 cols)..."
                style={{...inputStyle, height: 180, resize: "vertical", fontSize: 11}} />
            </div>

            {assay.subtractRef && (
              <div style={sectionStyle}>
                <h3 style={headerStyle}>Reference Data ({assay.refWL}nm)</h3>
                <textarea value={rawRef} onChange={e => setRawRef(e.target.value)}
                  placeholder="Paste reference data (leave empty for single wavelength)..."
                  style={{...inputStyle, height: 180, resize: "vertical", fontSize: 11}} />
              </div>
            )}

            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
              <button onClick={() => { setParsedSignal(parseDataBlock(rawSignal)); setParsedRef(parseDataBlock(rawRef)); }}
                style={{ padding: "10px 24px", fontSize: 13, fontWeight: 600, background: "#1a1a2e", color: "#a0a0ff", border: "1px solid #2a2a4e", borderRadius: 6, cursor: "pointer" }}>
                Parse
              </button>
              {parsedSignal && <span style={{ fontSize: 12, color: "#52b788" }}>
                Signal: {parsedSignal.length}x{parsedSignal[0]?.length}{parsedRef ? ` | Ref: ${parsedRef.length}x${parsedRef[0]?.length}` : ""}
              </span>}
            </div>

            {parsedSignal && (
              <div style={sectionStyle}>
                <h3 style={headerStyle}>Preview (colored by group)</h3>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "separate", borderSpacing: 2, fontFamily: mono, fontSize: 11 }}>
                    <thead><tr><th style={{ padding: "4px 6px", color: "#4a4a6a" }}></th>
                      {COLS.map(c => <th key={c} style={{ padding: "4px 6px", color: "#4a4a6a" }}>{c}</th>)}</tr></thead>
                    <tbody>
                      {parsedSignal.map((row, r) => (
                        <tr key={r}>
                          <td style={{ padding: "4px 6px", color: "#4a4a6a", fontWeight: 600 }}>{ROWS[r]}</td>
                          {row.map((val, c) => {
                            const color = getWellColor(plateIds[r]?.[c]);
                            return <td key={c} style={{ padding: "6px 8px", textAlign: "right", background: color?.bg || "transparent", color: color?.text || "#c8cad0", borderRadius: 3 }}>
                              {val.toFixed(3)}
                            </td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {parsedSignal && (
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setStep("groups")} style={{ padding: "10px 20px", fontSize: 13, background: "transparent", color: "#6b6d78", border: "1px solid transparent", borderRadius: 6, cursor: "pointer" }}>Back</button>
                <button onClick={analyze} style={{
                  padding: "12px 32px", fontSize: 14, fontWeight: 600,
                  background: "#1b4332", color: "#d8f3dc", border: "1px solid #2d6a4f", borderRadius: 6, cursor: "pointer",
                }}>Analyze</button>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: RESULTS */}
        {step === "results" && results && (
          <div>
            <div style={sectionStyle}>
              <h3 style={headerStyle}>Group Statistics{assay.units ? ` (${assay.units})` : ""}{assay.name ? ` -- ${assay.name}` : ""}</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, fontFamily: mono }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #2a2a3a", color: "#6b6d78", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {["Group", "n", "Mean", "SD", "SEM", "CV%", "Min", "Max"].map(h =>
                        <th key={h} style={{ padding: "8px 10px", textAlign: h === "Group" ? "left" : "right" }}>{h}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(results.stats).map(([idx, s]) => {
                      const pc = GROUP_PALETTE[idx % GROUP_PALETTE.length];
                      return (
                        <tr key={idx} style={{ borderBottom: "1px solid #1a1a28" }}>
                          <td style={{ padding: "10px" }}>
                            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: pc.bg, marginRight: 8, verticalAlign: "middle" }} />
                            <span style={{ color: pc.text, fontWeight: 600, fontFamily: sans }}>{s.name}</span>
                          </td>
                          <td style={{ padding: "10px", textAlign: "right", color: "#6b6d78" }}>{s.n}</td>
                          <td style={{ padding: "10px", textAlign: "right", color: "#e8e8f0", fontWeight: 700 }}>{s.mean.toFixed(4)}</td>
                          <td style={{ padding: "10px", textAlign: "right" }}>{s.std.toFixed(4)}</td>
                          <td style={{ padding: "10px", textAlign: "right" }}>{s.sem.toFixed(4)}</td>
                          <td style={{ padding: "10px", textAlign: "right", color: s.cv > 20 ? "#ff6b6b" : s.cv > 10 ? "#ffd93d" : "#52b788" }}>{s.cv.toFixed(1)}%</td>
                          <td style={{ padding: "10px", textAlign: "right", color: "#6b6d78" }}>{s.min.toFixed(4)}</td>
                          <td style={{ padding: "10px", textAlign: "right", color: "#6b6d78" }}>{s.max.toFixed(4)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bar chart with scatter */}
            <div style={sectionStyle}>
              <h3 style={headerStyle}>Group Comparison (Mean +/- SEM)</h3>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: 280, padding: "0 20px 50px 50px", position: "relative" }}>
                <div style={{ position: "absolute", left: 0, bottom: 50, top: 0, width: 44, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  {[1, 0.75, 0.5, 0.25, 0].map(f => (
                    <span key={f} style={{ fontSize: 9, color: "#4a4a6a", fontFamily: mono, textAlign: "right", width: 44 }}>
                      {(maxBarVal * f).toFixed(3)}
                    </span>
                  ))}
                </div>
                {[0, 0.25, 0.5, 0.75, 1].map(f => (
                  <div key={f} style={{ position: "absolute", left: 50, right: 20, bottom: 50 + f * 210, borderTop: "1px solid #1a1a28" }} />
                ))}
                {Object.entries(results.stats).map(([idx, s]) => {
                  const pc = GROUP_PALETTE[idx % GROUP_PALETTE.length];
                  const barH = (s.mean / maxBarVal) * 210;
                  const semH = (s.sem / maxBarVal) * 210;
                  return (
                    <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative", height: 210 }}>
                      <div style={{ width: "55%", maxWidth: 44, height: Math.max(2, Math.abs(barH)), background: pc.bg, border: `1px solid ${pc.text}44`, borderRadius: "3px 3px 0 0", position: "absolute", bottom: 0 }} />
                      <div style={{ position: "absolute", bottom: barH, width: 2, height: semH, background: "#8888aa" }} />
                      <div style={{ position: "absolute", bottom: barH + semH, width: 14, height: 2, background: "#8888aa" }} />
                      {s.values.map((v, vi) => (
                        <div key={vi} title={`${s.sampleIds[vi]}: ${v.toFixed(4)}`} style={{
                          position: "absolute", bottom: (v / maxBarVal) * 210 - 3,
                          width: 6, height: 6, borderRadius: "50%",
                          background: pc.text, opacity: 0.6,
                          left: `calc(50% + ${(vi % 5 - 2) * 7}px)`,
                        }} />
                      ))}
                      <div style={{ position: "absolute", bottom: -40, fontSize: 9, color: "#6b6d78", textAlign: "center", width: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: sans }}>
                        {s.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Heatmap */}
            <div style={sectionStyle}>
              <h3 style={headerStyle}>Plate Heatmap{assay.subtractRef && parsedRef ? " (corrected)" : ""}</h3>
              <div style={{ overflowX: "auto" }}>
                <div style={{ display: "flex", gap: 2, marginLeft: 28 }}>
                  {COLS.map(c => <div key={c} style={{ width: 64, textAlign: "center", fontSize: 10, color: "#4a4a6a" }}>{c}</div>)}
                </div>
                {results.dataMatrix.map((row, r) => {
                  const allV = results.dataMatrix.flat();
                  const minV = Math.min(...allV); const maxV = Math.max(...allV); const rng = maxV - minV || 1;
                  return (
                    <div key={r} style={{ display: "flex", gap: 2, marginBottom: 2 }}>
                      <div style={{ width: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "#4a4a6a" }}>{ROWS[r]}</div>
                      {row.map((val, c) => {
                        const norm = (val - minV) / rng;
                        return (
                          <div key={c} title={`${ROWS[r]}${COLS[c]} (${plateIds[r][c] || "-"}): ${val.toFixed(4)}`}
                            style={{
                              width: 64, height: 34, borderRadius: 3,
                              background: `rgb(${Math.round(16 + norm * 50)},${Math.round(16 + norm * 100)},${Math.round(60 + norm * 120)})`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 9, fontFamily: mono, color: norm > 0.5 ? "#0c0c14" : "#c8cad0",
                            }}>{val.toFixed(3)}</div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Individual values */}
            <div style={sectionStyle}>
              <h3 style={headerStyle}>Individual Values</h3>
              {Object.entries(results.stats).map(([idx, s]) => {
                const pc = GROUP_PALETTE[idx % GROUP_PALETTE.length];
                return (
                  <div key={idx} style={{ marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: pc.text }}>{s.name}: </span>
                    <span style={{ fontSize: 11, fontFamily: mono, color: "#6b6d78" }}>
                      {s.values.map((v, i) => `${s.sampleIds[i]}(${s.wells[i]})=${v.toFixed(4)}`).join("  |  ")}
                    </span>
                  </div>
                );
              })}
              {results.ungrouped.length > 0 && (
                <div style={{ marginTop: 12, padding: 10, border: "1px solid #2a2a3a", borderRadius: 4 }}>
                  <span style={{ fontSize: 11, color: "#ffd93d" }}>Ungrouped ({results.ungrouped.length}): </span>
                  <span style={{ fontSize: 10, fontFamily: mono, color: "#6b6d78" }}>
                    {results.ungrouped.map(w => `${w.sampleId}(${w.well})=${w.value.toFixed(4)}`).join("  |  ")}
                  </span>
                </div>
              )}
            </div>

            <button onClick={() => setStep("map")} style={{ padding: "10px 20px", fontSize: 13, background: "transparent", color: "#6b6d78", border: "1px solid transparent", borderRadius: 6, cursor: "pointer" }}>
              Back to Plate Map
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
