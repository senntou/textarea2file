const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// 設定ファイルの読み込み
const configPath = path.join(__dirname, 'config.json');

if (!fs.existsSync(configPath)) {
  console.error('エラー: config.jsonが見つかりません');
  console.error('config.example.jsonを参考に作成してください');
  console.error('例: cp config.example.json config.json');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const { filePath, port = 8080 } = config;

if (!filePath) {
  console.error('エラー: config.jsonにfilePathが指定されていません');
  process.exit(1);
}

// 同期ファイルのパス（絶対パス化）
const syncFilePath = path.resolve(filePath);

// ファイルが存在しない場合は作成
if (!fs.existsSync(syncFilePath)) {
  console.log(`同期ファイルを作成: ${syncFilePath}`);
  fs.writeFileSync(syncFilePath, '', 'utf8');
}

// WebSocketサーバーの起動
const wss = new WebSocket.Server({ port });

console.log(`WebSocketサーバー起動: ws://localhost:${port}`);
console.log(`同期ファイル: ${syncFilePath}`);

let fileWatcher = null;
let activeClient = null;
let isUpdatingFromBrowser = false;

// ファイル監視の開始
function startFileWatcher() {
  if (fileWatcher) {
    fileWatcher.close();
  }

  fileWatcher = fs.watch(syncFilePath, (eventType) => {
    if (eventType === 'change') {
      // ブラウザからの更新が原因の場合はスキップ（無限ループ防止）
      if (isUpdatingFromBrowser) {
        isUpdatingFromBrowser = false;
        return;
      }

      console.log('[Server] ファイル変更検知');

      // ファイル内容を読み込み
      fs.readFile(syncFilePath, 'utf8', (err, data) => {
        if (err) {
          console.error('[Server] ファイル読み込みエラー:', err);
          return;
        }

        // アクティブなクライアントに送信
        if (activeClient && activeClient.readyState === WebSocket.OPEN) {
          const message = {
            type: 'sync',
            value: data
          };

          activeClient.send(JSON.stringify(message));
          console.log('[Server] クライアントへ同期:', data.substring(0, 50) + '...');
        }
      });
    }
  });

  console.log('[Server] ファイル監視開始');
}

// WebSocket接続処理
wss.on('connection', (ws) => {
  console.log('[Server] クライアント接続');

  // 既存の接続がある場合は警告
  if (activeClient) {
    console.warn('[Server] 既にアクティブな接続が存在します（上書き）');
  }

  activeClient = ws;

  // ファイル監視を開始（初回または再接続時）
  if (!fileWatcher) {
    startFileWatcher();
  }

  // クライアントからのメッセージ受信
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('[Server] メッセージ受信:', data.type);

      if (data.type === 'update') {
        // ブラウザからのテキスト更新をファイルに書き込み
        isUpdatingFromBrowser = true;

        fs.writeFile(syncFilePath, data.value, 'utf8', (err) => {
          if (err) {
            console.error('[Server] ファイル書き込みエラー:', err);
            isUpdatingFromBrowser = false;
            return;
          }

          console.log('[Server] ファイル更新完了:', data.value.substring(0, 50) + '...');
        });
      }
    } catch (error) {
      console.error('[Server] メッセージ解析エラー:', error);
    }
  });

  // クライアント切断
  ws.on('close', () => {
    console.log('[Server] クライアント切断');

    if (activeClient === ws) {
      activeClient = null;
    }
  });

  // エラー処理
  ws.on('error', (error) => {
    console.error('[Server] WebSocketエラー:', error);
  });
});

// サーバー終了時の処理
process.on('SIGINT', () => {
  console.log('\n[Server] サーバー終了中...');

  if (fileWatcher) {
    fileWatcher.close();
  }

  wss.close(() => {
    console.log('[Server] WebSocketサーバー停止');
    process.exit(0);
  });
});

console.log('[Server] 準備完了 - 拡張機能からの接続を待機中...');
