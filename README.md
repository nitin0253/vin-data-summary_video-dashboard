# VIN Video Summary dashboard

Live dashboard over the Metabase model **13134 – VIN data summary video nik**
(https://metabase.spyne.ai/model/13134-vin-data-summary-video-nik).

Hosted on **GitHub Pages**; data is refreshed by a GitHub Action.

- `index.html`: the dashboard. It reads `data.json`, and all filtering and KPIs are computed in the browser.
- `scripts/build-data.mjs`: logs in to Metabase, runs the model as CSV
  (`POST /api/card/13134/query/csv`) and writes `{rows, count, lastSynced}` to `data.json`.
- `.github/workflows/deploy.yml`: runs the script and publishes `index.html` + `data.json` to Pages
  every 15 minutes, on every push to `main`, and on demand (Actions → Deploy dashboard → Run workflow).

## KPIs
- **Unique enterprises**: distinct `enterprise_id`
- **Unique teams**: distinct `team_id`
- **Unique VINs**: distinct `sku_name`
- **Videos processed**: distinct `sku_name` where `Video_Processed = 1`

## Filters
Date on `created_on` (All time, Today, Yesterday, This week, Last week, This month (default), Last month, Last 30 days, Custom),
Enterprise, Team, `crm_status`, `video_qualityCheck`, `source`. All of them are multi-select, and each list only shows
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
