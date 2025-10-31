const { Menu, shell, dialog } = require('electron');

module.exports = (mainWindow, file) => {
  // 菜单模板
  const menuTemplate = [
    {
      label: '文件(F)(&F)',
      submenu: [
        {
          label: '打开',
          click() {
            file.openFile();
          },
          accelerator: 'ctrl+o'
        },
        {
          label: '保存',
          click() {
            file.getEditorContent(['save']);
          },
          accelerator: 'ctrl+s'
        },
        {
          label: '另存为',
          click() {
            file.getEditorContent(['saveAs']);
          },
          accelerator: 'ctrl+shift+s'
        },
        {
          label: '导出为 HTML',
          click() {
            file.getEditorHTML();
          }
        },
        {
          label: '退出',
          click() {
            mainWindow.close();
          }
        }
      ]
    },
    {
      label: '编辑(E)(&E)',
      submenu: [
        {
          label: '全选',
          role: 'selectAll'
        },
        {
          label: '剪切',
          role: 'cut'
        },
        {
          label: '复制',
          role: 'copy'
        },
        {
          label: '粘贴',
          role: 'paste'
        }
      ]
    },
    {
      label: '帮助(H)(&H)',
      submenu: [
        {
          label: '开发者博客',
          click() {
            shell.openExternal('https://www.misterma.com/');
          }
        },
        {
          label: '开发者Github',
          click() {
            shell.openExternal('https://github.com/changbin1997');
          }
        },
        {
          label: '关于',
          click() {
            dialog.showMessageBoxSync(mainWindow, {
              type: 'info',
              buttons: ['关闭'],
              defaultId: 0,
              title: '关于',
              noLink: true,
              message: 'VNote v0.1\nCopyright © 2025 changbin1997\n本软件使用 MIT License 开源。'
            })
          }
        }
      ]
    },
    {
      label: '开发者',
      submenu: [
        {
          label: '刷新页面',
          click() {
            mainWindow.reload();
          }
        },
        {
          label: '开发者工具',
          click() {
            mainWindow.webContents.openDevTools();
          }
        }
      ]
    }
  ];

  const menuBar = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menuBar);
};