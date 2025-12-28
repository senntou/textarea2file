// ポップアップUI管理
const statusDiv = document.getElementById('status');
const toggleBtn = document.getElementById('toggleBtn');
const selectedInfo = document.getElementById('selectedInfo');
const selectedElement = document.getElementById('selectedElement');

// 状態を取得して表示を更新
async function updateUI() {
  const response = await chrome.runtime.sendMessage({ type: 'getStatus' });

  if (response.connected) {
    statusDiv.className = 'status connected';
    statusDiv.textContent = 'サーバー接続済み';
    toggleBtn.disabled = false;
  } else {
    statusDiv.className = 'status disconnected';
    statusDiv.textContent = 'サーバー未接続';
    toggleBtn.disabled = true;
  }

  if (response.selectionMode) {
    statusDiv.className = 'status active';
    statusDiv.textContent = '選択モード有効 - textareaをクリック';
    toggleBtn.textContent = '選択モードを終了';
    toggleBtn.className = 'danger';
  } else {
    toggleBtn.textContent = '選択モードを開始';
    toggleBtn.className = '';
  }

  if (response.selectedElement) {
    selectedInfo.style.display = 'block';
    selectedElement.textContent = response.selectedElement;
  } else {
    selectedInfo.style.display = 'none';
  }
}

// トグルボタンのクリック
toggleBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'toggleSelection' });
  updateUI();
});

// 初期化
updateUI();

// 定期的に状態を更新（WebSocket接続状態の変化を反映）
setInterval(updateUI, 1000);
