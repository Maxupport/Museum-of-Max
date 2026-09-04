/**
 * ------------------------------------------------------------------
 * Google Apps Script (GAS) 全自動小說連載訂閱與每日定時發信系統
 * 專為 Maxupport 個人作品集網站打造
 * ------------------------------------------------------------------
 * 
 * 【安裝與設定步驟】：
 * 1. 打開您的 Google 試算表 (或 Google 表單綁定的試算表)。
 * 2. 點擊上方選單 [擴充功能] -> [Apps Script]。
 * 3. 將本檔案全部程式碼貼入 replace 原有內容並儲存。
 * 4. 點擊右上方 [部署] -> [新增部署] -> 選擇「網路應用程式 (Web App)」。
 *    - 執行身分：選擇「我 (Me)」
 *    - 誰可以存取：選擇「任何人 (Anyone)」
 * 5. 點擊「部署」，授權 GmailApp 存取後，複製獲得的「網路應用程式 URL」。
 * 6. 將網址貼入網站的 .env 環境變數 NEXT_PUBLIC_GOOGLE_SCRIPT_URL 即可！
 */

// ------------------------------------------------------------------
// 1. 處理網站前台 POST 提交 (新增訂閱者 Email 至 Google 試算表)
// ------------------------------------------------------------------
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var email = "";
    var novelTitle = "全站小說連載";
    
    if (e.parameter && e.parameter.email) {
      email = e.parameter.email.trim();
      if (e.parameter.novelTitle) novelTitle = e.parameter.novelTitle;
    } else if (e.postData && e.postData.contents) {
      var data = JSON.parse(e.postData.contents);
      email = data.email ? data.email.trim() : "";
      if (data.novelTitle) novelTitle = data.novelTitle;
    }

    if (!email || email.indexOf("@") === -1) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "無效的 Email 格式" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 檢查是否重複訂閱
    var dataRange = sheet.getDataRange().getValues();
    var isDuplicate = false;
    for (var i = 1; i < dataRange.length; i++) {
      if (dataRange[i][0] === email || dataRange[i][1] === email) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      sheet.appendRow([new Date(), email, novelTitle, "已訂閱"]);
      
      // 發送訂閱成功感謝信件
      sendWelcomeEmail(email, novelTitle);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true, message: "訂閱成功！已新增至名單" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ------------------------------------------------------------------
// 2. 當讀者填寫 Google 表單時自動觸發 (onFormSubmit)
// ------------------------------------------------------------------
function onFormSubmit(e) {
  try {
    var itemResponses = e.response.getItemResponses();
    var email = e.response.getRespondentEmail();
    
    // 若表單中有文字欄位包含 Email
    if (!email) {
      for (var i = 0; i < itemResponses.length; i++) {
        var resp = itemResponses[i].getResponse();
        if (resp && resp.toString().indexOf("@") !== -1) {
          email = resp.toString().trim();
          break;
        }
      }
    }

    if (email) {
      sendWelcomeEmail(email, "小說連載專屬更新");
    }
  } catch (err) {
    Logger.log("onFormSubmit Error: " + err.toString());
  }
}

// ------------------------------------------------------------------
// 3. 歡迎訂閱信 HTML 範本
// ------------------------------------------------------------------
function sendWelcomeEmail(toEmail, novelTitle) {
  var subject = "【Maxupport 創作 Lab】感謝訂閱《" + novelTitle + "》連載更新";
  var htmlBody = `
    <div style="max-width: 600px; margin: 0 auto; background: #0a0a0c; color: #e2e8f0; font-family: sans-serif; padding: 2rem; border-radius: 8px; border: 1px solid #334155;">
      <h2 style="color: #a855f7; font-family: serif; border-bottom: 1px solid #334155; padding-bottom: 0.8rem;">
        🏛️ 歡迎訂閱【Maxupport 創作 Lab】
      </h2>
      <p style="line-height: 1.6; font-size: 1rem; color: #cbd5e1;">
        親愛的讀者您好，
      </p>
      <p style="line-height: 1.6; font-size: 1rem; color: #cbd5e1;">
        感謝您訂閱《${novelTitle}》！當策展人發布新章節或創作手記時，系統將會於隔日固定時間為您寄送專屬導讀信件。
      </p>
      <div style="text-align: center; margin: 2rem 0;">
        <a href="https://your-domain.vercel.app/museum/creation_lab" style="background: #a855f7; color: #ffffff; padding: 0.8rem 1.8rem; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
          進入博物館閱讀連載
        </a>
      </div>
      <p style="font-size: 0.85rem; color: #94a3b8; border-top: 1px solid #334155; padding-top: 1rem; margin-top: 2rem;">
        Maxupport 策展團隊 敬上
      </p>
    </div>
  `;

  GmailApp.sendEmail(toEmail, subject, "", {
    htmlBody: htmlBody,
    name: "Maxupport 創作 Lab"
  });
}

// ------------------------------------------------------------------
// 4. 每日定時自動排程發送最新連載導讀 (每天早上固定時間執行)
// ------------------------------------------------------------------
/**
 * 請在 Apps Script 左側「觸發條件 (Triggers)」中設定：
 * - 選擇要執行的功能：sendDailyNovelDigest
 * - 選擇事件來源：時間驅動 (Time-driven)
 * - 選擇時間型觸發條件：日定時器 (Day timer)
 * - 選擇時間：例如「上午 8 點至 9 點」
 */
function sendDailyNovelDigest() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return; // 無訂閱名單

  var subject = "【Maxupport 創作 Lab】今日最新小說連載章節導讀";
  var htmlBody = `
    <div style="max-width: 600px; margin: 0 auto; background: #0a0a0c; color: #e2e8f0; font-family: sans-serif; padding: 2rem; border-radius: 8px; border: 1px solid #334155;">
      <span style="font-size: 0.8rem; color: #a855f7; text-transform: uppercase; letterSpacing: 1px;">DAILY NOVEL DIGEST</span>
      <h2 style="color: #ffffff; font-family: serif; margin-top: 0.5rem; border-bottom: 1px solid #334155; padding-bottom: 0.8rem;">
        《AI 小說共創實錄》最新章節已上線
      </h2>
      <p style="line-height: 1.6; font-size: 0.95rem; color: #cbd5e1;">
        在昨夜的思緒流轉中，最新章節內容已同步至沉浸式閱讀器。邀請您登入展場，享受專屬視覺與聲響圍繞的閱讀體驗。
      </p>
      <div style="text-align: center; margin: 2.5rem 0;">
        <a href="https://your-domain.vercel.app/museum/creation_lab" style="background: #a855f7; color: #ffffff; padding: 0.85rem 2rem; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block; box-shadow: 0 0 15px rgba(168,85,247,0.4);">
          📖 點擊前往線上展場閱讀
        </a>
      </div>
      <p style="font-size: 0.8rem; color: #64748b; text-align: center; border-top: 1px solid #334155; padding-top: 1rem;">
        如果您欲調整訂閱設定，可直接回覆本信件與策展團隊聯繫。
      </p>
    </div>
  `;

  // 遍歷所有已訂閱的 Email
  for (var i = 1; i < data.length; i++) {
    var email = data[i][1] || data[i][0];
    if (email && email.toString().indexOf("@") !== -1) {
      try {
        GmailApp.sendEmail(email.toString().trim(), subject, "", {
          htmlBody: htmlBody,
          name: "Maxupport 創作 Lab"
        });
        Logger.log("Digest Sent to: " + email);
      } catch (e) {
        Logger.log("Failed sending to " + email + ": " + e.toString());
      }
    }
  }
}

// ------------------------------------------------------------------
// 5. 【條件發信模式】自動查詢 Notion API，只有當 Notion 有「新發布章節」時才發信！
// ------------------------------------------------------------------
/**
 * 使用前說明：
 * 1. 請在 Notion 小說章節資料庫中，新增一個 Checkbox 欄位命名為 `Email Sent` (預設不勾選)。
 * 2. 填入下方 NOTION_API_KEY 與 NOTION_DATABASE_ID。
 * 3. 將 Apps Script 的每日觸發器設定執行本函數 `checkNotionUpdatesAndSendEmail`。
 */
var NOTION_API_KEY = "secret_YOUR_NOTION_INTEGRATION_TOKEN";
var NOTION_DATABASE_ID = "YOUR_NOTION_DATABASE_ID";

function checkNotionUpdatesAndSendEmail() {
  if (NOTION_API_KEY.indexOf("YOUR_") !== -1) {
    Logger.log("請先填入 Notion API Key 與 Database ID");
    return;
  }

  // 1. 查詢 Notion 中「Email Sent 為 false / 未勾選」的新章節
  var url = "https://api.notion.com/v1/databases/" + NOTION_DATABASE_ID + "/query";
  var payload = {
    filter: {
      property: "Email Sent",
      checkbox: {
        equals: false
      }
    }
  };

  var options = {
    method: "post",
    headers: {
      "Authorization": "Bearer " + NOTION_API_KEY,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var json = JSON.parse(response.getContentText());
    var results = json.results;

    if (!results || results.length === 0) {
      Logger.log("今日 Notion 無未發信的新章節，跳過發信。");
      return;
    }

    // 取最新一篇未發信的章節
    var newPage = results[0];
    var pageId = newPage.id;
    var chapterTitle = "最新連載章節";
    var excerpt = "專屬連載內容已更新，歡迎前往線上博物館閱讀。";

    if (newPage.properties && newPage.properties.Title && newPage.properties.Title.title && newPage.properties.Title.title[0]) {
      chapterTitle = newPage.properties.Title.title[0].plain_text;
    }
    if (newPage.properties && newPage.properties.Excerpt && newPage.properties.Excerpt.rich_text && newPage.properties.Excerpt.rich_text[0]) {
      excerpt = newPage.properties.Excerpt.rich_text[0].plain_text;
    }

    // 2. 發送廣播郵件給 Google 試算表中所有訂閱者
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();
    var subject = "【Maxupport 創作 Lab】小說新章節上線：《" + chapterTitle + "》";

    var htmlBody = `
      <div style="max-width: 600px; margin: 0 auto; background: #0a0a0c; color: #e2e8f0; font-family: sans-serif; padding: 2rem; border-radius: 8px; border: 1px solid #334155;">
        <span style="font-size: 0.8rem; color: #a855f7; text-transform: uppercase; letter-spacing: 1px;">NEW CHAPTER RELEASE</span>
        <h2 style="color: #ffffff; font-family: serif; margin-top: 0.5rem; border-bottom: 1px solid #334155; padding-bottom: 0.8rem;">
          ${chapterTitle}
        </h2>
        <p style="line-height: 1.6; font-size: 0.95rem; color: #cbd5e1;">
          ${excerpt}
        </p>
        <div style="text-align: center; margin: 2.5rem 0;">
          <a href="https://your-domain.vercel.app/museum/creation_lab" style="background: #a855f7; color: #ffffff; padding: 0.85rem 2rem; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block; box-shadow: 0 0 15px rgba(168,85,247,0.4);">
            📖 點擊前往線上展場閱讀完整內容
          </a>
        </div>
        <p style="font-size: 0.8rem; color: #64748b; text-align: center; border-top: 1px solid #334155; padding-top: 1rem;">
          Maxupport 策展團隊 敬上
        </p>
      </div>
    `;

    for (var i = 1; i < data.length; i++) {
      var email = data[i][1] || data[i][0];
      if (email && email.toString().indexOf("@") !== -1) {
        try {
          GmailApp.sendEmail(email.toString().trim(), subject, "", {
            htmlBody: htmlBody,
            name: "Maxupport 創作 Lab"
          });
        } catch (e) {
          Logger.log("Failed sending to " + email + ": " + e.toString());
        }
      }
    }

    // 3. 發信完成後，自動更新 Notion 中的 Email Sent 狀態為 true (已勾選)，防止重複寄信！
    var updateUrl = "https://api.notion.com/v1/pages/" + pageId;
    var updatePayload = {
      properties: {
        "Email Sent": {
          checkbox: true
        }
      }
    };
    var updateOptions = {
      method: "patch",
      headers: {
        "Authorization": "Bearer " + NOTION_API_KEY,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(updatePayload),
      muteHttpExceptions: true
    };
    UrlFetchApp.fetch(updateUrl, updateOptions);
    Logger.log("成功寄出新章節通知並更新 Notion 狀態為已發信！");

  } catch (err) {
    Logger.log("checkNotionUpdatesAndSendEmail Error: " + err.toString());
  }
}
