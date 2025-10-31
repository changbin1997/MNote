const { Menu } = require('electron');

module.exports = () => {
  const menuTemplate = [
    {
      label: '全选',
      role: 'selectAll'
    },
    {
      label: '剪贴',
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
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  return menu;
};
