const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 修复pkg构建中Chrome路径问题的专用脚本
 */
async function fixPkgChromeBuild() {
  console.log('=== 修复pkg Chrome构建 ===');
  
  try {
    // 1. 验证Chrome安装
    console.log('1. 验证Chrome安装...');
    const chromeDir = path.join(__dirname, 'chrome');
    const chromePath = path.join(chromeDir, 'win64-116.0.5793.0', 'chrome-win64', 'chrome.exe');
    
    if (!fs.existsSync(chromePath)) {
      console.log('Chrome未安装，正在安装...');
      execSync('npm run install-chrome', { stdio: 'inherit' });
      
      if (!fs.existsSync(chromePath)) {
        throw new Error('Chrome安装失败');
      }
    }
    
    console.log('✅ Chrome已安装');
    
    // 2. 清理旧的构建
    console.log('2. 清理旧构建...');
    const distDir = path.join(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      await fs.remove(distDir);
    }
    await fs.ensureDir(distDir);
    console.log('✅ 清理完成');
    
    // 3. 创建优化的Chrome资源结构
    console.log('3. 准备Chrome资源...');
    const distChromeDir = path.join(distDir, 'chrome');
    
    // 复制Chrome资源到dist目录，确保pkg可以找到
    await fs.copy(chromeDir, distChromeDir, {
      filter: (src, dest) => {
        const relativePath = path.relative(chromeDir, src);
        
        // 跳过一些不必要的文件以减小体积
        if (relativePath.includes('debug') || 
            relativePath.includes('symbols') ||
            relativePath.includes('.pdb') ||
            relativePath.includes('crashpad_handler.exe')) {
          return false;
        }
        
        return true;
      }
    });
    
    console.log('✅ Chrome资源准备完成');
    
    // 4. 创建pkg兼容的Chrome路径检测文件
    console.log('4. 创建pkg兼容文件...');
    const pkgCompatibleCode = `
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
        console.log(\`尝试路径 \${i + 1}: \${possiblePaths[i]}\`);
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
`;
    
    await fs.writeFile(path.join(__dirname, 'src', 'pkg-chrome-helper.js'), pkgCompatibleCode);
    console.log('✅ pkg兼容文件创建完成');
    
    // 5. 修改主文件以使用pkg兼容的Chrome检测
    console.log('5. 更新主文件Chrome检测逻辑...');
    
    // 备份原始文件
    const mainJsPath = path.join(__dirname, 'src', 'main.js');
    const workerJsPath = path.join(__dirname, 'src', 'worker.js');
    
    await fs.copy(mainJsPath, mainJsPath + '.backup');
    await fs.copy(workerJsPath, workerJsPath + '.backup');
    
    // 更新main.js
    let mainContent = await fs.readFile(mainJsPath, 'utf8');
    
    // 添加pkg helper引入
    if (!mainContent.includes('pkg-chrome-helper')) {
      mainContent = mainContent.replace(
        'const os = require(\'os\');',
        `const os = require('os');
const { getPkgChromePath } = require('./pkg-chrome-helper');`
      );
    }
    
    // 替换getChromePath函数
    const newGetChromePath = `// 获取Chrome可执行文件路径 - pkg优化版本
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
  
  console.log(\`平台: \${platform}, 架构: \${os.arch()}, pkg模式: \${isPkg}\`);
  console.log(\`process.execPath: \${process.execPath}\`);
  console.log(\`__dirname: \${__dirname}\`);
  
  let chromePath;
  
  if (isPkg) {
    let execDir;
    
    if (platform === 'win32') {
      execDir = path.dirname(process.execPath);
      console.log(\`pkg执行目录: \${execDir}\`);
      
      const possiblePaths = [
        path.join(execDir, 'chrome', 'win64-116.0.5793.0', 'chrome-win64', 'chrome.exe'),
        path.join(execDir, 'chrome-win64', 'chrome.exe'),
        path.join(execDir, 'chrome', 'chrome-win64', 'chrome.exe'),
        path.resolve(execDir, 'chrome', 'win64-116.0.5793.0', 'chrome-win64', 'chrome.exe')
      ];
      
      console.log('尝试的Chrome路径:');
      for (let i = 0; i < possiblePaths.length; i++) {
        console.log(\`  \${i + 1}. \${possiblePaths[i]}\`);
        if (fs.existsSync(possiblePaths[i])) {
          chromePath = possiblePaths[i];
          console.log(\`  ✅ 找到有效路径: \${chromePath}\`);
          break;
        } else {
          console.log(\`  ❌ 路径不存在\`);
        }
      }
    } else {
      throw new Error('此版本仅支持Windows平台');
    }
  } else {
    const projectDir = path.join(__dirname, '..');
    console.log(\`开发环境项目目录: \${projectDir}\`);
    
    if (platform === 'win32') {
      chromePath = path.join(projectDir, 'chrome', 'win64-116.0.5793.0', 'chrome-win64', 'chrome.exe');
    } else {
      throw new Error('此版本仅支持Windows平台');
    }
  }`;
    
    // 替换原始的getChromePath函数
    mainContent = mainContent.replace(
      /\/\/ 获取Chrome可执行文件路径[\s\S]*?console\.log\(`==================\\n`\);\s*return chromePath;\s*};/,
      newGetChromePath + '\n  \n  console.log(`计算出的Chrome路径: ${chromePath}`);\n  console.log(`==================\\n`);\n  return chromePath;\n};'
    );
    
    await fs.writeFile(mainJsPath, mainContent);
    
    // 类似地更新worker.js
    let workerContent = await fs.readFile(workerJsPath, 'utf8');
    
    if (!workerContent.includes('pkg-chrome-helper')) {
      workerContent = workerContent.replace(
        'const os = require(\'os\');',
        `const os = require('os');
const { getPkgChromePath } = require('./pkg-chrome-helper');`
      );
    }
    
    // 替换worker.js中的getChromePath函数
    const newWorkerGetChromePath = `// 获取Chrome可执行文件路径 - pkg优化版本
const getChromePath = () => {
  console.log(\`[Worker \${process.pid}] === Chrome路径检测（pkg优化版）===\`);
  
  // 首先尝试pkg兼容的路径检测
  const pkgPath = getPkgChromePath();
  if (pkgPath && fs.existsSync(pkgPath)) {
    console.log(\`[Worker \${process.pid}] ✅ pkg兼容路径检测成功: \${pkgPath}\`);
    return pkgPath;
  }
  
  // 如果pkg方法失败，使用原始方法
  const platform = os.platform();
  const isPkg = typeof process.pkg !== 'undefined';
  
  console.log(\`[Worker \${process.pid}] 平台: \${platform}, 架构: \${os.arch()}, pkg模式: \${isPkg}\`);
  console.log(\`[Worker \${process.pid}] process.execPath: \${process.execPath}\`);
  console.log(\`[Worker \${process.pid}] __dirname: \${__dirname}\`);
  
  let chromePath;
  
  if (isPkg) {
    let execDir;
    
    if (platform === 'win32') {
      execDir = path.dirname(process.execPath);
      console.log(\`[Worker \${process.pid}] pkg执行目录: \${execDir}\`);
      
      const possiblePaths = [
        path.join(execDir, 'chrome', 'win64-116.0.5793.0', 'chrome-win64', 'chrome.exe'),
        path.join(execDir, 'chrome-win64', 'chrome.exe'),
        path.join(execDir, 'chrome', 'chrome-win64', 'chrome.exe'),
        path.resolve(execDir, 'chrome', 'win64-116.0.5793.0', 'chrome-win64', 'chrome.exe')
      ];
      
      console.log(\`[Worker \${process.pid}] 尝试的Chrome路径:\`);
      for (let i = 0; i < possiblePaths.length; i++) {
        console.log(\`[Worker \${process.pid}]   \${i + 1}. \${possiblePaths[i]}\`);
        if (fs.existsSync(possiblePaths[i])) {
          chromePath = possiblePaths[i];
          console.log(\`[Worker \${process.pid}]   ✅ 找到有效路径: \${chromePath}\`);
          break;
        } else {
          console.log(\`[Worker \${process.pid}]   ❌ 路径不存在\`);
        }
      }
    } else {
      execDir = path.dirname(process.execPath);
      console.log('此版本仅支持Windows平台');
    }
  } else {
    const projectDir = path.join(__dirname, '..');
    console.log(\`[Worker \${process.pid}] 开发环境项目目录: \${projectDir}\`);
    
    if (platform === 'win32') {
      chromePath = path.join(projectDir, 'chrome', 'win64-116.0.5793.0', 'chrome-win64', 'chrome.exe');
    } else {
      console.log('此版本仅支持Windows平台');
    }
  }`;
    
    workerContent = workerContent.replace(
      /\/\/ 获取Chrome可执行文件路径[\s\S]*?console\.log\(`\[Worker \${process\.pid}\] ==================\\n`\);\s*return chromePath;\s*};/,
      newWorkerGetChromePath + '\n  \n  console.log(`[Worker ${process.pid}] 计算出的Chrome路径: ${chromePath}`);\n  console.log(`[Worker ${process.pid}] ==================\\n`);\n  return chromePath;\n};'
    );
    
    await fs.writeFile(workerJsPath, workerContent);
    
    console.log('✅ 主文件更新完成');
    
    // 6. 执行pkg构建
    console.log('6. 执行pkg构建...');
    try {
      execSync('pkg package.json --targets node18-win-x64 --out-path dist --debug', { 
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'production' }
      });
      console.log('✅ pkg构建完成');
    } catch (error) {
      console.error('❌ pkg构建失败:', error.message);
      
      // 恢复备份文件
      await fs.copy(mainJsPath + '.backup', mainJsPath);
      await fs.copy(workerJsPath + '.backup', workerJsPath);
      
      throw error;
    }
    
    // 7. 验证构建结果
    console.log('7. 验证构建结果...');
    const exePath = path.join(distDir, 'puppeteer-automation.exe');
    
    if (!fs.existsSync(exePath)) {
      throw new Error('构建的可执行文件不存在');
    }
    
    const exeStats = fs.statSync(exePath);
    const distChromeExePath = path.join(distDir, 'chrome', 'win64-116.0.5793.0', 'chrome-win64', 'chrome.exe');
    
    console.log(`✅ 可执行文件大小: ${(exeStats.size / 1024 / 1024).toFixed(2)}MB`);
    console.log(`✅ Chrome资源存在: ${fs.existsSync(distChromeExePath) ? '是' : '否'}`);
    
    // 8. 创建快速测试脚本
    console.log('8. 创建测试脚本...');
    const testScript = `@echo off
chcp 65001 >nul
echo === pkg Chrome Path Test ===
echo Current Directory: %CD%
echo Executable: %CD%\\puppeteer-automation.exe
echo Chrome Path: %CD%\\chrome\\win64-116.0.5793.0\\chrome-win64\\chrome.exe
echo.
echo Starting test...
echo.
if exist "%CD%\\puppeteer-automation.exe" (
    echo Found executable file
    echo Press Ctrl+C to stop the test
    echo.
    "%CD%\\puppeteer-automation.exe"
) else (
    echo ERROR: puppeteer-automation.exe not found in current directory
    echo Please make sure you are running this from the dist folder
    echo.
    pause
)`;
    
    await fs.writeFile(path.join(distDir, 'test-chrome-path.bat'), testScript, 'utf8');
    
    // 9. 清理备份文件
    await fs.remove(mainJsPath + '.backup');
    await fs.remove(workerJsPath + '.backup');
    
    console.log('\n=== pkg Chrome构建修复完成 ===');
    console.log(`可执行文件: ${exePath}`);
    console.log(`Chrome资源: ${distChromeExePath}`);
    console.log('');
    console.log('测试命令:');
    console.log('1. cd dist && puppeteer-automation.exe');
    console.log('2. 或运行: dist/test-chrome-path.bat');
    console.log('');
    console.log('如果仍有问题，可以检查:');
    console.log('- Chrome文件是否存在于dist/chrome目录');
    console.log('- 可执行文件是否有足够权限');
    console.log('- Windows防病毒软件是否阻止执行');
    
  } catch (error) {
    console.error('\n❌ pkg Chrome构建修复失败:', error.message);
    console.error('\n故障排除:');
    console.error('1. 确保Chrome已安装: npm run install-chrome');
    console.error('2. 检查磁盘空间是否充足');
    console.error('3. 检查文件权限');
    console.error('4. 尝试以管理员身份运行');
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  fixPkgChromeBuild();
}

module.exports = { fixPkgChromeBuild };