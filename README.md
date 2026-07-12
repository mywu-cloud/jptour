# 季節前線 — 日本旅遊情報網站

以「**季節 × 地區 × 交通**」三軸為核心的日本自由行情報平台,服務台灣旅客。

不做內容農場式文章,而是用自動化資料管線做出即時季節情報工具 — 工具優先,內容其次。

---

## ✨ 核心功能

- 🍁 **紅葉/櫻花前線地圖** — 每日自動更新的見頃狀態地圖(青葉 → 色づき始め → 見頃 → 落葉)
- 🎫 **周遊券比較計算器** — 輸入行程,自動算出最省的 Pass 組合
- 💰 **旅費預算計算機** — 天數、住宿、機票試算,即時匯率換算
- 🗺️ **行程產生器**(Phase 2)— 選地區 + 天數 + 興趣標籤,自動組裝日程表

## 🧱 技術棧

| 分層 | 技術 |
|---|---|
| 前端 | [Astro](https://astro.build/)(靜態站 + islands) |
| 資料抓取 | GitHub Actions + Playwright(排程爬蟲) |
| 靜態託管 | Cloudflare Pages |
| Edge API | Cloudflare Workers |
| 資料儲存 | Repo 內 JSON(append-only,依日期分檔)|
| Analytics | Cloudflare Web Analytics |

## 📂 目錄結構

```
.
├── src/                      # Astro 頁面與元件
│   ├── pages/
│   │   ├── seasons/          # 季節前線線
│   │   ├── regions/          # 地區指南線
│   │   ├── transport/        # 交通工具線
│   │   ├── itineraries/      # 行程範例線
│   │   └── tools/            # 實用工具線
│   └── components/
├── scripts/                  # 爬蟲與資料處理腳本
│   └── koyo.py               # 紅葉/櫻花前線爬蟲
├── data/                     # 抓取結果(append-only JSON)
│   ├── koyo/                 # 依日期分檔,如 2026-07-09.json
│   └── passes.json           # 周遊券票價規則(人工維護)
├── workers/                  # Cloudflare Workers(Edge API)
├── .github/workflows/        # GitHub Actions 排程定義
└── CLAUDE.md                 # 專案架構規格(給 Claude Code 讀取)
```

## 🚀 開發

```bash
# 安裝依賴
npm install

# 本機開發伺服器
npm run dev

# 建置靜態站
npm run build

# 部署至 Cloudflare Pages
npm run deploy
```

爬蟲腳本本機測試:

```bash
cd scripts
pip install -r requirements.txt --break-system-packages
playwright install --with-deps chromium
python koyo.py
```

## 🗺️ 開發路線圖

- **Phase 1 · MVP**(2026.07–2026.09,約 8 週):Astro 骨架、紅葉前線地圖、周遊券比較器、預算計算機、北陸深度指南、SEO 基建
- **Phase 2 · 擴充**(2026.10–2027.01):櫻花前線模組、關西/關東地區指南、行程產生器 v1、見頃通知訂閱
- **Phase 3 · 營運**(2027.02 之後):聯盟收入、AI 行程生成、更多廣域路線

詳細架構規劃請見 [`CLAUDE.md`](./CLAUDE.md)。

## 📜 資料來源與合規原則

僅抓取事實性資料(日期、狀態、數值),不轉載文章與照片。照片使用自攝或 Unsplash/寫真AC 等授權圖庫。詳細資料來源清單請見 `CLAUDE.md` 第 5 節。

## 💰 營運成本

初期趨近零成本(Cloudflare 免費額度 + GitHub Actions 免費額度),僅網域約 NT$400/年。

---

*Season Frontier — 季節と地域を結ぶ旅の羅針盤*
