const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');

// 常见图片扩展名到 MIME 的映射
const imageMimeTypes = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.apng': 'image/apng'
};

// 缓存已读取的本地图片，避免每次渲染都重新读取
const imageCache = new Map();

function getImageMime(filePath) {
  return imageMimeTypes[path.extname(filePath).toLowerCase()] || null;
}

function readImageDataUrl(filePath) {
  if (imageCache.has(filePath)) {
    return imageCache.get(filePath);
  }
  try {
    const data = fs.readFileSync(filePath);
    const mime = getImageMime(filePath) || 'application/octet-stream';
    const url = `data:${mime};base64,${data.toString('base64')}`;
    imageCache.set(filePath, url);
    return url;
  } catch {
    return null;
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  onResponse: (channel, listener) => {
    ipcRenderer.on(channel, listener);
  },
  'ipc-invoke': (channel, listener) => {
    ipcRenderer.invoke(channel, listener);
  },
  /**
   * 解析图片路径：网络 URL 保持原样；
   * 相对路径基于 Markdown 文件所在目录解析；
   * 本地图片读取为 data URL，预览时直接显示。
   * @param {string} baseDir - Markdown 文件所在目录
   * @param {string} src - 图片路径
   * @returns {string}
   */
  resolveImageSrc: (baseDir, src) => {
    if (!src) return src;

    // 网络 URL 直接返回
    if (/^(https?|ftp|mailto):/i.test(src)) {
      return src;
    }

    // 尝试解码 URL 编码的空格等字符（如 %20）
    let decodedSrc = src;
    try {
      decodedSrc = decodeURIComponent(src);
    } catch {
      // 解码失败则继续使用原始路径
    }

    let absolute;
    try {
      // 如果是 file:// URL，先转成本地路径
      if (/^file:/i.test(decodedSrc)) {
        absolute = fileURLToPath(decodedSrc);
      } else if (path.isAbsolute(decodedSrc)) {
        absolute = decodedSrc;
      } else if (baseDir) {
        absolute = path.resolve(baseDir, decodedSrc);
      } else {
        return src;
      }
    } catch {
      return src;
    }

    // 只处理实际存在的本地文件；不存在则返回原始路径
    if (!fs.existsSync(absolute)) {
      return src;
    }

    return readImageDataUrl(absolute) || src;
  }
});
