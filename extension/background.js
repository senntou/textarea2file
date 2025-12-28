// グローバル状態管理
let ws = null;
let isConnected = false;
let selectionMode = false;
let selectedElement = null;
let reconnectTimer = null;

const WS_URL = 'ws://localhost:8080';
const RECONNECT_INTERVAL = 3000;

// WebSocket接続
function connectWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    return;
  }

  console.log('[Background] WebSocket接続試行:', WS_URL);
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log('[Background] WebSocket接続成功');
    isConnected = true;
    clearTimeout(reconnectTimer);
  };

  ws.onmessage = (event) => {
    console.log('[Background] メッセージ受信:', event.data);
    try {
      const message = JSON.parse(event.data);

      if (message.type === 'sync') {
        // ファイルからの同期メッセージをcontent scriptに転送
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'syncFromFile',
              value: message.value
            });
          }
        });
      }
    } catch (error) {
      console.error('[Background] メッセージ解析エラー:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('[Background] WebSocketエラー:', error);
  };

  ws.onclose = () => {
    console.log('[Background] WebSocket切断');
    isConnected = false;

    // 自動再接続
    reconnectTimer = setTimeout(() => {
      console.log('[Background] 再接続試行...');
      connectWebSocket();
    }, RECONNECT_INTERVAL);
  };
}

// WebSocketメッセージ送信
function sendToServer(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
    console.log('[Background] サーバーへ送信:', data);
  } else {
    console.warn('[Background] WebSocket未接続のため送信失敗');
  }
}

// メッセージハンドラ
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] メッセージ受信:', message);

  switch (message.type) {
    case 'getStatus':
      // ポップアップから状態取得要求
      sendResponse({
        connected: isConnected,
        selectionMode: selectionMode,
        selectedElement: selectedElement
      });
      break;

    case 'toggleSelection':
      // 選択モードのトグル
      selectionMode = !selectionMode;

      if (!selectionMode) {
        // 選択モード終了時は選択も解除
        selectedElement = null;
      }

      // content scriptに通知
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'setSelectionMode',
            enabled: selectionMode
          });
        }
      });

      sendResponse({ success: true });
      break;

    case 'elementSelected':
      // content scriptから要素が選択されたことを通知
      selectedElement = message.elementInfo;
      sendResponse({ success: true });
      break;

    case 'textUpdate':
      // content scriptからのテキスト更新をサーバーへ転送
      sendToServer({
        type: 'update',
        value: message.value
      });
      sendResponse({ success: true });
      break;

    default:
      console.warn('[Background] 未知のメッセージタイプ:', message.type);
  }

  return true; // 非同期レスポンスを有効化
});

// キーボードショートカット
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-selection') {
    console.log('[Background] ショートカット: 選択モード切り替え');
    selectionMode = !selectionMode;

    if (!selectionMode) {
      selectedElement = null;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'setSelectionMode',
          enabled: selectionMode
        });
      }
    });
  }
});

// 拡張機能起動時にWebSocket接続
console.log('[Background] Service Worker起動');
connectWebSocket();
