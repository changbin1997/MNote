const appContainer = document.querySelector('#app');
const editorContainer = document.querySelector('#editor');
const outlineContainer = document.querySelector('#outline');

let contentChange = false; // 内容是否被修改
let currentFileDir = ''; // 当前打开的 Markdown 文件所在目录
let sidebarVisible = false; // 侧边栏是否显示
let headingsCache = []; // 缓存解析到的大纲标题
let outlineTimer = null; // 大纲刷新防抖定时器

const { Editor } = toastui;
const { codeSyntaxHighlight } = Editor.plugin;

// 解析图片路径：本地图片会由预加载脚本读取成 data URL
function resolveImageSrc(src) {
  return window.electronAPI.resolveImageSrc(currentFileDir, src);
}

// 创建编辑器实例
const editor = new Editor({
  el: editorContainer,
  height: '100%',
  initialEditType: 'markdown',
  previewStyle: 'vertical',
  useCommandShortcut: false,
  language: 'zh-CN',
  plugins: [codeSyntaxHighlight],
  customHTMLRenderer: {
    image(node, context) {
      const { destination, title } = node;
      context.skipChildren();
      const attributes = {
        src: resolveImageSrc(destination),
        alt: context.getChildrenText(node)
      };
      if (title) {
        attributes.title = title;
      }
      return {
        type: 'openTag',
        tagName: 'img',
        selfClose: true,
        attributes
      };
    }
  }
});

// 编辑器内容改变时触发
function onChange() {
  if (!contentChange) {
    contentChange = true;
    window.electronAPI['ipc-invoke']('content-change', contentChange);
    document.title = `💾${document.title}`;
  }
  scheduleOutlineRefresh();
}

editor.on('change', onChange);

// 监听主进程发送的内容更改调整，用于提示已保存或未保存
window.electronAPI.onResponse('content-change', (ev, args) => {
  contentChange = args;
  if (!contentChange) {
    // 去除文件未保存的提示
    document.title = document.title.replace('💾', '');
  }
});

// 监听主进程发送的显示 Markdown 内容
window.electronAPI.onResponse('open-file', (ev, args) => {
  // 移除编辑器内容改变事件
  editor.off('change', onChange);
  currentFileDir = args.fileDir || '';
  // 在编辑器显示 markdown
  editor.setMarkdown(args.content);
  contentChange = false;
  // 编辑器内容改变时触发，用于记录内容变更
  editor.on('change', onChange);
  // 立即刷新大纲
  refreshOutline();
});

// 监听主进程发送的当前文件目录，用于“另存为”后更新相对路径基准
window.electronAPI.onResponse('file-dir', (ev, args) => {
  currentFileDir = args || '';
});

// 监听主进程发送的请求获取 Markdown 内容，用于保存文件
window.electronAPI.onResponse('get-markdown', (ev, args) => {
  const markdownContent = editor.getMarkdown();
  // 把 Markdown 内容和接收到的执行功能一起发送到主进程
  window.electronAPI['ipc-invoke']('markdown-content', {
    content: markdownContent,
    exec: args
  });
});

// 监听主进程发送的请求获取 HTML，用于导出 HTML
window.electronAPI.onResponse('get-html', () => {
  const htmlContent = editor.getHTML();
  window.electronAPI['ipc-invoke']('html-content', htmlContent);
});

// 监听主进程发送的标题，用于更改标题
window.electronAPI.onResponse('change-title', (ev, args) => {
  document.title = `${args} - MNote`;
});

// ========== 侧边栏与大纲 ==========

function setSidebarVisible(visible) {
  sidebarVisible = !!visible;
  appContainer.classList.toggle('show-sidebar', sidebarVisible);
}

// 监听主进程发送的侧边栏显隐切换
window.electronAPI.onResponse('toggle-sidebar', (ev, visible) => {
  setSidebarVisible(visible);
});

// 解码 HTML 实体，使解析出的标题与预览区 textContent 一致
function decodeHtmlEntities(html) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = html;
  return textarea.value;
}

// 解析 Markdown 中的标题，忽略代码块中的内容
function parseHeadings(md) {
  const headings = [];
  let inCode = false;
  const lines = md.split(/\r?\n/);
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      continue;
    }
    const m = line.match(/^\s{0,3}(#{1,6})(\s+|$)(.*)$/);
    if (m) {
      let text = m[3].trim().replace(/#+\s*$/, '');
      // 去掉 Markdown 行内标记、HTML 标签和链接语法，尽量与预览区 textContent 一致
      text = text
        .replace(/<[^>]+>/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[*_`~]/g, '');
      text = decodeHtmlEntities(text).trim();
      if (text) {
        headings.push({ level: m[1].length, text: text });
      }
    }
  }
  return headings;
}

// 渲染大纲列表
function renderOutline() {
  if (!outlineContainer) return;

  outlineContainer.innerHTML = '';
  if (headingsCache.length === 0) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.textContent = '暂无标题';
    link.style.color = '#999';
    link.style.cursor = 'default';
    li.appendChild(link);
    outlineContainer.appendChild(li);
    return;
  }

  headingsCache.forEach((h, index) => {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.textContent = h.text;
    link.title = h.text;
    link.style.paddingLeft = `${8 + (h.level - 1) * 14}px`;
    link.addEventListener('click', () => scrollToHeading(index));
    li.appendChild(link);
    outlineContainer.appendChild(li);
  });
}

// 点击大纲项，滚动到预览区对应标题
function scrollToHeading(index) {
  const heading = headingsCache[index];
  if (!heading) {
    return;
  }

  const preview = editorContainer.querySelector('.toastui-editor-md-preview');
  if (!preview) {
    return;
  }

  const els = Array.from(preview.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  let matched = 0;
  let targetEl = null;
  for (const el of els) {
    const elLevel = parseInt(el.tagName.charAt(1), 10);
    if (elLevel === heading.level && (el.textContent || '').trim() === heading.text) {
      if (matched === index) {
        targetEl = el;
        break;
      }
      matched++;
    }
  }
  // 兜底：按标题在预览区出现的顺序滚动
  if (!targetEl && index < els.length) {
    targetEl = els[index];
  }
  if (!targetEl) {
    return;
  }

  // 手动计算目标位置，避免 scrollIntoView 受多层滚动容器影响只滚动一点
  const previewRect = preview.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  const scrollTop = preview.scrollTop + (targetRect.top - previewRect.top);
  preview.scrollTo({ top: scrollTop, behavior: 'smooth' });
}

// 立即刷新大纲
function refreshOutline() {
  headingsCache = parseHeadings(editor.getMarkdown());
  renderOutline();
}

// 内容变化后防抖刷新大纲
function scheduleOutlineRefresh() {
  clearTimeout(outlineTimer);
  outlineTimer = setTimeout(refreshOutline, 300);
}

// 初始化一次大纲
refreshOutline();

// 拖拽文件打开
window.addEventListener('dragover', (ev) => {
  ev.preventDefault();
  ev.stopPropagation();
}, false);

window.addEventListener('drop',(ev) => {
  ev.preventDefault();
  ev.stopPropagation();

  const files = ev.dataTransfer.files;
  if (files.length) {
    const filePath = files[0].path;
    // 把文件路径发送给主进程
    window.electronAPI['ipc-invoke']('dragover-file-path', filePath);
  }
}, false);

// 上下文菜单事件
const wysiwygEditor = editorContainer.querySelector('.ProseMirror');
const markdownEditor = editorContainer.querySelector('.CodeMirror');
if (wysiwygEditor) {
  let mouseover = false;
  wysiwygEditor.addEventListener('mouseover', () => mouseover = true);
  wysiwygEditor.addEventListener('mouseout', () => mouseover = false);
  wysiwygEditor.addEventListener('contextmenu', ev => {
    const position = {x: ev.clientX, y: ev.clientY};
    if (!mouseover) {
      position.x = Math.round(ev.target.offsetLeft + ev.target.offsetWidth / 2);
      position.y = Math.round(ev.target.offsetTop + ev.target.offsetHeight / 2);
    }
    window.electronAPI['ipc-invoke']('contextmenu', position);
  });
}
if (markdownEditor) {
  let mouseover = false;
  markdownEditor.addEventListener('mouseover', () => mouseover = true);
  markdownEditor.addEventListener('mouseout', () => mouseover = false);
  markdownEditor.addEventListener('contextmenu', ev => {
    const position = {x: ev.clientX, y: ev.clientY};
    if (!mouseover) {
      position.x = Math.round(ev.target.offsetLeft + ev.target.offsetWidth / 2);
      position.y = Math.round(ev.target.offsetTop + ev.target.offsetHeight / 2);
    }
    window.electronAPI['ipc-invoke']('contextmenu', position);
  });
}
