# Google Sheet / Gmail 通知接線

## 本次完成與安全界線

- 訂閱、退訂及管理員刪除，會在同一個資料庫 transaction 內建立名單同步工作。
- 新訂閱會另外建立歡迎信工作，不再使用回應結束後可能遺失的 `after` 寄信。
- 後台可查看狀態、選擇全部／指定作品、測試信、建立主動通知及取消尚未處理的批次。
- 每次更新建立一個穩定 event ID，每位讀者每批一封；失敗重送 HTTP 請求沿用相同 ID。
- 每任意 24 小時最多 80 次寄信預留，歡迎、測試、更新與主動通知共用。Google 端也有 80 次限制，並檢查該帳號剩餘 MailApp 額度。不以台灣午夜重置規避 Google 的額度週期。
- 郵件一次只有一位收件人。送出前重新讀網站的有效訂閱狀態，已退訂、刪除或缺少退訂 token 者跳過。已在寄送中的請求無法收回。
- timeout、程序中斷或 provider 結果不明的信會保留為 `uncertain`，**不自動重寄**。這是避免重複寄信的保守策略，不宣稱郵件能 exactly-once 送達。
- Google Sheet 是私有鏡像，網站資料庫才是主要依據。試算表的手動編輯不回寫網站。
- 全部開關預設關閉，預設只允許管理者測試信。沒有任何正式授權、secret、實際寄信或新排程在本次準備階段啟用。

## 儲存設計

沿用既有 `SiteSetting` 表，以 `newsletter:v1:` 專用 key prefix 儲存 campaign、job 與 quota reservations；透過 PostgreSQL transaction advisory lock 序列化所有 worker 的領取與額度預留。無需 migration 或 `prisma db push`，也不觸碰既有其他 key。

Outbox 只保存訂閱者 ID 與通知快照，不保存讀者的退訂 token；寄送時才讀取最新 token 並組成郵件。名單同步不包含任何 token。Google 的 `_寄信紀錄` 工作表只記錄 job ID、狀態及時間，不保存收件人或郵件正文。隱藏工作表不是權限隔離，整份 Sheet 必須維持私有。

這是目前 300 人規模的過渡 outbox。歷史工作與額度紀錄不會自動刪除；日後應改為專用結構化表與保留期限。紀錄毀損時會停止處理，不會假裝沒有紀錄而重寄。預留後跳過、失敗或結果不明也保守計入 80 次，實寄可能少於 80。

## 章節公開事件

- 管理員新增公開小說章節，或把隱藏章節改為公開時，與章節寫入一起保存 publication 工作。
- 修改已公開章節的錯字不觸發新通知。對同一章重複公開也不重複建立首發通知。
- `NEWSLETTER_AUTO_UPDATES=false` 時只保存發布事件，不會轉成讀者通知。
- 整批匯入多章時，每次章節寫入都必須帶 `notifySubscribers:false`，避免一章產生一批。整批確定已公開後只呼叫一次：

```json
POST /api/newsletter/published-update
{
  "eventId": "novel-release-20261025-01",
  "novelId": "實際作品ID",
  "chapterIds": ["實際已公開章節ID"]
}
```

此 API 需要管理員 cookie，會核對每一章皆屬於作品且已公開，並把當次章節及目前公開進度合併成一封。只帶入 chapter ID，不讀或通知未公開章節。排程發布功能／新小說匯入器尚未於本次實作；其發布步驟應沿用這個批次事件介面。

## 下午需由使用者完成的設定

1. 確認目前 Google 帳號是 `maxupport@gmail.com`。訂閱名單 Sheet ID 為 `10MojPCfHzAyCuYeGEVB91pFFEm1ufFn8rhc5eafpebI`，不可改為公開。
2. 在此帳號的 Google Apps Script 建立專用專案，貼入同目錄的 `Code.gs` 和 `appsscript.json`。它只使用 Sheets、寄信、向網站發請求及建立 worker 觸發器的權限，不需要讀取 Gmail 收件匣。
3. 產生獨立的至少 32 字元隨機 `GOOGLE_NEWSLETTER_SECRET`，分別存進 Apps Script Script Properties 與 Vercel 的同名 secret。**不要提供 Gmail 密碼，也不要把 secret 貼入聊天或程式碼。** Google 同意畫面、寄信權限及新的憑證輸入必須交由使用者本人確認。
4. Apps Script Script Properties 初始值：
   - `GOOGLE_NEWSLETTER_SECRET`：獨立 secret
   - `SYNC_ENABLED=false`
   - `SENDING_ENABLED=false`
   - `TEST_ONLY=true`
5. 使用者核准權限後，把 Apps Script 部署為 Web App，以擁有者身分執行、允許網站伺服器呼叫。此步會公開一個服務入口，必須先確認應用程式內的 HMAC 已部署且驗證通過；沒有簽章者無法讀名單、同步或寄信。不要發布 Sheet 本身。取得 `/exec` URL，不用 `/dev`。
6. Vercel 設定參考 `config/newsletter.env.example`。填入 Web App URL 與 secret，保留寄信及自動更新開關關閉，重新部署。
7. 先只開名單同步：Google `SYNC_ENABLED=true`、網站 `NEWSLETTER_SHEETS_SYNC_ENABLED=true`。核對來源 Sheet、欄位、有效與退訂狀態；在後台明確按「排入完整名單同步」才同步既有名單。
8. 安裝並驗證 `runWebsiteQueue` 的每 15 分鐘觸發器：由使用者手動執行 `installWorkerTrigger`。此安裝函式本身不寄信。觸發時間以 Google 實際排程為準，不保證精確到秒。
9. 寄信測試：保留兩端 `TEST_ONLY=true`，Google `SENDING_ENABLED=true`，網站 `NEWSLETTER_ENABLED=true`。由後台建立一封測試信，**只送 maxupport@gmail.com**，核對版面、閱讀連結、實際寄件人及結果紀錄。測試信同樣消耗 80 次額度。再用明確同意的測試信箱驗收完整訂閱／退訂，不能以現有讀者做實寄測試。
10. 作者確認文稿、寄件設定與待寄批次後，才可把兩端 TEST_ONLY 改為 false；若要自動更新通知，再單獨開 `NEWSLETTER_AUTO_UPDATES=true`。本次準備不會開啟這些開關。

## 服務協定與故障處理

### 不寄信的初始連線驗證

管理員可使用後台「檢查初始連線（不寄信）」或 `GET /api/newsletter/verify`。
伺服器以部署環境的密鑰簽署兩個只有 `operation` 的不完整請求，沒有讀者、job ID、
正文或收件人。Google 既有程式在開關關閉時分別回覆 `paused` / `deferred`；
開關誤開時也因缺少必要參數而在任何名單寫入或 MailApp 寄信前被拒絕。
收到預期回覆即可確認簽章相符、Web App 可呼叫、擁有者與 Sheet 可存取，
以及 Google 兩個開關關閉。回應只含布林值，不提供密鑰、網址或訂閱資料。
此檢查不驗證 Google `TEST_ONLY`、欄位表頭、MailApp 額度、寄信權限或實際送達；
仍需後續由作者同意的同步與實寄驗收。失敗也不單獨代表密鑰錯誤，
可能是部署、Sheet 權限、開關狀態或暫時的 Google 問題。

網站呼叫 Google Web App 的 JSON envelope：`{timestamp,payload,signature}`。payload 是原始 JSON 字串；HMAC-SHA256 簽章內容為 `museum-newsletter-bridge-v1\n{timestamp}\n{payload}`。有效期 60 秒。只能使用 HTTPS `script.google.com/macros/s/.../exec`。

Google 觸發網站 worker：`POST /api/internal/newsletter-worker`，body 固定 `{}`，headers 為 `x-newsletter-time` 及 `x-newsletter-signature`；簽章內容為 `museum-newsletter-worker-v1\n{timestamp}\n{body}`，用途與前者分離。worker 不接受收件人、額度覆寫、啟用旗標或任意 URL。

名單同步會重試、以 revision 防止舊事件蓋掉新退訂狀態。信件若結果不明，先在後台查看通知 ID，再比對 Google `_寄信紀錄`，確認是否已被服務接受。不要刪掉 ledger、quota 或 job 來強行重寄，也不要自動把 uncertain 改回 pending。需要補寄時，先取得明確確認並建立新的受控通知。

暫停方式：網站 `NEWSLETTER_ENABLED=false`，必要時 Google `SENDING_ENABLED=false`；若要停止所有網路處理，停用 Google worker 觸發器。取消批次僅取消 pending 工作，不收回已處理中的信。

每兩天更新一次、300 人時，每批約需 4 天處理，後續批次會累積。80 的額度不會因此自動上調。首次啟用前應核對累積的歡迎信、發布事件與批次通知。
