# Vim-Overleaf

ブラウザ上の任意のテキスト入力欄と、ローカルファイルを双方向同期するブラウザ拡張機能とNodeサーバーのシステム。
VSCode / Vim 等のエディタで、Web上のtextareaを直接編集できます。

## 概要

Webブラウザ上の`<textarea>`や`<input type="text">`と、ローカルOS上のテキストファイルをリアルタイムで双方向同期します。
これにより、使い慣れたエディタでWebフォームの入力が可能になります。

### 主な用途

- Overleaf等のWebエディタをVim/VSCodeで編集
- Webフォームの長文入力をローカルエディタで作業
- ブラウザ上のMarkdownエディタとローカル環境の連携

## システム構成

```
Browser         Extension            Node Server             OS File
-----------     ----------------     ----------------        --------------
DOM <textarea> ↔ content.js  →→→→→→ WebSocket →→→→→→→→→→ file.txt
                           ←←←←← WebSocket ← fs.watch  ←
```

### 動作フロー

1. ユーザーが拡張機能で「選択モード」を起動
2. ブラウザ内の任意のtextareaをクリックして選択
3. textarea内のテキスト変更が即座にNodeサーバー経由でローカルファイルに保存
4. ローカルファイルの変更がブラウザのtextareaにリアルタイム反映

## プロジェクト構成

```
vim-overleaf/
├── README.md                    # このファイル
├── extension/                   # ブラウザ拡張機能
│   ├── manifest.json           # Chrome拡張マニフェスト
│   ├── background.js           # WebSocket接続管理
│   ├── content.js              # DOM操作・イベントフック
│   └── popup.html              # 拡張ポップアップUI
└── server/                      # Nodeサーバー
    ├── package.json
    ├── config.json             # 同期ファイルパス設定
    └── server.js               # WebSocketサーバー + ファイル監視
```

## 機能仕様

### 1. テキストエリア選択機能

- **操作方法**:
  - 拡張ポップアップの「選択開始」ボタン
  - キーボードショートカット（例: `Ctrl+Shift+E`）
- **視覚的フィードバック**: 選択中のtextareaに`outline`を表示
- **セキュリティ**: 未選択状態では一切通信を行わない

### 2. テキスト変更の検知と送信

- `input`イベントをフックして変更を検知
- 変更発生時に全文をWebSocket経由で送信（差分計算なし）
- 送信は選択された要素のみに限定

### 3. ローカルファイル内容の反映

- Nodeサーバーが`fs.watch()`でファイル変更を監視
- 変更検知時、ファイル全内容をWebSocketでプッシュ
- 拡張機能がtextareaの内容を更新

## 通信仕様

### WebSocketメッセージ形式（JSON）

#### Browser → Node: テキスト更新

```json
{
  "type": "update",
  "value": "<current text>"
}
```

#### Node → Browser: ファイル同期

```json
{
  "type": "sync",
  "value": "<file text>"
}
```

### 接続

- 拡張機能起動時に`background.js`でWebSocket接続を確立
- デフォルトポート: `ws://localhost:8080`（設定可能）

## セットアップ

### 1. Nodeサーバーのセットアップ

```bash
cd server
npm install
```

### 2. 設定ファイルの作成

`server/config.json`を作成:

```json
{
  "filePath": "/path/to/your/sync-file.txt",
  "port": 8080
}
```

### 3. サーバー起動

```bash
npm start
```

### 4. ブラウザ拡張機能のインストール

1. Chromeで `chrome://extensions/` を開く
2. 「デベロッパーモード」を有効化
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `extension/` ディレクトリを選択

## 使用方法

### 基本的な使い方

1. Nodeサーバーを起動
2. ブラウザで編集したいページを開く
3. 拡張アイコンをクリックまたは `Ctrl+Shift+E` を押下
4. 同期したいtextareaをクリック
5. ローカルエディタでファイルを編集すると、ブラウザに即座に反映

### 同期の解除

- 拡張ポップアップの「選択解除」ボタン
- 別のtextareaを選択（自動的に前の同期が解除される）
- ページ遷移時に自動解除

## エッジケース対応

| ケース | 動作 |
|--------|------|
| textarea消滅（ページ遷移等） | 自動的に同期解除 |
| WebSocket接続エラー | 再接続を試行（簡易実装） |
| 未選択時の通信 | 一切の通信を行わない（セキュリティ保証） |

## セキュリティ方針

- **最小権限の原則**: 選択された要素以外のデータは絶対に送信しない
- **ローカルのみ**: WebSocketはlocalhostのみ接続（外部サーバーへの送信なし）
- **明示的な選択**: ユーザーが明示的に選択した要素のみを対象とする

## MVPスコープ

### 対象とする要素

- `<textarea>`
- `<input type="text">`
- （オプション）`contenteditable`属性を持つ要素

### 実装しない機能（将来的な拡張候補）

- [ ] ファイルパス選択UI
- [ ] 複数textareaの同時管理
- [ ] 差分マージ・カーソル位置保持
- [ ] 認証フォーム等の特殊入力欄対応
- [ ] ドメインホワイトリスト機能
- [ ] 複数DOMの自動検知・一括列挙

## 技術スタック

- **ブラウザ拡張**: Chrome Extension Manifest V3
- **通信**: WebSocket（ws）
- **ファイル監視**: Node.js `fs.watch()`
- **対象ブラウザ**: Google Chrome / Chromium系

## トラブルシューティング

### 拡張機能が接続できない

1. Nodeサーバーが起動しているか確認
2. `config.json`のポート番号が正しいか確認
3. ブラウザコンソールでエラーメッセージを確認

### ファイル変更が反映されない

1. `config.json`の`filePath`が正しいか確認
2. ファイルの書き込み権限を確認
3. サーバーログでエラーを確認

### textareaが選択できない

1. 対象要素が`<textarea>`または`<input type="text">`か確認
2. 選択モードが有効になっているか確認（拡張アイコンの状態）

## ライセンス

MIT

## 開発ロードマップ

- [x] MVP仕様策定
- [ ] 拡張機能実装（manifest, content, background, popup）
- [ ] Nodeサーバー実装（WebSocket + ファイル監視）
- [ ] 基本動作テスト
- [ ] エラーハンドリング強化
- [ ] パフォーマンス最適化
- [ ] 将来機能の検討・実装
