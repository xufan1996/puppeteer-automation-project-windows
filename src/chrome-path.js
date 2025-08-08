const fs = require('fs');
const path = require('path');
const os = require('os');
const { getPkgChromePath } = require('./pkg-chrome-helper');

// 获取Chrome可执行文件路径 - pkg优化版本
const getChromePath = () => {
  console.log('=== Chrome路径检测（pkg优化版）===');
  
  // 首先尝试pkg兼容的路径检测
  const pkgPath = getPkgChromePath();
  if (pkgPath && fs.existsSync(pkgPath)) {
    console.log('✅ pkg兼容路径检测成功:', pkgPath);
    return pkgPath;
  }
  
  // 如果pkg方法失败，使用原始方法
  const platform = os.platform();
  const isPkg = typeof process.pkg !== 'undefined';
  
  console.log(`平台: ${platform}, 架构: ${os.arch()}, pkg模式: ${isPkg}`);
  console.log(`process.execPath: ${process.execPath}`);
  console.log(`__dirname: ${__dirname}`);
  
  let chromePath;
  
  if (isPkg) {
    let execDir;
    
    if (platform === 'win32') {
      execDir = path.dirname(process.execPath);
      console.log(`pkg执行目录: ${execDir}`);
      
      const possiblePaths = [
        path.join(execDir, 'chrome', 'win64-116.0.5793.0', 'chrome-win64', 'chrome.exe'),
        path.join(execDir, 'chrome-win64', 'chrome.exe'),
        path.join(execDir, 'chrome', 'chrome-win64', 'chrome.exe'),
        path.resolve(execDir, 'chrome', 'win64-116.0.5793.0', 'chrome-win64', 'chrome.exe')
      ];
      
      console.log('尝试的Chrome路径:');
      for (let i = 0; i < possiblePaths.length; i++) {
        console.log(`  ${i + 1}. ${possiblePaths[i]}`);
        if (fs.existsSync(possiblePaths[i])) {
          chromePath = possiblePaths[i];
          console.log(`✅ 找到Chrome: ${chromePath}`);
          break;
        }
      }
    } else if (platform === 'darwin') {
      execDir = path.dirname(process.execPath);
      console.log(`pkg执行目录: ${execDir}`);
      
      const arch = os.arch();
      const possiblePaths = [
        // 根据架构选择对应的Chrome路径
        arch === 'arm64' 
          ? path.join(execDir, 'chrome', 'mac_arm-116.0.5793.0', 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
          : path.join(execDir, 'chrome', 'mac-116.0.5793.0', 'chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
        // 备用路径
        arch === 'arm64'
          ? path.join(execDir, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
          : path.join(execDir, 'chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
        // 兼容旧版本路径
        path.join(execDir, 'chrome', 'mac-116.0.5793.0', 'chrome-mac-x64', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
        path.join(execDir, 'chrome-mac-x64', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
        path.join(execDir, 'chrome', 'chrome-mac-x64', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
        path.resolve(execDir, 'chrome', 'mac-116.0.5793.0', 'chrome-mac-x64', 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
      ];
      
      console.log('尝试的Chrome路径:');
      for (let i = 0; i < possiblePaths.length; i++) {
        console.log(`  ${i + 1}. ${possiblePaths[i]}`);
        if (fs.existsSync(possiblePaths[i])) {
          chromePath = possiblePaths[i];
          console.log(`✅ 找到Chrome: ${chromePath}`);
          break;
        }
      }
    }
  } else {
    // 非pkg模式，使用默认路径
    if (platform === 'win32') {
      chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    } else if (platform === 'darwin') {
      chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    } else {
      chromePath = '/usr/bin/google-chrome';
    }
  }
  
  if (!chromePath || !fs.existsSync(chromePath)) {
    console.error('❌ 未找到Chrome可执行文件');
    throw new Error('Chrome可执行文件不存在');
  }
  
  console.log(`✅ 最终Chrome路径: ${chromePath}`);
  return chromePath;
};

// 延迟函数
const delay = (min, max) => {
  const time = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, time));
};

// 智能等待函数 - 优先使用元素等待，回退到延迟
const smartWait = async (page, options = {}) => {
  const {
    selector = null,
    action = 'visible', // 'visible', 'hidden', 'stable'
    timeout = 5000,
    fallbackDelay = [500, 1000]
  } = options;
  
  if (selector) {
    try {
      switch (action) {
        case 'visible':
          await page.waitForSelector(selector, { visible: true, timeout });
          break;
        case 'hidden':
          await page.waitForSelector(selector, { hidden: true, timeout });
          break;
        case 'stable':
          // 等待元素稳定（连续两次检查位置相同）
          await page.waitForFunction(
            (sel) => {
              const element = document.querySelector(sel);
              if (!element) return false;
              const rect1 = element.getBoundingClientRect();
              return new Promise(resolve => {
                setTimeout(() => {
                  const rect2 = element.getBoundingClientRect();
                  resolve(rect1.top === rect2.top && rect1.left === rect2.left);
                }, 100);
              });
            },
            { timeout },
            selector
          );
          break;
      }
      return true;
    } catch (error) {
      // 如果元素等待失败，回退到延迟
      console.log(`智能等待失败，回退到延迟: ${error.message}`);
    }
  }
  
  // 回退到随机延迟
  const time = Math.floor(Math.random() * (fallbackDelay[1] - fallbackDelay[0] + 1)) + fallbackDelay[0];
  await new Promise(resolve => setTimeout(resolve, time));
  return false;
};

module.exports = { getChromePath, delay, smartWait };