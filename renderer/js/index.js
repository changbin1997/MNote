const editorContainer = document.querySelector('#editor');

let contentChange = false; // 内容是否被修改

const {Editor} = toastui;
const {codeSyntaxHighlight } = Editor.plugin;

// 创建编辑器实例
const editor = new Editor({
  el: editorContainer,
  height: '100%',
  initialEditType: 'markdown',
  previewStyle: 'vertical',
  useCommandShortcut: false,
  language: 'zh-CN',
  plugins: [codeSyntaxHighlight]
});

// 编辑器内容改变时触发，提示未保存和内容已更改
editor.on('change', () => {
  if (!contentChange) {
    contentChange = true;
    window.electronAPI['ipc-invoke']('content-change', contentChange);
    document.title = `💾${document.title}`;
  }
});

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
  editor.off('change');
  // 在编辑器显示 markdown
  editor.setMarkdown(args);
  contentChange = false;
  // 编辑器内容改变时触发，用于记录内容变更
  editor.on('change', () => {
    if (!contentChange) {
      contentChange = true;
      window.electronAPI['ipc-invoke']('content-change', contentChange);
      document.title = `💾${document.title}`;
    }
  });
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