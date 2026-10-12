// scripts/scrape-koyo.mjs
//
// 紅葉前線每日爬蟲（零依賴，Node 20+ 內建 fetch）
//
// 資料來源（只擷取日期、狀態、座標等事實性資料，不轉載文章/照片/評論）：
//   1. Weathernews  https://weathernews.jp/koyo/area/<pref>/
//      Nuxt SSR 頁面，<script id="__NUXT_DATA__"> 內含各景點結構化資料：
//      pointname / latd / lond / rank_txt(色づき状況) / migoromon+migoroday(見頃予想日) / reinen(例年)
//   2. 日本気象株式会社 https://n-kishou.com/corp/news-contents/autumn/
//      第N回「紅葉・黄葉見頃予想」新聞稿中的主要城市預測表（<table>）
//
// 輸出（不覆蓋歷史 — flight tracker 坑 #1）：
//   data/koyo/YYYY-MM-DD.json   每日快照（同日重跑才會覆寫當日檔）
//   data/koyo/latest.json        manifest，指向最新快照
//
// 環境變數：
//   OUT_DIR   預設 data/koyo
//   DELAY_MS  每次請求間隔，預設 1500（禮貌爬取）
//   PREFS     逗號分隔的 wnSlug，只抓部分縣（除錯用），例如 PREFS=kyoto,tokyo

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = process.env.OUT_DIR || "data/koyo";
const DELAY_MS = Number(process.env.DELAY_MS || 1500);
const ONLY = (process.env.PREFS || "").split(",").map((s) => s.trim()).filter(Boolean);
const UA = "Mozilla/5.0 (compatible; jptour-koyo-bot/1.0; +https://jptour.pages.dev/)";

const WN_BASE = "https://weathernews.jp/koyo/area/";
const NK_URL = "https://n-kishou.com/corp/news-contents/autumn/";

// Weathernews 色づき段階（rank_txt 實際出現值，2026-10 觀察）→ 本站五段式（沿用 walkerplus 用語）
// 原始字串另存 statusRaw，前端 popup 會顯示細節（例：半分以上色づいた）
export const STATUS_MAP = {
  "まだ": "青葉",
  "ほんのり色づき始め": "色づき始め",
  "色づき始め": "色づき始め",
  "色づき": "色づき始め",
  "色づき進む": "色づき始め",
  "半分くらい色づいた": "色づき始め",
  "半分以上色づいた": "色づき始め",
  "見頃": "見頃",
  "落葉始め": "色あせ始め",
  "落葉中": "色あせ始め",
  "落葉": "落葉",
  "終わり": "落葉",
};
export const STATUS_ORDER = ["青葉", "色づき始め", "見頃", "色あせ始め", "落葉"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, "0");

function todayJST() {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

async function getText(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "ja" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (i === tries) throw new Error(`${url}: ${e.message}`);
      await sleep(DELAY_MS * i * 2);
    }
  }
}

// ── Weathernews ────────────────────────────────────────────────────────────

/** 從 Nuxt payload HTML 取出景點陣列（純函式，可在瀏覽器中同樣執行測試） */
export function parseWeathernews(html) {
  const m = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("找不到 __NUXT_DATA__（頁面可能改版）");
  const arr = JSON.parse(m[1]);
  const val = (i) => (typeof i === "number" && i >= 0 ? arr[i] : undefined);

  // 「x月y日現在」發表時間
  let announced = null;
  for (const o of arr) {
    if (o && typeof o === "object" && !Array.isArray(o) && "announcedDate" in o) {
      announced = val(o.announcedDate) ?? null;
      break;
    }
  }

  const seen = new Map();
  for (const o of arr) {
    if (!o || typeof o !== "object" || Array.isArray(o)) continue;
    if (!("spotid" in o && "migoroFcst" in o && "pointname" in o)) continue;
    const g = (k) => val(o[k]);
    const id = String(g("spotid") ?? "");
    if (!id || seen.has(id)) continue;
    const mon = Number(g("migoromon")) || null;
    const day = Number(g("migoroday")) || null;
    const lat = parseFloat(g("latd"));
    const lng = parseFloat(g("lond"));
    const rankTxt = String(g("rank_txt") ?? "").trim();
    seen.set(id, {
      id,
      name: String(g("pointname") ?? "").trim(),
      city: String(g("cityname") ?? "").trim(),
      lat: Number.isFinite(lat) ? +lat.toFixed(5) : null,
      lng: Number.isFinite(lng) ? +lng.toFixed(5) : null,
      status: STATUS_MAP[rankTxt] || null,   // null = Weathernews 未提供狀況
      statusRaw: rankTxt || null,
      forecast: mon && day ? `${pad(mon)}-${pad(day)}` : null, // 見頃予想日 MM-DD
      reinen: String(g("reinen") ?? "").trim().replace(/[〜～~]/g, "–") || null,
      lightup: g("lightup") === "1" || g("night") === "1",
      url: `https://weathernews.jp/koyo/spot/${id}/`,
    });
  }
  return { announced, spots: [...seen.values()] };
}

// ── 日本気象 n-kishou ───────────────────────────────────────────────────────

const stripTags = (s) => s.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/** 解析新聞稿標題（第N回、發表日）與兩張城市預測表（紅葉／黄葉） */
export function parseNkishou(html) {
  const title = stripTags((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
  const round = (title.match(/第(\d+)回/) || [])[1] || null;
  const pub = html.match(/(20\d{2})年(\d{1,2})月(\d{1,2})日/);
  const published = pub ? `${pub[1]}-${pad(pub[2])}-${pad(pub[3])}` : null;
  const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((t) =>
    [...t[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((r) =>
      [...r[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => stripTags(c[1]))
    )
  );
  const toRows = (rows) =>
    rows.slice(1).filter((r) => r.length >= 4).map((r) => {
      const diff = (r[2].match(/-?\d+/) || [])[0];
      return {
        city: r[0],
        date: r[1],            // 預測日 M/D
        diff: diff != null ? Number(diff) : null, // 平年差（日）
        diffText: (r[2].match(/[(（](.+?)[)）]/) || [])[1] || "",
        normal: r[3],          // 平年日 M/D
        species: r[4] || "",
      };
    });
  let koyo = [], ichou = [];
  for (const t of tables) {
    const head = (t[0] || []).join("");
    if (/紅葉予想日/.test(head)) koyo = toRows(t);
    else if (/黄葉予想日/.test(head)) ichou = toRows(t);
  }
  return { title, round, published, url: NK_URL, koyo, ichou };
}

// ── 彙整 ───────────────────────────────────────────────────────────────────

const mmdd = (s) => (s ? Number(s.replace("-", "")) : null);
const fmtMD = (s) => (s ? `${Number(s.slice(0, 2))}/${Number(s.slice(3))}` : null);

function summarizePref(base, wnSpots) {
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]));
  for (const s of wnSpots) if (counts[s.status] != null) counts[s.status]++;
  const fc = wnSpots.map((s) => s.forecast).filter(Boolean).sort((a, b) => mmdd(a) - mmdd(b));
  // 縣代表狀態：見頃景點 ≥ 25% 即標「見頃」；否則取景點數最多的段階（同票取較早段階）
  const known = STATUS_ORDER.reduce((a, st) => a + counts[st], 0);
  let status = "青葉", best = 0;
  for (const st of STATUS_ORDER) if (counts[st] > best) { best = counts[st]; status = st; }
  if (known && counts["見頃"] / known >= 0.25) status = "見頃";
  const median = fc.length ? fc[Math.floor(fc.length / 2)] : null;
  return {
    ...base,
    status,
    statusCounts: counts,
    spotCount: wnSpots.length,
    forecastCount: fc.length,
    forecastFrom: fmtMD(fc[0]),
    forecastTo: fmtMD(fc[fc.length - 1]),
    forecastMedian: fmtMD(median),
    wnUrl: WN_BASE + base.wnSlug + "/",
  };
}

async function main() {
  const date = todayJST();
  const baseFile = JSON.parse(await readFile(path.join(OUT_DIR, "prefectures.json"), "utf8"));
  const prefs = baseFile.prefectures.filter((p) => !ONLY.length || ONLY.includes(p.wnSlug));

  const errors = [];
  const unknownStatus = new Set();
  const prefSummaries = [];
  const allSpots = [];
  let announced = null;
  try {
    // 首頁 payload 帶有「x月x日現在の紅葉の色づき」發表時間
    announced = parseWeathernews(await getText("https://weathernews.jp/koyo/")).announced;
    await sleep(DELAY_MS);
  } catch (e) {
    console.warn(`(略過) Weathernews 首頁發表時間：${e.message}`);
  }

  for (const p of prefs) {
    try {
      const html = await getText(WN_BASE + p.wnSlug + "/");
      const r = parseWeathernews(html);
      if (!r.spots.length) throw new Error("0 筆景點（selector/payload 可能改版）");
      for (const s of r.spots) if (s.statusRaw && !STATUS_MAP[s.statusRaw]) unknownStatus.add(s.statusRaw);
      announced = announced || r.announced;
      prefSummaries.push(summarizePref(p, r.spots));
      for (const s of r.spots) allSpots.push({ ...s, pref: p.name, prefId: p.id });
      console.log(`✓ ${p.name} ${r.spots.length} spots`);
    } catch (e) {
      errors.push(`${p.name}: ${e.message}`);
      prefSummaries.push({ ...p, status: null, statusCounts: null, spotCount: 0, error: true });
      console.warn(`✗ ${p.name}: ${e.message}`);
    }
    await sleep(DELAY_MS);
  }

  let nk = null;
  try {
    nk = parseNkishou(await getText(NK_URL));
    if (!nk.koyo.length) throw new Error("城市預測表 0 列（頁面可能改版）");
    console.log(`✓ n-kishou ${nk.title} (${nk.koyo.length} cities)`);
  } catch (e) {
    errors.push(`n-kishou: ${e.message}`);
    console.warn(`✗ n-kishou: ${e.message}`);
  }

  // 失敗太多就不要寫檔，避免用殘缺資料蓋掉 latest（Actions 會標紅）
  const okPrefs = prefSummaries.filter((p) => !p.error).length;
  if (okPrefs < Math.ceil(prefs.length * 0.8)) {
    console.error(`成功縣數 ${okPrefs}/${prefs.length} 過低，中止寫檔。\n` + errors.join("\n"));
    process.exit(1);
  }

  const out = {
    date,
    generatedAt: new Date().toISOString(),
    source: "Weathernews 紅葉情報（色づき狀況・見頃予想日）／日本気象株式会社 紅葉・黄葉見頃予想",
    sources: {
      weathernews: { url: "https://weathernews.jp/koyo/", announced },
      nkishou: nk ? { url: nk.url, title: nk.title, round: nk.round, published: nk.published } : null,
    },
    cityForecast: nk ? { koyo: nk.koyo, ichou: nk.ichou } : null,
    spots: prefSummaries,          // 都道府県彙整（欄位相容舊版 + 新增欄位）
    wnSpots: allSpots,             // 景點明細
    errors,
  };
  if (unknownStatus.size) {
    out.warnings = [`未對應的色づき字串：${[...unknownStatus].join("、")}（請補進 STATUS_MAP）`];
    console.warn(out.warnings[0]);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const file = `${date}.json`;
  await writeFile(path.join(OUT_DIR, file), JSON.stringify(out));
  await writeFile(
    path.join(OUT_DIR, "latest.json"),
    JSON.stringify({ latestFile: file, updatedAt: date, note: "Manifest so front-end can find newest koyo dataset without hardcoding date." }, null, 2) + "\n"
  );
  console.log(`寫入 ${file}：${okPrefs} 縣、${allSpots.length} 景點、錯誤 ${errors.length}`);
  if (process.env.GITHUB_OUTPUT) await writeFile(process.env.GITHUB_OUTPUT, `snapshot_date=${date}\n`, { flag: "a" });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
