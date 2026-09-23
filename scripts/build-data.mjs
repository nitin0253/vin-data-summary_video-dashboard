// scripts/build-data.mjs
// Run by the GitHub Action: pulls the Metabase model "VIN data summary video nik"
// (model 13134) as CSV through the authenticated API and writes compact rows to
// a JSON file that GitHub Pages serves next to index.html.
// All filtering and KPI math happens client-side.
//
//   node scripts/build-data.mjs [out-file]   (default: _site/data.json)

import fs from 'node:fs';
import path from 'node:path';

// ── Config (GitHub → Settings → Secrets and variables → Actions). NEVER commit credentials. ──
// METABASE_URL must be the base host only; the model number goes in CARD_ID.
const MB = (process.env.METABASE_URL || 'https://metabase.spyne.ai').replace(/\/+$/, '');
const CARD_ID    = process.env.CARD_ID || '13134';   // models are cards in the Metabase API
const MB_USER    = process.env.METABASE_USER || '';
const MB_PASS    = process.env.METABASE_PASSWORD || '';
const MB_API_KEY = process.env.METABASE_API_KEY || '';  // optional alternative to user/pass

// ── Metabase auth: cache a session token, re-login automatically on expiry ──
let mbSession = null;

async function login() {
  if (!MB_USER || !MB_PASS) {
    throw new Error('Missing METABASE_USER / METABASE_PASSWORD env vars');
  }
  const resp = await fetch(`${MB}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: MB_USER, password: MB_PASS }),
  });
  if (!resp.ok) throw new Error(`Metabase login ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  mbSession = (await resp.json()).id;
  return mbSession;
}

function authHeaders(token) {
  return MB_API_KEY ? { 'X-Api-Key': MB_API_KEY } : { 'X-Metabase-Session': token };
}

async function fetchCardCsv(cardId) {
  const url = `${MB}/api/card/${cardId}/query/csv`;
  const doFetch = (token) => fetch(url, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'parameters=' + encodeURIComponent('[]'),
  });

  let token = MB_API_KEY ? null : (mbSession || await login());
  let resp = await doFetch(token);

  // Session expired / invalid → drop it, log in again, retry once.
  if (!MB_API_KEY && (resp.status === 401 || resp.status === 403)) {
    mbSession = null;
    token = await login();
    resp = await doFetch(token);
  }
  if (!resp.ok) throw new Error(`Metabase card ${cardId} query ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  return resp.text();
}

// ── CSV parser (quoted fields, embedded commas/newlines, escaped quotes) ──
function parseCSV(text) {
  const rows = [];
  let row = [], cur = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some(v => v !== '')) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some(v => v !== '')) rows.push(row);
  if (!rows.length) return [];

  const headers = rows[0].map(h => h.replace(/^﻿/, '').trim());
  return rows.slice(1).map(vals => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = (vals[i] ?? '').trim()));
    return obj;
  });
}

function pickField(r, names) {
  for (const n of names) if (r[n] != null && String(r[n]).trim() !== '') return r[n];
  return '';
}

// Normalise Metabase dates to "YYYY-MM-DDTHH:mm" (no timezone — shown as-is).
// Handles the formatted export ("23 Sep, 2026, 14:36") and ISO ("2026-09-23T14:36:00Z").
const MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
const pad = n => String(n).padStart(2, '0');
function normDate(s) {
  if (!s) return '';
  s = String(s).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4] || '00'}:${m[5] || '00'}`;
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*,?\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2}))?/);
  if (m && MONTHS[m[2].toLowerCase()]) {
    return `${m[3]}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(m[1])}T${pad(m[4] || 0)}:${m[5] || '00'}`;
  }
  m = s.match(/^([A-Za-z]{3})[a-z]*\s+(\d{1,2}),\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2})\s*(AM|PM)?)?/i);
  if (m && MONTHS[m[1].toLowerCase()]) {
    let h = +(m[4] || 0);
    if (m[6]) { const pm = m[6].toUpperCase() === 'PM'; if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
    return `${m[3]}-${pad(MONTHS[m[1].toLowerCase()])}-${pad(m[2])}T${pad(h)}:${m[5] || '00'}`;
  }
  return '';
}

// Compact, columnar encoding (the model has ~1M rows; plain objects were ~150 MB).
//   teams:  [[enterprise_id, enterprise_name, team_id, team_name], ...]
//   crm/src/vqc: distinct values
//   combos: [[teamIdx, crmIdx, srcIdx, vqcIdx, Video_Processed], ...]
//   rows sorted by VIN; three parallel columns:
//     k: combo index, d: created_on as days since 1970-01-01 (-1 = no date),
//     v: VIN id delta from the previous row (VIN ids are 0..vins-1 in sorted order)
function encode(rows) {
  const dict = () => { const m = new Map(), list = []; return { list, id: (key, val) => { let i = m.get(key); if (i === undefined) { i = list.length; m.set(key, i); list.push(val); } return i; } }; };
  const teams = dict(), crm = dict(), src = dict(), vqc = dict(), combos = dict();
  const dayOf = c => c ? Math.round(Date.UTC(+c.slice(0, 4), +c.slice(5, 7) - 1, +c.slice(8, 10)) / 864e5) : -1;

  const sorted = rows.slice().sort((a, b) => a.vin < b.vin ? -1 : a.vin > b.vin ? 1 : 0);
  const k = [], d = [], v = [];
  let vinId = -1, prevVin = null, prevId = 0;
  for (const r of sorted) {
    if (r.vin !== prevVin) { vinId++; prevVin = r.vin; }
    const t = teams.id(r.eid + '\u0000' + r.tid, [r.eid, r.ent, r.tid, r.team]);
    const combo = [t, crm.id(r.crm, r.crm), src.id(r.src, r.src), vqc.id(r.vqc, r.vqc), r.vp];
    k.push(combos.id(combo.join(','), combo));
    d.push(dayOf(r.c));
    v.push(vinId - prevId); prevId = vinId;
  }
  return {
    lastSynced: new Date().toISOString(), count: rows.length, vins: vinId + 1,
    teams: teams.list, crm: crm.list, src: src.list, vqc: vqc.list, combos: combos.list, k, d, v,
  };
}

async function main() {
  const out = process.argv[2] || '_site/data.json';
  const text = await fetchCardCsv(CARD_ID);
  const raw = parseCSV(text);

  const rows = raw.map(r => ({
    eid:  pickField(r, ['enterprise_id', 'Enterprise_ID']),
    ent:  pickField(r, ['enterprise_name', 'Enterprise_Name']),
    tid:  pickField(r, ['team_id', 'Team_ID']),
    team: pickField(r, ['team_name', 'Team_Name']),
    vin:  pickField(r, ['sku_name', 'Sku_Name', 'SKU_Name']),
    crm:  pickField(r, ['crm_status', 'CRM_Status']),
    vqc:  pickField(r, ['video_qualityCheck', 'video_qualitycheck', 'Video_QualityCheck']),
    src:  pickField(r, ['source', 'Source']),
    vp:   String(pickField(r, ['Video_Processed', 'video_processed'])).trim() === '1' ? 1 : 0,
    c:    normDate(pickField(r, ['created_on', 'Created_On', 'Created_ON'])),
  }));

  const data = encode(rows);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(data));

  // Sanity summary in the Action log.
  console.log(`Wrote ${rows.length} rows (${data.vins} unique VINs, ${data.combos.length} combos) to ${out}: ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
  console.log('Raw headers:', raw.length ? Object.keys(raw[0]).join(', ') : '(none)');
  console.log(`Rows with a created_on date: ${rows.filter(r => r.c).length}; Video_Processed = 1: ${rows.filter(r => r.vp === 1).length}`);
  if (!rows.length) throw new Error('Metabase returned no rows; keeping the previous deploy');
}

main().catch(err => { console.error(err); process.exit(1); });
