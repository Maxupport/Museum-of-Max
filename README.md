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

管理員 session 有效期為 24 小時，管理員登入與既有的策展人通行碼登入皆適用。
`is_curator`、`visitor_permissions` 只供介面使用，管理員 API 一律驗證
`admin_token` 的簽章及到期時間。既有以備註標示為策展人的通行碼仍會授予
管理權限，因此這些通行碼必須視同管理員密碼保管。

寄信使用 `RESEND_API_KEY` / `EMAIL_FROM`；訂閱名單同步使用
`GOOGLE_SCRIPT_URL`；圖片上傳使用 `BLOB_READ_WRITE_TOKEN`。

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

目前這批修補涵蓋管理員 cookie 偽造、小說管理授權、隱藏文章的 API／SSR／metadata
外洩、訂閱回應中的退訂 token，以及 Next.js 16.3.8 安全修補。
速率限制、雙重訂閱確認、上傳檔案內容驗證，以及 Prisma 工具鏈的其餘安全更新
仍屬後續工作；部署前可用 `npm audit --omit=dev` 確認當下的依賴風險。
