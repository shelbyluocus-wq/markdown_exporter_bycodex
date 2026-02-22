# Markdown Exporter by Codex

一个基于 Chrome Manifest V3 的网页文章提取扩展，支持将正文一键导出为 Markdown 或文字型 PDF。

## 功能特性

- 一键提取网页正文，减少导航栏、评论区等噪音
- 导出为干净的 Markdown（可复制或下载 `.md` 文件）
- 导出为可搜索的文字型 PDF（通过浏览器打印能力）
- 支持中文网站场景（如知乎、掘金、微信公众号等）
- 所有处理在本地完成，不上传文章内容到外部服务器

## 技术栈

- Manifest V3
- [Mozilla Readability.js](https://github.com/mozilla/readability)
- [Turndown.js](https://github.com/mixmark-io/turndown)
- `window.print()` + 打印样式导出 PDF（非截图型 PDF）

## 项目结构

```text
markdown_exporter_bycodex/
├─ extension/
│  ├─ manifest.json
│  ├─ popup.html
│  ├─ popup.css
│  ├─ popup.js
│  ├─ content_script.js
│  ├─ background.js
│  ├─ print.css
│  ├─ icons/
│  │  └─ icon48.png
│  └─ lib/
│     ├─ Readability.js
│     └─ Turndown.js
└─ README.md
```

## 安装方式（开发者模式）

1. 打开 Chrome，进入 `chrome://extensions`。
2. 右上角开启“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择目录：`markdown_exporter_bycodex/extension`。
5. 安装成功后，固定扩展图标到工具栏便于使用。

## 使用说明

打开任意文章页后点击扩展图标，在弹窗中使用以下按钮：

- `📋 复制 Markdown`：提取并复制 Markdown 到剪贴板
- `⬇ 下载 .md 文件`：提取并下载为本地 Markdown 文件
- `🖨 导出 PDF`：打开系统打印窗口，选择“另存为 PDF”
- `👁 预览正文`：在新标签页展示提取后的干净正文

弹窗顶部会显示当前页面标题，中间显示摘要，底部状态栏会给出成功/失败提示。

## 快捷键

默认提供命令：`extract-markdown`

- Windows/Linux：`Ctrl+Shift+M`
- macOS：`Command+Shift+M`

可在 `chrome://extensions/shortcuts` 自定义。

## 兼容与已知限制

- SPA 页面：已通过 `document_idle` + fallback 选择器增强兼容。
- 微信公众号正文：已包含 `.rich_media_content` 选择器兜底。
- 懒加载图片：会尝试读取 `data-src`、`data-original`、`srcset`。
- CSP 严格页面：部分站点可能阻止 content script，这是浏览器安全限制，无法绕过。
- PDF 导出会弹出系统打印框：属于预期行为。

## 文件命名规则

下载 Markdown 时会对标题进行清洗：

- 替换非法文件名字符 `\\ / : * ? " < > |` 为 `_`
- 空白替换为 `_`
- 截断到 80 字符后追加 `.md`

## 隐私说明

- 不采集、不上传网页内容
- 不调用外部 API
- 提取与转换均在本地浏览器环境执行

## 开发说明

本项目使用原生 ES6+，无构建工具依赖。

如需二次开发，主要关注：

- `extension/content_script.js`：正文提取、Markdown/PDF 逻辑
- `extension/popup.js`：弹窗交互和消息通信
- `extension/manifest.json`：权限与注入配置
