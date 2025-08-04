
// pkg兼容的Chrome路径检测
const fs = require('fs');
const path = require('path');
const os = require('os');

function getPkgChromePath() {
  const platform = os.platform();
  const isPkg = typeof process.pkg !== 'undefined';
  
  if (!isPkg) {
    // 开发环境
    const projectDir = path.join(__dirname, '..');
    if (platform === 'win32') {
      return path.join(projectDir, 'chrome', 'win64-116.0.5793.0', 'chrome-win64', 'chrome.exe');
    }
  } else {
    // pkg环境
    const execDir = path.dirname(process.execPath);
    
    if (platform === 'win32') {
      const possiblePaths = [
        // 标准路径（与dist目录结构匹配）
        path.join(execDir, 'chrome', 'win64-116.0.5793.0', 'chrome-win64', 'chrome.exe'),
        // 备用路径1
        path.join(execDir, 'chrome-win64', 'chrome.exe'),
        // 备用路径2
        path.join(execDir, 'chrome', 'chrome-win64', 'chrome.exe'),
        // 备用路径3：相对于snapshot目录
        path.resolve(process.cwd(), 'chrome', 'win64-116.0.5793.0', 'chrome-win64', 'chrome.exe'),
        // 备用路径4：在工作目录中查找
        path.join(process.cwd(), 'chrome', 'win64-116.0.5793.0', 'chrome-win64', 'chrome.exe')
      ];
      
      console.log('pkg模式Chrome路径检测:');
      console.log('execPath:', process.execPath);
      console.log('execDir:', execDir);
      console.log('cwd:', process.cwd());
      
      for (let i = 0; i < possiblePaths.length; i++) {
        console.log(`尝试路径 ${i + 1}: ${possiblePaths[i]}`);
        if (fs.existsSync(possiblePaths[i])) {
          console.log('✅ 找到Chrome:', possiblePaths[i]);
          return possiblePaths[i];
        } else {
          console.log('❌ 路径不存在');
        }
      }
      
      // 最后尝试：搜索整个execDir
      const searchChrome = (searchDir) => {
        try {
          const items = fs.readdirSync(searchDir, { withFileTypes: true });
          for (const item of items) {
            const fullPath = path.join(searchDir, item.name);
            if (item.isFile() && item.name === 'chrome.exe') {
              return fullPath;
            } else if (item.isDirectory() && (item.name.includes('chrome') || item.name.includes('win64'))) {
              const result = searchChrome(fullPath);
              if (result) return result;
            }
          }
        } catch (error) {
          console.log('搜索错误:', error.message);
        }
        return null;
      };
      
      console.log('开始搜索Chrome可执行文件...');
      const foundPath = searchChrome(execDir);
      if (foundPath) {
        console.log('✅ 搜索找到Chrome:', foundPath);
        return foundPath;
      }
    }
  }
  
  return null;
}

module.exports = { getPkgChromePath };
