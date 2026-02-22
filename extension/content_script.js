// 处理懒加载图片，尽量将真实地址写入 src，提升 Markdown/PDF 导出准确率
function normalizeLazyImages(root) {
  if (!root || !root.querySelectorAll) {
    return;
  }

  const lazyAttrs = [
    'data-src',
    'data-original',
    'data-actualsrc',
    'data-url',
    'data-lazy-src',
    'data-lazyload',
    'srcset'
  ];

  root.querySelectorAll('img').forEach((img) => {
    let currentSrc = img.getAttribute('src') || '';
    const isPlaceholder =
      !currentSrc ||
      currentSrc.startsWith('data:image/gif') ||
      currentSrc.includes('blank') ||
      currentSrc.includes('placeholder');

    if (!isPlaceholder) {
      return;
    }

    for (const attr of lazyAttrs) {
      const value = img.getAttribute(attr);
      if (!value) {
        continue;
      }

      if (attr === 'srcset') {
        const first = value.split(',')[0]?.trim().split(' ')[0];
        if (first) {
          currentSrc = first;
          break;
        }
      } else {
        currentSrc = value.trim();
        break;
      }
    }

    if (currentSrc) {
      img.setAttribute('src', currentSrc);
    }
  });
}

// 从当前页面提取正文，优先 Readability，失败时走选择器降级方案
function extractArticle() {
  const docClone = document.cloneNode(true);
  normalizeLazyImages(docClone);

  const reader = new Readability(docClone, {
    charThreshold: 20,
    keepClasses: false
  });

  const article = reader.parse();

  if (!article || !article.content) {
    const fallbackSelectors = [
      'article',
      '[role="main"]',
      '[class*="article-content"]',
      '[class*="post-content"]',
      '[class*="article-body"]',
      '[class*="content-body"]',
      '[class*="rich_media_content"]',
      '.notion-page-content',
      'main'
    ];

    for (const selector of fallbackSelectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText && el.innerText.trim().length > 200) {
        const clone = el.cloneNode(true);
        normalizeLazyImages(clone);
        return {
          title: document.title,
          content: clone.innerHTML,
          byline: '',
          siteName: location.hostname,
          excerpt: el.innerText.trim().slice(0, 100)
        };
      }
    }

    const bodyClone = document.body.cloneNode(true);
    normalizeLazyImages(bodyClone);

    return {
      title: document.title,
      content: bodyClone.innerHTML,
      byline: '',
      siteName: location.hostname,
      excerpt: ''
    };
  }

  return article;
}

// 将文章内容转换为 Markdown，同时补充元数据
function articleToMarkdown(article) {
  if (typeof TurndownService === 'undefined') {
    throw new Error('TurndownService 未加载，请检查 lib/Turndown.js');
  }

  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    hr: '---'
  });

  td.addRule('strikethrough', {
    filter: ['del', 's'],
    replacement: (content) => `~~${content}~~`
  });

  td.addRule('fencedCodeBlock', {
    filter: (node) => node.nodeName === 'PRE' && !!node.querySelector('code'),
    replacement: (_content, node) => {
      const code = node.querySelector('code');
      const langClass = code?.className || '';
      const lang =
        langClass.match(/language-(\w+)/)?.[1] ||
        langClass.match(/lang-(\w+)/)?.[1] ||
        '';
      const codeText = code?.textContent || node.textContent || '';
      return `\n\`\`\`${lang}\n${codeText.trim()}\n\`\`\`\n`;
    }
  });

  const baseUrl = location.href;
  td.addRule('absoluteImages', {
    filter: 'img',
    replacement: (_content, node) => {
      const candidates = [
        node.getAttribute('src') || '',
        node.getAttribute('data-src') || '',
        node.getAttribute('data-original') || ''
      ].filter(Boolean);

      let src = candidates[0] || '';
      const alt = node.getAttribute('alt') || '';

      if (src && !src.startsWith('http') && !src.startsWith('data:')) {
        try {
          src = new URL(src, baseUrl).href;
        } catch (_e) {
          // 忽略 URL 解析异常，保留原值
        }
      }

      return src ? `![${alt}](${src})` : '';
    }
  });

  const meta = [
    `# ${article.title || document.title}`,
    article.byline ? `> 作者：${article.byline}` : '',
    article.siteName ? `> 来源：${article.siteName}` : '',
    `> 原文：${location.href}`,
    `> 提取时间：${new Date().toLocaleString('zh-CN')}`,
    '',
    '---',
    ''
  ]
    .filter(Boolean)
    .join('\n');

  return meta + td.turndown(article.content || '');
}

// 导出文字型 PDF：构建打印 iframe 并调用浏览器打印能力
function exportToPDF(article) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;';
  document.body.appendChild(iframe);

  const printDoc = iframe.contentDocument || iframe.contentWindow.document;
  const source = article.siteName || location.hostname;

  printDoc.open();
  printDoc.write(`
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <title>${article.title || document.title}</title>
  <style>
    @page { margin: 2cm; size: A4; }
    * { box-sizing: border-box; }
    body {
      font-family: "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif;
      font-size: 14px;
      line-height: 1.8;
      color: #333;
      max-width: 100%;
      word-break: break-word;
    }
    h1 { font-size: 22px; margin-bottom: 8px; }
    h2 { font-size: 18px; }
    h3 { font-size: 16px; }
    img { max-width: 100%; height: auto; page-break-inside: avoid; }
    pre, code {
      font-family: "Courier New", monospace;
      background: #f5f5f5;
      border-radius: 4px;
      font-size: 12px;
    }
    pre { padding: 12px; overflow-wrap: break-word; white-space: pre-wrap; page-break-inside: avoid; }
    code { padding: 2px 4px; }
    blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 16px; color: #666; }
    a { color: #0066cc; text-decoration: underline; }
    table { border-collapse: collapse; width: 100%; page-break-inside: avoid; }
    td, th { border: 1px solid #ddd; padding: 6px 10px; }
    .article-meta {
      color: #888;
      font-size: 12px;
      margin-bottom: 20px;
      border-bottom: 1px solid #eee;
      padding-bottom: 12px;
    }
  </style>
</head>
<body>
  <div class="article-meta">
    <div>来源：${source} | 原文：${location.href}</div>
  </div>
  <h1>${article.title || document.title}</h1>
  ${article.content || ''}
</body>
</html>
  `);
  printDoc.close();

  iframe.contentWindow.onload = () => {
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 1000);
    }, 300);
  };
}

function buildPreviewHTML(article) {
  const title = article.title || document.title;
  const source = article.siteName || location.hostname;
  return `
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      font-family: "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif;
      color: #222;
      line-height: 1.8;
      background: #f6f7f9;
    }
    .wrap {
      max-width: 860px;
      margin: 24px auto;
      padding: 28px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.06);
    }
    .meta {
      font-size: 13px;
      color: #777;
      border-bottom: 1px solid #eee;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    h1 { margin: 0 0 16px; line-height: 1.35; }
    img { max-width: 100%; height: auto; }
    pre { overflow: auto; background: #f5f5f5; padding: 12px; border-radius: 8px; }
    code { font-family: "Consolas", "Courier New", monospace; }
  </style>
</head>
<body>
  <article class="wrap">
    <div class="meta">来源：${source} | 原文：${location.href}</div>
    <h1>${title}</h1>
    ${article.content || ''}
  </article>
</body>
</html>
  `;
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (!request || !request.action) {
    sendResponse({ success: false, error: '无效请求' });
    return false;
  }

  try {
    if (request.action === 'extract') {
      const article = extractArticle();
      const markdown = articleToMarkdown(article);
      sendResponse({
        success: true,
        markdown,
        title: article.title || document.title,
        excerpt: article.excerpt || ''
      });
      return true;
    }

    if (request.action === 'exportPDF') {
      const article = extractArticle();
      exportToPDF(article);
      sendResponse({ success: true });
      return true;
    }

    if (request.action === 'preview') {
      const article = extractArticle();
      const html = buildPreviewHTML(article);
      sendResponse({
        success: true,
        title: article.title || document.title,
        html
      });
      return true;
    }

    sendResponse({ success: false, error: '未知 action' });
    return true;
  } catch (error) {
    sendResponse({ success: false, error: error?.message || '处理失败' });
    return true;
  }
});
