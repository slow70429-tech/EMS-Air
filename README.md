# EMS-Air 核心架構版

此版本以現有 Google Apps Script API 為基礎，首頁優先顯示：

- 空品車維修狀態
- 小孔配對
- 高量採集器狀態
- 風速計狀態
- 流量計狀態

已移除「外借」狀態。大氣壓力計、溫度計暫不放主要畫面。

## 更新方式

1. 解壓縮本 ZIP。
2. 將 `index.html`、`css`、`js`、`README.md` 複製到電腦的 `EMS-Air` 資料夾。
3. 選擇取代目的地中的檔案。
4. 回到 GitHub Desktop。
5. Summary 輸入 `EMS-Air 核心架構更新`。
6. 按 `Commit to main`。
7. 再按 `Push origin`。

小孔配對歷史目前儲存在各瀏覽器的 localStorage。下一階段可再寫入 Google 試算表。
