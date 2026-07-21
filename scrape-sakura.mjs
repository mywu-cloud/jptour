// scripts/scrape-sakura.mjs
//
// Phase 1 骨架 — 用 Playwright 抓取 jptour.pages.dev 的當季櫻花開花預測／實測資料，
// 輸出成一支帶日期戳的快照 JSON + 一支 latest.json（放在同一個資料夾）。
//
// ⚠️ Claude Code 動工前必讀：
// 1. 先實際打開 jptour.pages.dev，確認資料呈現方式：
//    - 如果頁面背後有打 API / 回傳 JSON（打開瀏覽器 devtools Network 分頁看一下），
//      優先直接 fetch 那支 API，不要用 Playwright 硬爬 DOM——更快、更穩定。
//    - 只有在真的沒有 API、資料是渲染在 HTML 裡才用下面這種 Playwright 爬取方式。
// 2. 下面的 CSS selector（標了 TODO 的地方）都是佔位符，需要對照真實頁面結構修改。
// 3. 地點命名：jptour.pages.dev 上的都道府県/城市寫法，很可能跟本專案歷史 CSV
//    使用的漢字不完全一致（可能是平假名、羅馬拼音、或簡稱）。
//    這支腳本先原樣輸出抓到的地名，「地名對照表」留給 Phase 2 的合併腳本處理，
//    不要在這裡就硬轉換，避免兩邊邏輯打架、以後除錯困難。
//
// 執行環境變數：
//   TEST_MODE = "true" | "false"
//     true  → 輸出到 scrape-output/data/sakura-test/{year}/...
//     false → 輸出到 scrape-output/data/sakura/{year}/...

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE_URL = "https://jptour.pages.dev/"; // TODO: 換成實際的櫻花前線頁面路徑
const TEST_MODE = (process.env.TEST_MODE ?? "true") === "true";
const OUTPUT_ROOT = path.join(
  "scrape-output",
  "data",
  TEST_MODE ? "sakura-test" : "sakura"
);

function todayISO() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function currentSakuraYear() {
  // 櫻花季通常落在同一年的 2–5 月，直接用今年即可；
  // 如果之後要處理跨年度（例如 12 月就開始追蹤隔年 1 月的預測），在這裡調整。
  return new Date().getFullYear();
}

/**
 * TODO: 這是核心爬取邏輯，需要對照真實 DOM 改寫。
 * 回傳格式範例（每一筆代表一個城市的當前資料）：
 * {
 *   location_raw: "東京 都心",     // 網站上原始寫法，不要在這裡做地名轉換
 *   status: "predicted" | "observed", // 預測值 or 實測值
 *   kaika_date: "3/25" | null,     // 開花日（M/D）
 *   mankai_date: "4/2" | null,     // 滿開日（M/D）
 *   source_updated_at: "2026-03-20" // 網站上標示的資料更新時間，沒有就填抓取當天
 * }
 */
async function scrapeSakuraData(page) {
  await page.goto(SOURCE_URL, { waitUntil: "networkidle" });

  // TODO: 換成實際的 selector。以下純粹是示意寫法。
  // 例如網站是一個表格，每一列代表一個城市：
  const rows = await page.$$eval(
    "table.sakura-forecast tbody tr", // TODO
    (trs) =>
      trs.map((tr) => {
        const cells = Array.from(tr.querySelectorAll("td")).map((td) =>
          td.textContent.trim()
        );
        return {
          location_raw: cells[0] ?? null,   // TODO: 對應正確欄位
          kaika_date: cells[1] || null,      // TODO
          mankai_date: cells[2] || null,     // TODO
          status: cells[3]?.includes("実測") ? "observed" : "predicted", // TODO
        };
      })
  );

  return rows.map((r) => ({
    ...r,
    source_updated_at: todayISO(),
  }));
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  let records;
  try {
    records = await scrapeSakuraData(page);
  } finally {
    await browser.close();
  }

  if (!records || records.length === 0) {
    console.error("⚠️ 沒有抓到任何資料，中止寫檔（避免用空資料覆蓋 latest.json）");
    process.exit(1);
  }

  const year = currentSakuraYear();
  const date = todayISO();
  const yearDir = path.join(OUTPUT_ROOT, String(year));
  await mkdir(yearDir, { recursive: true });

  const snapshotPath = path.join(yearDir, `${date}.json`);
  const latestPath = path.join(yearDir, "latest.json");

  const payload = {
    year,
    scraped_at: new Date().toISOString(),
    source: SOURCE_URL,
    test_mode: TEST_MODE,
    records,
  };

  // 帶日期戳的快照：每天一份、彼此獨立，絕對不覆蓋
  await writeFile(snapshotPath, JSON.stringify(payload, null, 2), "utf-8");
  // latest.json：這支本來就設計成每次執行會被覆蓋，指向「最新一次」結果
  await writeFile(latestPath, JSON.stringify(payload, null, 2), "utf-8");

  console.log(`✅ 寫入 ${snapshotPath}`);
  console.log(`✅ 更新 ${latestPath}`);
  console.log(`共 ${records.length} 筆地點資料（test_mode=${TEST_MODE}）`);

  // 給 workflow 拿去組 commit message 用
  if (process.env.GITHUB_OUTPUT) {
    await writeFile(
      process.env.GITHUB_OUTPUT,
      `snapshot_date=${date}\n`,
      { flag: "a" }
    );
  }
}

main().catch((err) => {
  console.error("爬取失敗:", err);
  process.exit(1);
});
