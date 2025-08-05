const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // 禁用Puppeteer自动下载Chromium
  skipDownload: true,
  // 不使用本地Chromium缓存
  cacheDirectory: false,
};