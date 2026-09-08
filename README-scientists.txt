Plate Analyzer
A browser-based tool for quickly analyzing 96-well plate data — ELISAs, multiplex assays, cell viability, IncuCyte exports, luminescence readouts, anything that gives you an 8×12 grid of numbers.
Built for bench scientists who are tired of doing this by hand in Excel every time.

Authored by Jennifer Nguyen Armstrong and Claude

What it does
Paste or drag in your plate layout and raw reader data, define your experimental groups, and get back:
	•	Mean, SD, SEM, CV% per group
	•	Bar chart with individual data points overlaid (scatter + error bars)
	•	Plate heatmap for quick visual QC
	•	Individual well values with well coordinates

How to use it
The tool walks you through four steps in order.
Step 1 — Plate map
Fill in your assay details (name, readout type, units, wavelengths). Then enter your sample IDs.
Paste from Excel: Copy your plate layout directly from a spreadsheet and paste it into the text box. Tab-separated, 8 rows × 12 columns. Row letters (A–H) are auto-detected and stripped if present.
Upload a file: CSV or TSV files work the same way.
Click to edit: Individual wells are also directly editable if you just need to fix a few cells.

Step 2 — Groups
Assign sample IDs to experimental groups. Groups get color-coded and tracked through the rest of the analysis.
Defining samples: You can use ranges or lists:
	•	1-10 — expands to samples 1 through 10
	•	S1, S2, S3 — comma-separated list
	•	VEH1-5, VEH7 — mixed range and individual
IDs are matched case-insensitively against the plate map.
Special IDs (recognized automatically — no group needed):
ID prefix
Meaning
STD or STD1, STD2…
Standards
BLK or BLANK
Blanks
POS
Positive control
NEG
Negative control
These get their own fixed color on the plate map. Everything ungrouped shows up in the results as a separate list so nothing gets silently dropped.

Step 3 — Data
Paste your raw reader output — the 8×12 numeric block — directly from your plate reader software or Excel export. The parser auto-strips:
	•	Row letter headers (A, B, C…)
	•	Column number headers
	•	Trailing wavelength columns (common in dual-wavelength reader exports)
Reference wavelength subtraction: If your assay uses a reference wavelength (e.g. 450nm signal / 570nm ref for ELISA), enable "subtract reference" in step 1 and paste both data blocks. The tool subtracts them before calculating anything.
Click Parse data to verify the block was read correctly before proceeding. The parsed values are shown color-coded by group so you can catch any layout mismatches before analysis.

Step 4 — Results
	•	Statistics table: n, mean, SD, SEM, CV%, min, max per group. CV% is color-coded — green < 10%, yellow 10–20%, red > 20%.
	•	Bar chart: Mean + SEM error bars, individual data points scattered over bars (hover for well ID and value).
	•	Plate heatmap: Full 8×12 view of corrected values, useful for catching edge effects, gradient artifacts, or pipetting errors.
	•	Individual values: Every well listed by sample ID, well coordinate, and value.

Supported assay types
Anything that produces a numeric 8×12 grid:
	•	ELISA (single or dual wavelength)
	•	Luminescence assays (luciferase, ATP viability)
	•	Multiplex (if you export per-analyte plates)
	•	IncuCyte confluency or count exports
	•	Cell viability (MTT, CellTiter-Glo, resazurin)
	•	Cytokine bead arrays — if exported per-analyte
Flow cytometry (FACS) is on the roadmap — the group/statistics model transfers, but population gating requires a different input format.

Tips
	•	Your plating scheme doesn't have to follow any particular convention. As long as sample IDs in the map match the group definitions, the tool will find them.
	•	Replicates don't need to be contiguous — scattered replicates across the plate are handled fine.
	•	The "ungrouped" section in results catches any labeled wells not assigned to a group, so you won't lose data silently.
	•	For multichannel exports (e.g. Luminex per-bead data), run each analyte as a separate analysis with the same plate map.

Tech notes
Built as a single React component. No backend, no data leaves the browser. Paste in, get results, close the tab — nothing is stored.
