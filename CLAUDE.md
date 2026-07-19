# 日本旅遊情報網站 — 專案規格 (CLAUDE.md)

> 本文件依據「日本旅遊情報網站・架構藍圖 v1.0(2026.07.09)」整理,作為 Claude Code 執行本專案時的固定上下文。
> 每次啟動 Code session 時請先讀取本檔案。

---

## 1. 產品定位與差異化

日旅情報市場已有大型內容站(Matcha、樂吃購等),硬拚文章量沒有勝算。**差異化策略是「工具優先、內容其次」**——用自動化資料管線做出大站做不到的即時季節情報工具,讓內容圍繞工具生長。

| 項目 | 內容 |
|---|---|
| 目標受眾 | 台灣赴日自由行旅客 |
| 核心差異化 | 季節前線資料自動化 |
| 技術路線 | Astro 靜態站 + Edge API |
| 初期成本 | ≈ 0 元/月(免費額度內) |
| 驗證優勢 | 開發者本人就是目標用戶(正在規劃北陸紅葉行程),可用真實需求做第一輪產品驗證,北陸行程即為第一份範例內容 |

### 三軸核心

1. **季節軸**:紅葉前線、櫻花前線、雪景、花火大會 — 搜尋需求高度季節化,也是自動化資料最能發揮的戰場
2. **地區軸**:以「廣域周遊路線」而非單一城市組織內容 — 昇龍道、北陸拱型、瀨戶內、東北縱貫,對應台灣旅客多點進出習慣
3. **交通軸**:JR Pass 與各式周遊券比較是決策痛點 — 「輸入行程、輸出最省 Pass 組合」的計算器,天然具備分享與回訪價值

---

## 2. 資訊架構(Sitemap)

以「路線圖」呈現網站結構 — 五條主線、一個轉乘樞紐(首頁)。**標示 MVP 的節點為必建頁面**,其餘為後續擴充站點。

### 季節前線線 `/seasons`
- `/seasons/koyo` — 紅葉情報地圖 **[MVP]**
- `/seasons/sakura` — 櫻花開花前線
- `/seasons/hanabi` — 花火大會月曆
- `/seasons/snow` — 雪祭與滑雪季
- `/seasons` — 四季總覽

### 地區指南線 `/regions`
- `/regions/hokuriku` — 中部北陸・昇龍道 **[MVP]**
- `/regions/kansai` — 關西
- `/regions/kanto` — 關東
- `/regions/kyushu` — 九州
- `/regions/tohoku` — 東北
- `/regions/hokkaido` — 北海道
- `/regions/setouchi` — 四國・瀨戶內

### 交通工具線 `/transport`
- `/transport/pass-finder` — 周遊券比較器 **[MVP]**
- `/transport/jr-pass` — JR Pass 全指南
- `/transport/airports` — 機場進出攻略
- `/transport/ic-cards` — IC 卡與市內交通

### 行程範例線 `/itineraries`
- `/itineraries/hokuriku-autumn` — 北陸紅葉 14 日 **[MVP]**
- `/itineraries/builder` — 行程產生器 **[Phase 2]**
- `/itineraries` — 主題行程庫

### 實用工具線 `/tools`
- `/tools/budget` — 預算計算機 **[MVP]**
- `/tools/exchange` — 即時匯率
- `/tools/weather` — 天氣與穿搭
- `/tools/checklist` — 行前清單

### URL 與內容原則
- 全站採**語意化英文路徑**(利於 SEO 與分享),頁面內容為繁體中文
- 每個地區頁固定包含五個錨點段落:**交通進出 / 必訪景點 / 季節亮點 / 住宿區域 / 範例行程**,維持結構一致性

---

## 3. 核心功能模組

四個工具構成護城河,全部採**「靜態頁 + 客戶端取數」**模式 — 與既有 FinMind 儀表板驗證過的瀏覽器端 fetch 模式相同。

### 3.1 紅葉/櫻花前線地圖
- **資料**:GitHub Actions 每日爬取日本氣象協會(tenki.jp)與 Weathernews 前線頁,寫入 JSON
- **呈現**:Leaflet.js 日本地圖 + 見頃狀態色標(青葉 → 色づき始め → 見頃 → 落葉)
- **互動**:點擊名所顯示歷年見頃日期區間、交通方式、周邊行程連結
- **SEO 價值**:「2026 紅葉預測」是每年 9–11 月的搜尋高峰關鍵字

### 3.2 周遊券比較計算器
- **輸入**:進出機場、停留天數、勾選欲造訪城市
- **邏輯**:維護一份 Pass 規則 JSON(涵蓋範圍、票價、天數),計算單程票總價 vs 各 Pass 組合
- **輸出**:推薦 Pass 排行 + 省下金額(紅色標示節省、灰色標示不划算)
- **維護**:票價年更約 1–2 次,資料量可控

### 3.3 旅費預算計算機
- **參數**:天數、住宿等級、城市物價係數、機票區間
- **匯率**:客戶端呼叫免費匯率 API 即時換算台幣
- **延伸**:輸出可下載的預算 Excel(複用北陸行程工作簿的欄位設計)

### 3.4 行程產生器(Phase 2)
- **模式**:選地區 + 天數 + 興趣標籤 → 從行程資料庫組裝日程表
- **進階**:可串 Anthropic API 做 AI 行程生成(Claude in Claude 模式),成為付費功能候選
- **輸出**:時間軸視圖 + 地圖路線 + 一鍵匯出 HTML/PDF

---

## 4. 技術架構

完全沿用航班追蹤系統(flights-276)驗證過的架構模式,但**修正該專案已知的三個缺陷**:歷史資料覆寫、通知去重、未驗證端點。

### 架構分層

```
[Data Pipeline]                    [Data Store]
GitHub Actions(排程)              →  Repo 內 JSON(append-only)
Playwright 爬取紅葉/櫻花前線         依日期分檔:koyo/2026-07-09.json
每日 06:00 JST 執行                杜絕覆寫問題,天然保留歷史
失敗自動 retry + Issue 告警         大檔改用 Cloudflare KV/R2
         │
         ▼ git commit 觸發自動部署 ▼
         │
[Static Site]                      [Edge API]
Astro + Cloudflare Pages           Cloudflare Workers
內容頁純靜態(零 JS 負擔)            匯率代理、表單、訂閱通知
工具頁掛 island 元件                所有端點加 API_KEY 驗證
繁中內容、語意化 URL                通知含 dedup key(修正舊缺陷)
         │
         ▼ 客戶端瀏覽器 ▼
         │
[Client Fetch]                     [Analytics]
瀏覽器端取數                        Cloudflare Web Analytics
匯率、天氣 API 由前端直呼            免費、無 cookie、GDPR 友善
(同 FinMind 儀表板模式)             觀察工具使用率決定開發優先序
```

### 為何選 Astro 而非 Next.js
情報站九成頁面是內容頁,Astro 預設零 JS、建置快、Markdown/MDX 內容管理原生支援,工具頁再局部水合(islands)即可;Next.js 的全框架成本在此場景是浪費。

### 已修正的三個已知缺陷(來自 flights-276 技術審查)
1. **歷史資料覆寫** → 改為 append-only、依日期分檔的 JSON,結構上杜絕覆寫
2. **通知缺乏去重** → 所有通知含 dedup key
3. **端點未驗證** → 所有 Worker 端點加 `API_KEY` 驗證

---

## 5. 資料來源清單

| 資料類型 | 來源 | 取得方式 | 更新頻率 | 風險備註 |
|---|---|---|---|---|
| 紅葉/櫻花前線 | tenki.jp、Weathernews、氣象廳 | Playwright 爬取(`scraper/koyo.py`) | 每日 | 頁面改版風險,需 selector 監控告警 |
| 天氣預報 | Open-Meteo API | 客戶端 fetch,免金鑰 | 即時 | 低;免費額度充足 |
| 匯率 JPY/TWD | ExchangeRate-API 或台銀牌告 | Worker 代理 + 快取 1hr | 每小時 | 低 |
| 周遊券票價規則 | JR 各社官網 | 人工維護 JSON(`data/passes.json`) | 年 1–2 次 | 改價需人工跟進,設年度 review 提醒 |
| 景點與住宿座標 | Google Places API | 建站時批次查詢後靜態化 | 建置期 | 注意快取條款,僅存 place_id + 座標 |
| 花火/祭典日程 | Walker+、各主辦官網 | 半自動:爬取 + 人工校對 | 每季 | 日期異動頻繁,頁面標示「以官方為準」 |

**合規原則**:只抓取事實性資料(日期、狀態、數值),不轉載文章與照片;照片使用自攝(北陸行是素材採集機會)或 Unsplash/寫真AC 授權圖庫。

---

## 6. 內容策略與 SEO

- **工具頁攻長尾**:「北陸拱型 Pass 划算嗎」「名古屋進小松出交通」這類決策型長尾字競爭低、意圖強,由比較器頁的程式化子頁面(每組 Pass 一頁)承接
- **季節頁攻時效**:紅葉/櫻花預測頁每年更新年份 URL 參數但保留舊頁權重(301 至最新年),累積網域在季節字的權威度
- **行程頁攻分享**:範例行程做成可互動的地圖時間軸頁,在 PTT 日旅板、Threads、FB 社團具天然擴散性

**初期節奏**:不追求量。MVP 上線時 8–10 頁高品質頁面即可(1 個地區深度指南 + 3 個工具 + 1 條範例行程 + 基礎頁),每頁做好結構化資料(FAQ、HowTo schema)比多寫十篇淺文有效。

---

## 7. 開發路線圖

### Phase 1 · MVP — 秋季上線衝刺(2026.07–2026.09,約 8 週)
- **W1–2**:Astro 骨架 + 設計系統 + Cloudflare Pages 部署
- **W3–4**:紅葉前線爬蟲管線 + 地圖頁
- **W5–6**:周遊券比較器 + 預算計算機
- **W7**:北陸深度指南 + 14 日範例行程頁
- **W8**:SEO 基建(sitemap、schema、GSC)上線

### Phase 2 · 擴充 — 內容與工具深化(2026.10–2027.01)
- 11 月北陸實地採集素材,回填第一手內容
- 櫻花前線模組(複用紅葉管線,趕 2027 櫻花季)
- 關西、關東地區指南上線
- 行程產生器 v1(規則式組裝)
- Email 訂閱:見頃通知(含去重機制)

### Phase 3 · 營運 — 變現與自動化(2027.02 之後,視流量啟動)
- 聯盟收入:Klook/KKday 票券、訂房連結
- AI 行程生成(Anthropic API)作為進階功能
- 更多廣域路線(東北、九州、瀨戶內)
- 視數據評估:會員收藏行程、多語版本

---

## 8. 網域與營運成本

### 網域命名方向
- **季節意象系**:koyomi(曆)、shiki(四季)、zensen(前線)+ travel/tabi 組合
- **路線意象系**:與「路線圖」品牌概念呼應 — rosen、norikae、tabimap 系列
- **建議 TLD**:.com 優先,.tw 做品牌保護;.travel 過貴不建議
- 可用 `domain-name-brainstormer` skill 跑一輪可用性查核後再定案

### 每月營運成本估算
- Cloudflare Pages/Workers/KV:免費額度內(NT$0)
- GitHub Actions:公開 repo 免費,私有 repo 2,000 分鐘/月足夠
- 網域:約 NT$400/年
- Google Places API:建置期一次性,控制在免費額度 US$200/月內
- **合計**:初期趨近零成本,與航班追蹤系統同級

---

## 9. 工作慣例

- 深色主題為預設美學風格(與其他儀表板專案一致)
- 交付前確保是 production-ready,而非草稿
