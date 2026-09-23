# VIN Video Summary dashboard

Live dashboard over the Metabase model **13134 – VIN data summary video nik**
(https://metabase.spyne.ai/model/13134-vin-data-summary-video-nik).

- `index.html` — the dashboard. All filtering and KPIs are computed in the browser.
- `api/data.js` — Vercel serverless function. Logs in to Metabase, runs the model as CSV
  (`POST /api/card/13134/query/csv`), caches it for 5 minutes and returns `{rows, count, lastSynced}`.

## KPIs
- **Unique enterprises**: distinct `enterprise_id`
- **Unique teams**: distinct `team_id`
- **Unique VINs**: distinct `sku_name`
- **Videos processed**: distinct `sku_name` where `Video_Processed = 1`

## Filters
Date on `created_on` (All time, Today, Yesterday, This week, Last week, This month (default), Last month, Last 30 days, Custom),
Enterprise, Team, `crm_status`, `video_qualityCheck`, `source`. All of them are multi-select, and each list only shows
values that match the other active filters.

## Deploy (Vercel)
Import this repo in Vercel, then set these environment variables and redeploy:

| Variable | Value |
|---|---|
| `METABASE_USER` | Metabase login email |
| `METABASE_PASSWORD` | Metabase password |
| `CARD_ID` | `13134` (default) |
| `METABASE_URL` | optional, base host only: `https://metabase.spyne.ai` |
| `METABASE_API_KEY` | optional, used instead of user/password |

Check parsing with `/api/data?debug=1`, and force a refresh with `/api/data?force=1`.
