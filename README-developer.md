# Plate Analyzer — Developer README
Authored by Jennifer Naomi Nguyen and Claude



> Terms used below — finite state machine, completeness invariant, defensive parsing, false-positive domain — are defined in plain language in the [glossary](README.md#glossary).

A single-component React tool for 96-well plate data analysis. No backend, no dependencies beyond React. Built to handle the messy real-world output of plate reader software without requiring any configuration from the user.

 

---

 

## Architecture

 

Everything lives in one React component (`PlateAnalyzer`). State is managed with `useState`. There is no routing, no context, no external state library.

The four "steps" (map → groups → data → results) are a **finite state machine** held in a single `step` string — four states, linear transitions, no history and no back-navigation. Views are conditionally rendered off it. This is worth naming because it is what keeps the component tractable at ~1,000 lines: there is exactly one variable that says what the user is looking at, so there is no way for the UI to be in two states at once.

**The domain model is the plate, not the assay.** The tool does arithmetic on a labelled numeric grid; `assay.readout` and `assay.units` are display-only and nothing branches on them. Everything below follows from that — the parser, group matching and statistics are **dimension-agnostic**, which is why the extension points in this document are mostly constants changes.

 

### State shape

 

```js

{

  step: "map" | "groups" | "data" | "results",

 

  plateIds: string[][],        // 8×12 grid of sample ID strings

  groups: [                    // user-defined experimental groups

    { name: string, sampleIds: string }

  ],

 

  assay: {

    name: string,

    readout: string,

    units: string,

    signalWL: string,          // wavelength as string (display only)

    refWL: string,

    subtractRef: boolean,

    notes: string,

  },

 

  rawSignal: string,           // raw paste from user, pre-parse

  rawRef: string,

  parsedSignal: number[][] | null,   // 8×12 after parsing

  parsedRef: number[][] | null,

 

  results: {

    stats: {

      [groupIndex]: {

        name: string,

        values: number[],

        wells: string[],       // e.g. ["A1", "A2"]

        sampleIds: string[],   // sample IDs in order

        n: number,

        mean: number,

        std: number,

        sem: number,

        cv: number,            // as percentage (0–100)

        min: number,

        max: number,

      }

    },

    dataMatrix: number[][],    // corrected 8×12 (signal minus ref if applicable)

    ungrouped: [               // labeled wells not assigned to any group

      { well: string, sampleId: string, value: number }

    ]

  } | null,

 

  bulkPaste: string,

  newGroupName: string,

  newGroupSamples: string,

}

```

 

---

 

## Key functions

 

### `parseDataBlock(text: string): number[][] | null`

 

The parser is the most important piece of the tool. Plate reader software exports are inconsistent — this function handles the common variants:

 

This is **defensive parsing**: it makes no assumption about which of the common export variants it is looking at, and normalises rather than validating-and-rejecting.

- Strips a leading non-numeric column — the row-letter header. The check is "first cell is not a number and the second one is", so it strips any leading label, not only `A`–`H`.

- Strips a trailing wavelength column, **only when the row has more than 12 values**, if that 13th value falls in 300–800.

- Filters rows with fewer than 10 numeric values (header rows, blank lines, metadata)

- Returns `null` if fewer than 8 valid rows are found



Returns an 8×12 `number[][]` or `null`.

The user sees a parse confirmation before analysis runs. This is a **verify-before-commit checkpoint**, and it is the design response to the parser being heuristic: a heuristic that can misread the layout must show its work before anything downstream depends on it. A mismatch caught here costs a re-paste; the same mismatch caught after analysis costs a wrong result that looks right.

 

**Known false-positive domain (narrower than previously documented).** The wavelength heuristic strips a 13th column whose value is 300–800. An earlier version of this note warned that it could misfire on any fluorescence or luminescence data in that range — it can't. The strip is gated on `nums.length > 12`, so a well-formed 12-column plate is never touched regardless of magnitude.

The real failure case is narrow and specific: a **13th column that is real data** — a row average, or a 13th replicate — whose value happens to land in 300–800. That column is dropped silently. If your reader emits a row-summary column, check the parse preview.

 

---

 

### `parseSampleList(str: string): string[]`

 

Parses the sample ID input in the Groups step. Supports:

 

- Ranges: `1-10`, `S1-S10`, `VEH1-VEH5`

- Comma or space separated: `S1, S2, S3` or `S1 S2 S3`

- Mixed: `1-5, S6, S7`



Range parsing extracts a numeric suffix and iterates between min and max, preserving any alphabetic prefix. The result is an array of strings that gets matched (case-insensitively) against `plateIds`.

 

---

 

### `buildSampleGroupMap(): { [sampleId: string]: { groupIdx: number, name: string } }`

 

Builds a lookup from uppercase sample ID → group index + name. Called on every render. Not memoized — the group list is small enough that this is not a performance concern.

 

---

 

### `getWellStyle(sid, sgMap)`

 

Returns `{ fill, text }` color values for a given sample ID. Priority order:

 

1. Special IDs (`STD`, `BLK`, `BLANK`, `POS`, `NEG`) — fixed colors, matched by prefix

2. Group membership via `sgMap` — color from `GROUP_COLORS` palette, indexed by group order

3. Labeled but ungrouped — dim default

4. Empty — `null`



---

 

### `analyze()`

 

Runs when the user clicks Analyze on the data step. Sequence:

 

1. Deep-copies `parsedSignal`

2. If `subtractRef` is true and `parsedRef` exists, subtracts reference matrix element-wise

3. Iterates all 96 wells, matches each `plateIds[r][c]` against `sampleGroupMap`

4. Accumulates values per group, and every labelled well with no group match into `ungrouped` — the **completeness invariant**: labelled wells in equals wells accounted for out, with no path that discards one without surfacing it

5. Computes statistics per group

6. Sets `results` in state and advances to results step



---

 

## Extending the tool

 

### Adding plate formats (6-well, 24-well, 48-well)

 

`ROWS` and `COLS` are module-level constants. To support variable formats:

 

1. Add a `plateFormat` field to assay state with options like `"96" | "48" | "24" | "6"`

2. Make `ROWS` and `COLS` derived from that selection:

   ```js

   const FORMAT = {

     "96": { rows: ["A","B","C","D","E","F","G","H"], cols: 12 },

     "48": { rows: ["A","B","C","D","E","F"], cols: 8 },

     "24": { rows: ["A","B","C","D"], cols: 6 },

     "6":  { rows: ["A","B"], cols: 3 },

   };

   ```

3. Initialize `plateIds` from the selected format dimensions

4. The parser, group matching, and stats logic are format-agnostic — they iterate whatever `plateIds` contains



### Adding data export

 

Results are already in a flat structure that maps cleanly to CSV. A simple export function:

 

```js

function exportCSV(stats, assay) {

  const rows = [["Group","n","Mean","SD","SEM","CV%","Min","Max"]];

  Object.values(stats).forEach(s => {

    rows.push([s.name, s.n, s.mean, s.std, s.sem, s.cv, s.min, s.max]);

  });

  const csv = rows.map(r => r.join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv" });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url; a.download = `${assay.name || "plate"}_results.csv`; a.click();

}

```

 

Individual well values are in `stats[idx].values` / `.wells` / `.sids` arrays — these can be exported as a second sheet or appended as rows below the group summary.

 

### Adding new assay types

 

The tool is assay-agnostic — it just does arithmetic on a numeric grid. The `assay.readout` and `assay.units` fields are display-only strings. No code changes needed to support a new assay type, only documentation.

 

The one exception is reference subtraction, which is currently a single boolean. If you need more complex corrections (e.g. blank subtraction per-row, or multi-step normalization), that logic would go in `analyze()` after the reference subtraction step.

 

### FCS / flow cytometry

 

FCS files after gating are commonly exported as per-population count or frequency tables — these map well to the existing group + statistics model. The main additions needed:

 

- A file input that accepts `.fcs` or gated Excel exports

- A panel definition step (replacing or extending the current plate map) to capture markers and populations

- Population-level stats instead of single well values



The UI flow (define samples → define groups → paste/upload data → view stats) transfers directly. This would likely be a separate component sharing the group definition and statistics logic.

 

---

 

## Known limitations

 

- The wavelength-stripping heuristic in `parseDataBlock` silently drops a real 13th column if its value falls in 300–800 (see the false-positive domain above — it does not affect 12-column plates)

- No undo/redo — clearing the plate or removing a group is immediate

- No persistence — refreshing the page resets everything (intentional for the current scope)

- Bar chart is pure CSS/div math, not a charting library — works for the current use case but would need a proper library (Recharts, Chart.js) for log scale, axis formatting, or statistical overlays

- CV% coloring thresholds (10% / 20%) are hardcoded — these are conventional for ELISA but may not be appropriate for all assay types



---

 

## Built with

 

- React (hooks only — `useState`, `useRef`)

- No charting library

- No styling library

- No build step required if used as a Claude artifact or dropped into a Vite/CRA project as-is

 