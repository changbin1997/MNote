const fs = require('fs');
const path = require('path');
const { dialog } = require('electron');

module.exports = class File {
  mainWindow = null; // 主窗口
  openFilePath = ''; // 当前打开的文件路径
  contentChange = false; // 内容改变
  dragoverFilePath = '';  // 拖入的文件路径

  // 请求获取渲染进程编辑器的内容，用于保存文件
  getEditorContent(exec) {
    this.mainWindow.webContents.send('get-markdown', exec);
  }

  // 请求获取渲染编辑器的HTML
  getEditorHTML() {
    this.mainWindow.webContents.send('get-html');
  }

  // 通过拖放文件的方式打开文件
  dragoverOpenFile(filePath = '') {
    if (filePath !== '') this.dragoverFilePath = filePath;
    // 如果编辑器的内容被更改且未保存
    if (this.contentChange) {
      const result = dialog.showMessageBoxSync(this.mainWindow, {
        type: 'question',
        buttons: ['保存', '不保存', '取消'],
        defaultId: 0,
        cancelId: 2,
        title: '文件未保存',
        message: '文件已更改，您要保存更改吗？',
        noLink: true
      });

      if (result === 0) {
        // 保存文件
        this.getEditorContent(['save', 'dragoverOpenFile']);
      }else if (result === 1) {
        this.contentChange = false;
        this.dragoverOpenFile();
      }
      return false;
    }

    // 检查文件是否存在
    if (!fs.existsSync(this.dragoverFilePath)) {
      dialog.showMessageBoxSync(this.mainWindow, {
        title: '无法找到文件',
        message: `无法找到 ${this.dragoverFilePath}`,
        detail: error.message,
        buttons: ['关闭'],
        defaultId: 0,
        noLink: true
      });
      return false;
    }
    // 读取文件
    fs.readFile(this.dragoverFilePath, 'utf-8', (error, content) => {
      if (error) {
        dialog.showMessageBoxSync(this.mainWindow, {
          title: '读取文件出错',
          message: `无法读取 ${this.dragoverFilePath}`,
          detail: error.message,
          buttons: ['关闭'],
          defaultId: 0,
          noLink: true
        });
        return false;
      }

      // 把文件传给渲染进程
      this.mainWindow.webContents.send('open-file', content);
      // 设置当前打开的文件名
      this.openFilePath = this.dragoverFilePath;
      // 把标题传给渲染进程
      this.mainWindow.webContents.send(
        'change-title',
        path.basename(this.openFilePath)
      );
      // 把内容已更改设置为 false
      this.contentChange = false;
      // 通知前端把内容已更改设置为 false
      this.mainWindow.webContents.send('content-change', this.contentChange);
    });
  }

  // 通过关联文件的方式打开文件
  fileAssociations() {
    if (process.argv.length >= 2) {
      const filePath = process.argv[1];
      if (filePath && path.isAbsolute(filePath)) {
        fs.readFile(filePath, 'utf-8', (error, content) => {
          if (error) {
            dialog.showMessageBoxSync(this.mainWindow, {
              title: '读取文件出错',
              message: `无法读取 ${filePath}`,
              detail: error.message,
              buttons: ['关闭'],
              defaultId: 0,
              noLink: true
            });
            return false;
          }

          // 把文件传给渲染进程
          this.mainWindow.webContents.send('open-file', content);
          // 设置当前打开的文件名
          this.openFilePath = filePath;
          // 把标题传给渲染进程
          this.mainWindow.webContents.send(
            'change-title',
            path.basename(this.openFilePath)
          );
        });
      }
    }
  }

  // 打开文件
  openFile() {
    // 如果编辑器的内容被更改且未保存
    if (this.contentChange) {
      const result = dialog.showMessageBoxSync(this.mainWindow, {
        type: 'question',
        buttons: ['保存', '不保存', '取消'],
        defaultId: 0,
        cancelId: 2,
        title: '文件未保存',
        message: '文件已更改，您要保存更改吗？',
        noLink: true
      });

      if (result === 0) {
        // 保存文件
        this.getEditorContent(['save', 'openFile']);
      }else if (result === 1) {
        this.contentChange = false;
        this.openFile();
      }
      return false;
    }
    // 显示打开文件对话框
    const filePath = dialog.showOpenDialogSync(this.mainWindow, {
      title: '打开 Markdown 文件',
      properties: ['openFile'],
      filters: [
        { name: 'Markdown 文件', extensions: ['md', 'markdown'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    // 未选择文件
    if (filePath === undefined || filePath.length < 1) return false;
    // 读取文件
    fs.readFile(filePath[0], 'utf-8', (error, content) => {
      if (error) {
        dialog.showMessageBoxSync(this.mainWindow, {
          title: '读取文件出错',
          message: `无法读取 ${filePath[0]}`,
          detail: error.message,
          buttons: ['关闭'],
          defaultId: 0,
          noLink: true
        });
        return false;
      }

      // 把文件传给渲染进程
      this.mainWindow.webContents.send('open-file', content);
      // 设置当前打开的文件名
      this.openFilePath = filePath[0];
      // 把标题传给渲染进程
      this.mainWindow.webContents.send(
        'change-title',
        path.basename(this.openFilePath)
      );
      // 把内容已更改设置为 false
      this.contentChange = false;
      // 通知前端把内容已更改设置为 false
      this.mainWindow.webContents.send('content-change', this.contentChange);
    });
  }

  // 另存为
  saveAs(content) {
    // 显示保存文件对话框
    const fileName = dialog.showSaveDialogSync(this.mainWindow, {
      title: '另存为',
      buttonLabel: '保存',
      defaultPath: path.join(process.cwd(), 'markdown-file.md')
    });
    if (fileName === undefined) return false;

    try {
      fs.writeFileSync(fileName, content, 'utf-8');
      // 把打开的文件名设置为另存为的文件名
      this.openFilePath = fileName;
      // 把标题发送到渲染进程
      this.mainWindow.webContents.send(
        'change-title',
        path.basename(this.openFilePath)
      );
      // 把内容已更改设置为 false
      this.contentChange = false;
      // 通知前端把内容已更改设置为 false
      this.mainWindow.webContents.send('content-change', this.contentChange);
      return true;
    } catch (error) {
      dialog.showMessageBoxSync(this.mainWindow, {
        title: '保存文件出错',
        message: `无法保存文件到 ${fileName}`,
        detail: error.message,
        buttons: ['关闭'],
        defaultId: 0,
        noLink: true
      });
      return false;
    }
  }

  // 保存
  save(content) {
    // 如果还没有打开过文件或文件不存在就直接调用另存为
    if (this.openFilePath === '' || !fs.existsSync(this.openFilePath)) {
      this.saveAs(content);
      return false;
    }
    // 把内容保存到当前打开的文件
    try {
      fs.writeFileSync(this.openFilePath, content, 'utf-8');
      // 把内容已更改设置为 false
      this.contentChange = false;
      // 通知前端把内容已更改设置为 false
      this.mainWindow.webContents.send('content-change', this.contentChange);
      return true;
    } catch (error) {
      dialog.showMessageBoxSync(this.mainWindow, {
        title: '保存文件出错',
        message: `无法保存文件到 ${this.openFilePath}`,
        detail: error.message,
        buttons: ['关闭'],
        defaultId: 0,
        noLink: true
      });
      return false;
    }
  }

  // 导出为 HTML
  exportHTML(htmlContent) {
    // 显示保存文件对话框
    const fileName = dialog.showSaveDialogSync(this.mainWindow, {
      title: '导出HTML',
      buttonLabel: '导出',
      defaultPath: path.join(process.cwd(), 'MNote.html')
    });
    if (fileName === undefined) return false;

    try {
      fs.writeFileSync(fileName, htmlContent, 'utf-8');
      return true;
    } catch (error) {
      dialog.showMessageBoxSync(this.mainWindow, {
        title: '导出 HTML 出错',
        message: `无法导出文件到 ${fileName}`,
        detail: error.message,
        buttons: ['关闭'],
        defaultId: 0,
        noLink: true
      });
      return false;
    }
  }
};
