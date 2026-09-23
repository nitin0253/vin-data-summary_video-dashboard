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
- **Unique VINs**: distinct `sku_name`
- **QC On count**: distinct `sku_name` where `video_qualityCheck = 1`
- **Videos processed**: distinct `sku_name` where `Video_Processed = 1`

## Cards and breakdown
- **Source and Region cards** (below the KPIs): unique VINs per value and each value's share. They're counted under every
  filter except their own dimension. Clicking a card toggles that filter.
- **Breakdown table**: Stage (with sub-stage) and Products per team, taken from the team's latest row. An enterprise row
  shows every value found across its teams.

## Drill-down
- **Enterprises / Teams cards**: jump to the breakdown table grouped by enterprise or team.
- **VINs / Videos processed cards**, and the VIN or processed numbers in any table row (or the total row): open the
  matching records (VIN, enterprise, team, CRM status, source, video QC, processed, created date) with search and CSV download.
- **Enterprise / team name** in the table: filter the whole dashboard to it. **Teams count**: filter to that enterprise and show its teams.

VIN strings live in `vins.txt`, which is downloaded only when a drill-down is first opened.

## Filters
Date on `created_on` (All time, Today, Yesterday, This week, Last week, This month (default), Last month, Last 30 days, Custom),
Enterprise, Team, `crm_status`, `video_qualityCheck`, `source`, `region`. All of them are multi-select, and each list only shows
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
