# Plate Analyzer

A browser-based analysis tool for 96-well plate data — ELISA, luminescence,
viability, IncuCyte exports, anything that produces an 8×12 grid of numbers.
Paste the plate map, paste the reader output, define groups, get statistics and
QC plots.

Built for bench scientists doing this by hand in Excel every time.

Authored by Jennifer Nguyen Armstrong and Claude.

| Read this | If you |
|---|---|
| **[README-scientists.txt](README-scientists.txt)** | Want to use the tool. Four-step walkthrough, supported assays, and the paste formats real reader software produces. |
| **[README-developer.md](README-developer.md)** | Want to extend it. State shape, the parser, and the extension points for other plate formats, CSV export, and flow. |

Two documents rather than one because the audiences need different things — a
scientist needs the task sequence, a developer needs the data model. This is
**audience-segmented documentation** and the split is the conventional one.

---

## Three design properties worth stating up front

**The domain model is the plate, not the assay.** The tool does arithmetic on a
labelled numeric grid. `assay.readout` and `assay.units` are display-only
strings; nothing downstream branches on assay type. This is the single decision
that makes the tool general: supporting a new assay is a documentation change,
not a code change, and the parser, group matching, and statistics are all
**dimension-agnostic** — they iterate whatever the plate map contains, which is
why 6-, 24- and 48-well support is a constants change rather than a rewrite.

**Nothing is silently dropped.** Every labelled well is either assigned to a
group or lands in the `ungrouped` list, which is displayed in the results. This
is a **completeness invariant**: the number of labelled wells in equals the
number accounted for out, and there is no code path that discards a well without
showing it. Silent data loss is the failure mode that matters most in an analysis
tool, because the output still looks correct.

**Parsing is confirmed before it is committed.** The user clicks *Parse data*,
sees the parsed block colour-coded by group, and only then runs the analysis.
This is a **verify-before-commit checkpoint** and it is deliberate, not a UI
step: plate reader exports are inconsistent enough that a layout mismatch is
likely, and a mismatch caught at the parse stage costs a re-paste, while the same
mismatch caught after analysis costs a wrong result that nobody notices.

**Client-side only, zero egress.** No backend, no network calls, no storage.
Data does not leave the browser and nothing persists across a refresh. That is a
compliance property, not a tech note — unpublished data can go into it without
leaving the machine.

---

## What it computes

Per group: n, mean, SD, SEM, CV%, min, max. Reference-wavelength subtraction is
applied element-wise before anything else, when enabled.

Three outputs, each doing a different job:

- **Statistics table** — the numbers. CV% is colour-coded against **QC acceptance
  thresholds** (green < 10%, yellow 10–20%, red > 20%). These are conventional
  for ELISA and hardcoded; they are not appropriate for every assay.
- **Bar chart** — mean + SEM with individual points overlaid, so the spread is
  visible rather than summarised away.
- **Plate heatmap** — the full 8×12 of corrected values. This is the **spatial
  QC** view: edge effects, gradients, and pipetting errors are patterns in plate
  position, and they are invisible in a group-level statistics table because
  grouping discards well coordinates.

---

## Scope

**Handled.** Non-contiguous replicates, arbitrary plating schemes,
case-insensitive ID matching, ranges and lists in group definitions, special IDs
(`STD`, `BLK`/`BLANK`, `POS`, `NEG`) recognised by prefix without needing a group,
single or dual wavelength, and the row-letter/column-header/trailing-wavelength
noise that reader exports emit.

**Not handled.** One analyte per analysis — multiplex and Luminex per-bead data
run as separate analyses against the same plate map. Reference subtraction is the
only correction; per-row blank subtraction and multi-step normalisation are not
implemented. No undo, no persistence.

**On the roadmap.** Flow cytometry. The group-and-statistics model transfers
directly — gated FCS exports are per-population count or frequency tables, which
is the same shape — but the input is a panel definition rather than a plate map,
so it is a sibling component sharing the statistics layer, not a parser change.

---

## Glossary

The terms used in these two documents, each paired with the plain description of
the same thing. Both columns are accurate — the left one is what to call it when
writing for developers, the right one is what it actually means. Kept here
because this tool has a mixed audience and the developer doc uses the formal
terms throughout.

| Term | In plain terms | Where it applies here |
|---|---|---|
| **Finite state machine** | One variable says which screen you're on; four screens, in order, no going back | The `step` field. It's why a single ~1,000-line component stays manageable — the UI cannot be in two states at once |
| **Completeness invariant** | Nothing gets silently dropped, on any path | Every labelled well is either grouped or listed in `ungrouped`. Not "we handled that case" but "no code path can violate it" |
| **Verify-before-commit checkpoint** | Show the user what you parsed before you calculate anything on it | The *Parse data* step. The correct pairing for a heuristic parser: if it can misread the layout, it has to show its work first |
| **Defensive parsing** | Clean up whatever the reader software gives you instead of rejecting it | `parseDataBlock`. The alternative strategy is validate-and-reject, which would mean telling scientists their export is wrong |
| **Known false-positive domain** | The specific case where a shortcut gets it wrong, stated exactly | The wavelength strip: a real 13th column valued 300–800. Narrower than "it might misfire on fluorescence data" |
| **Client-side only / zero egress** | Nothing leaves the browser | No backend, no network calls, no storage. This is a compliance property for unpublished data, not a tech note |
| **QC acceptance thresholds** | The cutoffs for "this replicate is good enough" | CV% coloured green < 10%, yellow 10–20%, red > 20%. Conventional for ELISA, hardcoded, not right for every assay |
| **Spatial QC** | Looking for problems that are patterns in *where* on the plate, not in the numbers | The heatmap. Edge effects, gradients, pipetting errors. Grouping discards well coordinates, so the statistics table structurally cannot show these |
| **Dimension-agnostic** | The logic iterates whatever the grid contains and doesn't care about its size | Parser, group matching and statistics. Why 6/24/48-well support is a constants change |
| **Domain model** | What the code is fundamentally *about* | The plate, not the assay. Nothing branches on assay type, so a new assay is a documentation change |
| **Statistics layer** | The reusable calculation part, separate from the input format | What a flow-cytometry component would share. The FCS work is a new input adapter, not a parser change |
| **Audience-segmented documentation** | Separate docs for people who use it and people who change it | The two READMEs. The conventional split, not an ad-hoc one |

---

Single React component, hooks only (`useState`, `useRef`). No charting library,
no styling library, no build step required — it runs as a Claude artifact or
dropped into Vite/CRA as-is.
