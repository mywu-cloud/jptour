# 櫻花前線資料管線 — Claude Code 執行任務書

> 這份文件是給 **Claude Code**（終端機/VS Code 版）的任務說明。可以直接複製整份文件貼給
> Claude Code，或存成 repo 裡的 `TASKS/sakura-pipeline.md` 後跟 Claude Code 說
> 「讀取 TASKS/sakura-pipeline.md，先做 Phase 1，做完跟我回報再繼續」。
>
> **重要原則：三個 Phase 請分開執行、分開review，不要一次做完。** 尤其 Phase 1 明確要求
> 先在 jptour.pages.dev 開分支測試，確認資料抓取正常、歷史快照沒有被覆蓋之後，才進到
> Phase 2／整合進「櫻花前線」正式站。

---

## 背景與既有素材

- 已完成的手動歷史資料:2010–2026 年、46 個氣象觀測地點（都道府縣代表城市）的
  開花日／滿開日 CSV，已轉成 `sakura_data.json`（附件）。
- 已完成的前端 prototype:`japan_sakura_map.html`（附件），純 HTML+Leaflet+Chart.js，
  無框架依賴，內含：
  - 依開花日/滿開日動態變色的地圖標記（含苞→剛開→盛開→滿開→花期已過）
  - 年份下拉 + 日期滑桿 + 播放動畫
  - 側邊欄：圖例、全國平均開花日趨勢圖、當年開花順序清單
  - 配色：染井吉野櫻淡粉色系；字體 Helvetica Neue（中日文 fallback Noto Sans TC）
- 既有技術棧與架構前例（同一位使用者的「日本旅遊資訊網站」專案，`CLAUDE.md` 藍圖已完成）：
  - Astro + GitHub Actions/Playwright + Cloudflare Pages/Workers
  - 沿用先前 flight tracker（`mywu-cloud/flights`，flights-276.pages.dev）驗證過的架構：
    GitHub Actions 排程 → Playwright 抓取 → JSON 存到 `gh-pages` → Cloudflare Pages 前端
    + Cloudflare Worker
- **必須避開的三個已知錯誤模式**（flight tracker 上踩過的坑，這次要在設計階段就排除）：
  1. **歷史快照被覆蓋**：每次執行把 `gh-pages` 上的資料整個覆蓋，導致舊資料遺失
  2. **通知沒有去重**：同一件事重複發送通知
  3. **Worker 的 PUT endpoint 沒有驗證**：任何人都可以寫入資料

---

## Phase 1 — 資料層：抓取 jptour.pages.dev（先在分支測試，不動正式站）

**目標**：寫一支 GitHub Actions + Playwright 排程，定期抓取 jptour.pages.dev 當季的
櫻花開花預測／實測資料，存成 JSON 累積到 `gh-pages`，且不覆蓋歷史快照。

**執行方式（重要）**：

1. 在 jptour.pages.dev 對應的 repo 裡開一個新分支（例如 `feature/sakura-scraper-test`），
   所有開發與測試都在這個分支上進行，**不要動到正式站會用到的 branch/workflow**。
2. Claude Code 需要先確認：
   - jptour.pages.dev 目前的 repo 結構、既有的 Actions workflow 有沒有可以參考或重複使用的部分
   - 該網站的資料呈現方式（是純靜態 HTML 表格、還是有 API/JSON 可直接取用）——
     如果有現成 JSON/API，優先直接 fetch，不需要用 Playwright 硬爬 DOM
3. 若必須用 Playwright 爬取畫面內容，抓取欄位至少要包含：都道府県、城市、開花日、滿開日、
   資料狀態（預測值 predicted vs 實測值 observed，因為同一個地點的資料在花季前後會更新）
4. **存檔規則（避免覆蓋歷史快照）**：
   - 每次執行都存成獨立、帶時間戳的檔案，例如：
     `data/sakura/{year}/{YYYY-MM-DD}.json`
   - 另外維護一支 `data/sakura/{year}/latest.json`，這支才是每次執行會被覆蓋的檔案，
     用來讓前端快速拿到「目前最新一次抓取結果」
   - 絕對不要用同一個檔名覆蓋歷史快照
5. 排程頻率建議：花季期間（2月中～5月中）每日一次；非花季期間可以停用或降到每週/每月，
   避免浪費 Actions 額度
6. 如果這支 workflow 之後會加通知（例如「你關注的城市開花了」），notification 一定要做
   去重（例如記錄已通知過的 city+year+event，避免重複發送）——**但這屬於加分項，MVP 階段
   可以先不做，明確跟我確認要不要做**
7. 如果之後要用 Cloudflare Worker 對外暴露這份資料，Worker 的寫入端點（PUT/POST）一定要
   加驗證（token 或簽章），不可以是任何人都能打的 unauthenticated endpoint

**驗收標準（測試分支上完成後，再跟我回報，不要自己合併進主站）**：
- 手動觸發 `workflow_dispatch` 跑 2–3 次，確認：
  - 每次都新增一個帶日期戳的快照檔，舊檔案還在
  - `latest.json` 內容有正確更新
  - 資料格式（欄位、城市名稱、日期格式）跟現有的 `sakura_data.json` 是相容的，
    或至少可以透過一個轉換函式對應

---

## Phase 2 — 合併邏輯：即時資料併入歷史 CSV 結構

**目標**：讓地圖能自動用「歷史 CSV（2010–2026）+ 當年即時抓取資料」組成完整資料集，
不需要每年手動維護 CSV。

**做法**：

1. 寫一支合併腳本（Node.js，跟 Astro 生態系一致即可），輸入：
   - 既有歷史 `sakura_data.json`（46 城市 × 2010–2026）
   - Phase 1 抓到的 `latest.json`（當年即時資料）
2. **關鍵風險點，Claude Code 動工前要先處理**：jptour.pages.dev 上的地名寫法（可能是
   平假名、羅馬拼音、或跟 CSV 用的都道府県代表城市漢字不完全一致）很可能跟現有 46 個
   城市的命名對不上。**第一步應該先建立一份「地點對照表」**（jptour 上的地名 ↔ CSV 裡的
   都道府県/城市），而不是直接假設欄位能對上
3. 合併規則：
   - 若該年度、該城市已有資料 → 用即時資料更新（upsert），保留 predicted/observed 狀態
   - 若沒有 → 新增一筆
   - 輸出成一份合併後的 `sakura-combined.json`，作為前端唯一的資料來源
     （不要再讓前端讀兩份檔案自己合併）
4. 這支合併腳本可以當作 Phase 1 workflow 的最後一步（抓完資料後自動跑合併），
   或是獨立一個 Action，由 Phase 1 完成後觸發

**驗收標準**：
- 用 2026 年的真實抓取結果跑一次合併，人工抽查 3–5 個城市，確認開花日/滿開日跟
  jptour.pages.dev 網站上顯示的一致
- 確認合併後歷史年份（2010–2025）的資料完全沒有被動到

---

## Phase 3 — 前端整合：搬進 Astro 網站

**目標**：把 `japan_sakura_map.html` 的地圖/圖表邏輯，變成日本旅遊網站裡的一個頁面元件。

**做法**：

1. 拆解現有 HTML 成 Astro 元件（例如 `src/components/SakuraMap.astro` 或搭配
   `src/pages/sakura.astro`）：
   - Leaflet + Chart.js 一樣走 CDN 或改成 npm 套件（依專案既有慣例，若其他頁面已經是
     npm-based 就統一用 npm，避免兩套載入方式並存）
   - 原本內嵌在 `<script>` 裡的 `SAKURA_DATA` 常數，改成在元件掛載時 fetch
     `sakura-combined.json`（從 Cloudflare Pages 靜態資源或 Worker API 拿），
     這樣花季期間資料更新不需要重新 build 整個網站
   - 保留現有的視覺設計：染井吉野櫻淡粉配色、Helvetica Neue 字體（fallback Noto Sans TC）、
     開花動態配色邏輯、年份/日期控制、播放動畫、側邊欄圖例與趨勢圖
2. 確認資料 fetch 失敗時（例如當年度還沒有即時資料，只有歷史 CSV）要有合理的
   fallback 畫面，不要整頁掛掉

**驗收標準**：
- 本地 `astro dev` 跑起來，頁面行為跟現有 HTML prototype 一致
- 手動把 `sakura-combined.json` 換成測試用的假資料，確認元件會照著新資料重新渲染

---

## 給 Claude Code 的建議溝通方式

因為這個任務會動到兩個 repo（jptour.pages.dev 的抓取分支、以及日本旅遊網站的 Astro 專案），
建議這樣跟 Claude Code 互動：

1. 先貼這份文件，請它 **只讀不動手**，回報它理解的 repo 現況、資料格式、以及它打算怎麼做
   地點對照表 — 確認沒問題後才進 Phase 1 實作
2. Phase 1 做完、驗收過，再進 Phase 2
3. Phase 2 做完、驗收過，再進 Phase 3
4. 全程在 feature branch 上進行，不要直接 push 到會影響正式站的 branch

