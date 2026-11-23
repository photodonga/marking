// 아이콘을 누르면 마킹 편집 화면을 새 탭으로 연다.
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
});
