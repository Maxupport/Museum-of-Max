# Museum of Max

Next.js 16 / React 19 個人作品集與創作網站，使用 Prisma / PostgreSQL 儲存內容。

## 本機操作

```sh
npm ci
npm run dev
```

環境設定放在未追蹤的 `.env.local`。必要設定為 `DATABASE_URL`、
`ADMIN_USERNAME`、`ADMIN_PASSWORD`。程式不再提供預設管理員帳密，
先前曾提交到程式碼的預設密碼也會被拒絕，請設定新的強密碼。

建議另外設定至少 32 個隨機位元組產生的 `ADMIN_SESSION_SECRET`。
若未設定，session 會使用必要的管理員帳密衍生簽章金鑰，以相容既有環境。
更換帳密或此 secret 都會使舊 session 失效；請勿將設定值提交到 Git。
內部爬蟲紀錄也使用此 secret，透過不同用途的 HMAC 簽章驗證；未設定時不記錄爬蟲，
不會影響公開頁面。User-Agent 分類仍只是統計提示，不代表已驗證爬蟲的真實身分。

管理員 session 有效期為 24 小時，管理員登入與既有的策展人通行碼登入皆適用。
`is_curator`、`visitor_permissions` 只供介面使用，管理員 API 一律驗證
`admin_token` 的簽章及到期時間。既有以備註標示為策展人的通行碼仍會授予
管理權限，因此這些通行碼必須視同管理員密碼保管。

訂閱名單同步與通知採用 Google Apps Script / MailApp，寄件人為
`maxupport@gmail.com`。設定及授權流程見
[Google 通知接線](integrations/google-newsletter/README.md)，環境變數範本為
`config/newsletter.env.example`。同步、寄信及自動更新均預設關閉，測試模式預設開啟。
舊有 `RESEND_API_KEY` / `EMAIL_FROM` 寄信函式保留相容，但目前網站通知流程
不直接呼叫 Resend；舊 `GOOGLE_SCRIPT_URL` 不再使用。
圖片上傳使用 `BLOB_READ_WRITE_TOKEN`。
新上傳僅支援靜態 PNG / JPG / WebP、最大 4 MB 與 1600 萬像素，會解碼、移除
metadata 並重新編碼；不再接受 SVG、動畫或偽造圖片。既有圖片不會被修改或刪除。

重複訂閱會回覆相同訊息，但不覆寫讀者資料或重寄歡迎信；已退訂的信箱也不會被
匿名請求重新啟用。未來應透過雙重確認實作重新訂閱，而非直接修改 `active`。
新訂閱、退訂與管理員刪除會在同一交易建立持久化同步工作；歡迎信及更新通知
亦進入私人 `SiteSetting` outbox。網站與 Google 各自限制任意 24 小時最多
80 次寄信預留，所有通知共用；超額排隊，結果不明不自動重寄。
「成功」僅指服務接受請求，不代表最終送達。
管理後台提供狀態、取消待寄批次與不寄信的初始連線檢查。
訂閱成功後的 `after` 僅用於加速已持久化的佇列，不作為唯一寄信機制；
Google 定時觸發器是遺失請求背景工作的備援，後台顯示最近處理時間。
公開閱讀／全部作品訂閱入口為 `/novels`，不需要入館通行碼。
手動通告使用通告範本，章節更新使用含進度的連載範本；更新連結以穩定
`chapterId` 定位，寄出前再次檢查公開狀態及匿名閱讀頁。未就緒延後 30 分鐘，
該次保守額度預留仍計入上限。測試模式只處理管理者及其 Gmail 別名，
實寄一律導向 canonical 管理者信箱，不向其他讀者寄送。
小說排程仍只有 `config/novel-release-plan.json` 草案，尚未實作定時公開。

## 驗證

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build
```

測試以隔離的 Prisma 與寄信 mock 驗證 API 邊界、文章可見性、通行碼與訂閱流程，
不連正式資料庫或寄出信件。它們不取代正式資料庫整合或瀏覽器端的完整驗收。
`next/font/google` 在首次建置時需要連線下載既有字型。

若 Turbopack 在受限環境的失敗結果被快取，可先備份並移走
`.next/cache/turbopack/` 下對應 Next.js 版本的快取再重試；
官方替代建置方式為 `npm run build -- --webpack`。

## 部署與回退

1. 確認目標環境的管理員密碼已更換，並設定獨立的 `ADMIN_SESSION_SECRET`。
2. 在部署環境以正確的 `DATABASE_URL` 重新建置。隔離測試的建置產物不供直接上線，
   因為 sitemap 在建置時會讀取公開文章與小說資料。
3. 檢查首頁、通行碼入館、文章與小說閱讀、訂閱／退訂及管理後台。
4. 切換部署後，管理員需要重新登入；保留上一個部署供回退。

`npm run build` 現在僅建置網站，不會自動執行 `prisma db push`。
這次安全修補沒有變更 schema，也不需要任何資料庫 migration。
未來的 schema 變更應獨立建立與審核 migration，避免在建置期間修改正式資料庫。

目前修補涵蓋管理員 cookie 偽造、小說管理授權、隱藏文章的 API／SSR／metadata
外洩、訂閱回應中的退訂 token、圖片內容驗證、CSV 公式注入、信件 HTML 跳脫、
寄信失敗統計、內部紀錄簽章，以及 Next.js / Prisma 的安全更新。

後續優先順序：

1. 在部署層加分散式速率限制（登入、訂閱、公開統計端點）；本輪沒有假裝以單一 instance
   記憶體限制取代它，也沒有啟用任何付費服務。
2. 訂閱雙重確認與安全的重新訂閱流程；目前新信箱仍可被第三方填入。
3. Google 正式授權與實寄驗收、小說定時公開及閱讀就緒檢查；不自動重寄結果不明的信件。
4. 把公開小說 GET 中的舊式自動建檔移到管理員寫入流程；這需要另驗證既有小說相容性。

部署前可用 `npm audit --omit=dev` 與 `npm audit` 確認當下的依賴風險。
