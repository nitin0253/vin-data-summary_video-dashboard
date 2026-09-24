# VIN Video Summary dashboard

Live dashboard over the Metabase model **13134 – VIN data summary video nik**
(https://metabase.spyne.ai/model/13134-vin-data-summary-video-nik).

Hosted on **GitHub Pages**; data is refreshed by a GitHub Action.

- `index.html`: the dashboard. It reads `data.json`, and all filtering and KPIs are computed in the browser.
- `scripts/build-data.mjs`: logs in to Metabase, runs the model as CSV
  (`POST /api/card/13134/query/csv`) and writes a compact columnar `data.json` (~9 MB, ~1 MB gzipped, for ~820k rows).
- `.github/workflows/deploy.yml`: runs the script and publishes `index.html` + `data.json` to Pages
  every 15 minutes, on every push to `main`, and on demand (Actions → Deploy dashboard → Run workflow).

## KPIs
- **Unique enterprises**: distinct `enterprise_id`
- **Unique teams**: distinct `team_id`
VINs are counted **once per rooftop (team)**: a VIN under two rooftops counts twice, and repeated rows for the
same VIN in the same rooftop count once. This applies to every VIN number on the page.

- **Unique VINs**: distinct (`sku_name`, `team_id`)
- **QC On count**: same, where `video_qualityCheck = 1`
- **Videos processed**: same, where `Video_Processed = 1`

## Views
A **Summary / Report** switch at the top centre of the header (also `#summary` / `#report` in the URL). Both views
use the same filters.

- **Summary**: KPI cards, source/region cards, breakdown table.
- **Report**: five rows of three cards (total / QC on / video processed), in this order:
  - **Enterprise level**: enterprises with any VIN / with a QC-on VIN / with a processed VIN.
  - **Rooftop (team) level**: the same counts for rooftops.
  - **VIN level**: total VINs, QC on VINs, video processed VINs (VIN per rooftop).
  - **ENT customer segment**: VIN counts where `Customer Segment` = Ent, with the enterprise and rooftop spread under each card.
  - **AMER region**: the same for `region` = AMER.

  The ENT and AMER rows also respect every filter (e.g. Region = EMEA makes the AMER row 0).

  Clicking a VIN card opens the VIN list. Clicking an enterprise or rooftop card opens a sortable list with VINs,
  QC on and processed counts and percentages, plus CSV download.

## Cards and breakdown
- **Source, Region and Customer segment cards** (below the KPIs): unique VINs per value and each value's share. They're counted under every
  filter except their own dimension. Clicking a card toggles that filter.
- **Breakdown table**: Enterprise (team view), Stage (with sub-stage), Customer segment and Products. Segment comes from the rows in scope; stage and products per team, taken from the team's latest row. An enterprise row
  shows every value found across its teams.

## Drill-down
- **Enterprises / Teams cards**: jump to the breakdown table grouped by enterprise or team.
- **VINs / Videos processed cards**, and the VIN or processed numbers in any table row (or the total row): open the
  matching records (VIN, enterprise, team, CRM status, source, video QC, processed, created date) with search and CSV download.
- **Enterprise / team name** in the table: filter the whole dashboard to it. **Teams count**: filter to that enterprise and show its teams.

VIN strings live in `vins.txt`, which is downloaded only when a drill-down is first opened.

## Filters
Date on `created_on` (All time, Today, Yesterday, This week, Last week, This month (default), Last month, Last 30 days, Custom),
Enterprise, Team, `crm_status`, `video_qualityCheck`, `source`, `region`, `Customer Segment`. All of them are multi-select, and each list only shows
values that match the other active filters.

## Setup (one time)
1. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → New repository secret**, then add:

| Secret | Value |
|---|---|
| `METABASE_USER` | Metabase login email |
| `METABASE_PASSWORD` | Metabase password |
| `METABASE_API_KEY` | optional, used instead of user/password |

3. **Actions → Deploy dashboard → Run workflow**. The run log prints the row count and column headers.

The model number defaults to 13134. To change it, set a repository *variable* named `CARD_ID`.

Note: the published `data.json` is public, just like the Pages site.

## Local test
```bash
METABASE_USER=... METABASE_PASSWORD=... node scripts/build-data.mjs _site/data.json && cp index.html _site/ && npx serve _site
```
