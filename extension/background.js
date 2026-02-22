// 保持 background 简洁，仅处理快捷键触发。
chrome.commands?.onCommand.addListener((command) => {
  if (command === 'extract-markdown') {
    chrome.action.openPopup();
  }
});
