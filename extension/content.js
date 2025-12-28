// Content Script - DOM操作とイベントフック
let selectionMode = false;
let selectedElement = null;
let inputHandler = null;

const HIGHLIGHT_STYLE = '3px solid #007bff';
const ORIGINAL_OUTLINE = new WeakMap();

// 選択モードの設定
function setSelectionMode(enabled) {
  selectionMode = enabled;

  if (enabled) {
    console.log('[Content] 選択モード有効化');
    document.body.style.cursor = 'crosshair';

    // クリックイベントを監視
    document.addEventListener('click', handleElementClick, true);
  } else {
    console.log('[Content] 選択モード無効化');
    document.body.style.cursor = '';
    document.removeEventListener('click', handleElementClick, true);

    // 選択を解除
    if (selectedElement) {
      unselectElement();
    }
  }
}

// 要素クリックハンドラ
function handleElementClick(event) {
  if (!selectionMode) return;

  const target = event.target;

  // textarea または input[type="text"] のみを対象
  if (
    target.tagName === 'TEXTAREA' ||
    (target.tagName === 'INPUT' && target.type === 'text')
  ) {
    event.preventDefault();
    event.stopPropagation();

    // 既に選択中の要素があれば解除
    if (selectedElement) {
      unselectElement();
    }

    // 新しい要素を選択
    selectElement(target);

    // 選択モードを自動終了
    setSelectionMode(false);
  }
}

// 要素を選択
function selectElement(element) {
  selectedElement = element;

  // 元のoutlineを保存
  ORIGINAL_OUTLINE.set(element, element.style.outline);

  // ハイライト表示
  element.style.outline = HIGHLIGHT_STYLE;

  console.log('[Content] 要素選択:', element.tagName, element.id || element.name);

  // backgroundに通知
  chrome.runtime.sendMessage({
    type: 'elementSelected',
    elementInfo: `${element.tagName}${element.id ? '#' + element.id : ''}${element.name ? '[name="' + element.name + '"]' : ''}`
  });

  // 初期値を送信
  sendTextUpdate(element.value || '');

  // inputイベントリスナーを設定
  inputHandler = () => {
    sendTextUpdate(element.value);
  };

  element.addEventListener('input', inputHandler);

  // ページ遷移時の自動解除
  window.addEventListener('beforeunload', unselectElement);
}

// 要素の選択を解除
function unselectElement() {
  if (!selectedElement) return;

  console.log('[Content] 要素選択解除');

  // ハイライトを削除
  const originalOutline = ORIGINAL_OUTLINE.get(selectedElement);
  selectedElement.style.outline = originalOutline || '';

  // イベントリスナーを削除
  if (inputHandler) {
    selectedElement.removeEventListener('input', inputHandler);
    inputHandler = null;
  }

  selectedElement = null;
}

// テキスト更新をbackgroundへ送信
function sendTextUpdate(text) {
  chrome.runtime.sendMessage({
    type: 'textUpdate',
    value: text
  });
}

// ファイルからの同期を反映
function syncFromFile(text) {
  if (!selectedElement) {
    console.warn('[Content] 選択中の要素がないため同期スキップ');
    return;
  }

  // 無限ループ防止: 現在の値と同じなら更新しない
  if (selectedElement.value === text) {
    return;
  }

  console.log('[Content] ファイルから同期:', text.substring(0, 50) + '...');

  // カーソル位置を保存
  const start = selectedElement.selectionStart;
  const end = selectedElement.selectionEnd;

  // 値を更新
  selectedElement.value = text;

  // カーソル位置を復元（可能な範囲で）
  const maxPos = text.length;
  selectedElement.setSelectionRange(
    Math.min(start, maxPos),
    Math.min(end, maxPos)
  );

  // inputイベントを発火させて、ページ側のJSに変更を通知
  const event = new Event('input', { bubbles: true });
  selectedElement.dispatchEvent(event);
}

// backgroundからのメッセージ受信
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Content] メッセージ受信:', message);

  switch (message.type) {
    case 'setSelectionMode':
      setSelectionMode(message.enabled);
      sendResponse({ success: true });
      break;

    case 'syncFromFile':
      syncFromFile(message.value);
      sendResponse({ success: true });
      break;

    default:
      console.warn('[Content] 未知のメッセージタイプ:', message.type);
  }

  return true;
});

console.log('[Content] Content Script読み込み完了');
