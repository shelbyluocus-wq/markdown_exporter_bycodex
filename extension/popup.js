function sanitizeFilename(title) {
  return (
    (title || 'article')
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 80) + '.md'
  );
}

function setStatus(text, type = 'normal') {
  const statusBar = document.getElementById('statusBar');
  statusBar.textContent = text;
  statusBar.className = 'status';
  if (type === 'ok') {
    statusBar.classList.add('ok');
  }
  if (type === 'err') {
    statusBar.classList.add('err');
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || !tabs.length) {
    throw new Error('未找到活动标签页');
  }
  return tabs[0];
}

async function sendToContent(action) {
  const tab = await getActiveTab();
  if (!tab.id) {
    throw new Error('标签页 ID 无效');
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action });
    if (!response || !response.success) {
      throw new Error(response?.error || '内容脚本返回失败');
    }
    return response;
  } catch (error) {
    throw new Error(
      '页面暂不支持提取（可能受 CSP 限制或页面尚未加载完成）：' +
        (error?.message || '未知错误')
    );
  }
}

function setBusy(isBusy) {
  const ids = ['copyBtn', 'downloadBtn', 'pdfBtn', 'previewBtn'];
  ids.forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.disabled = isBusy;
    }
  });
}

async function loadArticleSummary() {
  setBusy(true);
  setStatus('正在提取正文...');
  try {
    const data = await sendToContent('extract');
    const pageTitle = data.title || '未命名文章';
    const excerpt = data.excerpt || '未获取到摘要，可能是结构化较弱的页面。';

    const titleEl = document.getElementById('pageTitle');
    titleEl.textContent = pageTitle;
    titleEl.title = pageTitle;
    document.getElementById('excerpt').textContent = excerpt;

    window.__cachedArticle = data;
    setStatus('提取成功，可执行操作', 'ok');
  } catch (error) {
    setStatus(error.message, 'err');
  } finally {
    setBusy(false);
  }
}

async function handleCopyMarkdown() {
  setBusy(true);
  setStatus('正在复制 Markdown...');
  try {
    const data = await sendToContent('extract');
    await navigator.clipboard.writeText(data.markdown || '');
    setStatus('Markdown 已复制到剪贴板', 'ok');
  } catch (error) {
    setStatus(error.message, 'err');
  } finally {
    setBusy(false);
  }
}

async function handleDownloadMarkdown() {
  setBusy(true);
  setStatus('正在生成下载文件...');
  try {
    const data = await sendToContent('extract');
    const markdown = data.markdown || '';
    const title = data.title || 'article';
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    await chrome.downloads.download({
      url,
      filename: sanitizeFilename(title),
      saveAs: true
    });

    setTimeout(() => URL.revokeObjectURL(url), 3000);
    setStatus('Markdown 下载任务已创建', 'ok');
  } catch (error) {
    setStatus(error.message, 'err');
  } finally {
    setBusy(false);
  }
}

async function handleExportPDF() {
  setBusy(true);
  setStatus('正在打开打印对话框...');
  try {
    await sendToContent('exportPDF');
    setStatus('请在系统打印窗口中选择“另存为 PDF”', 'ok');
  } catch (error) {
    setStatus(error.message, 'err');
  } finally {
    setBusy(false);
  }
}

async function handlePreviewArticle() {
  setBusy(true);
  setStatus('正在生成预览页面...');
  try {
    const data = await sendToContent('preview');
    const html = data.html || '<h1>预览失败</h1>';
    const url = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
    await chrome.tabs.create({ url });
    setStatus('已在新标签页打开正文预览', 'ok');
  } catch (error) {
    setStatus(error.message, 'err');
  } finally {
    setBusy(false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('copyBtn').addEventListener('click', handleCopyMarkdown);
  document.getElementById('downloadBtn').addEventListener('click', handleDownloadMarkdown);
  document.getElementById('pdfBtn').addEventListener('click', handleExportPDF);
  document.getElementById('previewBtn').addEventListener('click', handlePreviewArticle);
  loadArticleSummary();
});
