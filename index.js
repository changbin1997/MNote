const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const menuBar = require('./app/menu-bar');
const File = require('./app/File');
const Contextmenu = require('./app/contextmenu');

let mainWindow = null;
// 文件操作
const file = new File();
// 上下文菜单初始化
const contextmenu = Contextmenu();

app.on('ready', async () => {
  // 创建窗口
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      webSecurity: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  await mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 把主窗口传给文件操作模块，用于在窗口内显示对话框和 ipc 通信
  file.mainWindow = mainWindow;
  // 菜单栏初始化
  menuBar(mainWindow, file);
  // 关联文件打开检测
  file.fileAssociations();

  // 窗口关闭
  mainWindow.on('close', (ev) => {
    // 如果内容已更改
    if (file.contentChange) {
      // 阻止默认的关闭
      ev.preventDefault();

      const result = dialog.showMessageBoxSync(mainWindow, {
        type: 'question',
        buttons: ['保存', '不保存', '取消'],
        defaultId: 0,
        cancelId: 2,
        title: '退出确认',
        message: '文件已更改，您要保存更改吗？',
        noLink: true
      });
      if (result === 0) {
        file.getEditorContent(['save', 'close']);
      } else if (result === 1) {
        file.contentChange = false;
        mainWindow.close();
      } else {
        return false;
      }
    }else {
      mainWindow = null;
    }
  });
});

// 监听前端传过来的 Markdown 内容，用于保存文件
ipcMain.handle('markdown-content', (ev, args) => {
  // 调用保存或另存为
  file[args.exec[0]](args.content);
  if (args.exec.length > 1) {
    if (args.exec[1] === 'close') {
      // 执行退出
      mainWindow.close();
    }else {
      // 执行打开文件
      file[args.exec[1]]();
    }
  }
});
// 监听前端传过来的 HTML 内容
ipcMain.handle('html-content', (ev, args) => {
  file.exportHTML(args);
});
// 监听前端传过来的文件路径，用于拖放打开文件
ipcMain.handle('dragover-file-path', (ev, args) => {
  file.dragoverOpenFile(args);
});
// 监听前端传过来的内容更改调整，用于退出时询问保存
ipcMain.handle('content-change', (ev, args) => {
  file.contentChange = args;
});
// 监听显示上下文菜单
ipcMain.handle('contextmenu', (ev, args) => {
  contextmenu.popup({x: args.x, y: args.y});
});