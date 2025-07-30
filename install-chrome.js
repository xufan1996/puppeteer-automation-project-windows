import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const platform = os.platform();
const arch = os.arch();

// 根据平台确定Chrome安装路径
function getChromeInstallPath() {
  const baseDir = path.join(process.cwd(), 'chrome');
  
  if (platform === 'win32') {
    return path.join(baseDir, 'win64-116.0.5793.0', 'chrome-win', 'chrome.exe');
  } else if (platform === 'darwin') {
    if (arch === 'arm64') {
      return path.join(baseDir, 'mac_arm-116.0.5793.0', 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
    } else {
      return path.join(baseDir, 'mac-116.0.5793.0', 'chrome-mac', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
    }
  } else {
    return path.join(baseDir, 'linux-116.0.5793.0', 'chrome-linux64', 'chrome');
  }
}

const chromePath = getChromeInstallPath();
const chromeDir = path.dirname(chromePath);

if (!fs.existsSync(chromePath)) {
  console.log(`Chrome not found at ${chromePath}. Installing...`);
  try {
    execSync('npx @puppeteer/browsers install chrome@116.0.5793.0', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('Chrome installed successfully.');
  } catch (error) {
    console.error('Failed to install Chrome:', error.message);
    process.exit(1);
  }
} else {
  console.log(`Chrome already installed at ${chromePath}`);
}

// 导出Chrome路径供其他模块使用
export { chromePath };