const express = require('express');
const cors = require('cors');
const { Worker } = require('worker_threads');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const os = require('os');

// 配置环境变量
dotenv.config();

// CommonJS中__dirname是内置的，无需定义
const PORT = process.env.PORT || 3000;

// 检测是否为打包后的可执行文件
const isPkg = typeof process.pkg !== 'undefined';
const isWindows = os.platform() === 'win32';

// 详细的环境信息日志
const logEnvironmentInfo = () => {
  console.log('\n=== 环境信息 ===');
  console.log(`操作系统: ${os.platform()} ${os.arch()}`);
  console.log(`Node.js版本: ${process.version}`);
  console.log(`工作目录: ${process.cwd()}`);
  console.log(`执行路径: ${process.execPath}`);
  console.log(`__dirname: ${__dirname}`);
  console.log(`是否为pkg打包: ${isPkg}`);
  console.log(`是否为Windows: ${isWindows}`);
  
  if (isPkg) {
    console.log(`pkg执行目录: ${path.dirname(process.execPath)}`);
  }
  
  // 检查Chrome目录
  const chromeDir = path.join(__dirname, 'chrome');
  if (fs.existsSync(chromeDir)) {
    console.log(`Chrome目录存在: ${chromeDir}`);
    try {
      const chromeContents = fs.readdirSync(chromeDir);
      console.log(`Chrome目录内容: ${chromeContents.join(', ')}`);
    } catch (error) {
      console.log(`读取Chrome目录失败: ${error.message}`);
    }
  } else {
    console.log(`⚠️ Chrome目录不存在: ${chromeDir}`);
  }
  
  // 检查关键环境变量
  console.log(`COMSPEC: ${process.env.COMSPEC || '未设置'}`);
  console.log(`PATH前100字符: ${(process.env.PATH || '').substring(0, 100)}`);
  console.log('===============\n');
};

// 启动时记录环境信息
logEnvironmentInfo();

// 创建Express应用
const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 存储当前运行的进程
let currentProcess = null;
let isRunning = false;
let logs = [];

// 添加日志
const addLog = (message, type = 'info') => {
  const timestamp = new Date().toLocaleString();
  const logEntry = { timestamp, message, type };
  logs.push(logEntry);
  // 保持最新的100条日志
  if (logs.length > 100) {
    logs = logs.slice(-100);
  }
  console.log(`[${timestamp}] ${type.toUpperCase()}: ${message}`);
};

// Windows特定的进程启动函数
const startNodeProcess = (scriptPath, workerData) => {
  console.log(`=== 启动 Worker 线程 ===`);
  console.log(`脚本路径: ${scriptPath}`);
  console.log(`工作目录: ${__dirname}`);
  
  try {
    const worker = new Worker(scriptPath, {
      workerData: workerData
    });
    
    console.log(`✅ Worker 线程已启动，Thread ID: ${worker.threadId}`);
    console.log(`================\n`);
    
    return worker;
    
  } catch (error) {
    console.error(`❌ 启动 Worker 线程失败: ${error.message}`);
    throw error;
  }
};

// 自动打开浏览器的函数 - pkg兼容版本
const openBrowser = (url) => {
  console.log(`尝试打开浏览器: ${url}`);
  
  try {
    if (isWindows) {
      // Windows下的多种启动方式
      const windowsCommands = [
        // 方法1: 使用start命令
        () => {
          console.log('尝试方法1: start命令');
          return spawn('cmd', ['/c', 'start', '""', `"${url}"`], { 
            shell: true, 
            windowsHide: true,
            detached: true
          });
        },
        
        // 方法2: 直接使用start
        () => {
          console.log('尝试方法2: 直接start');
          return spawn('start', [`"${url}"`], { 
            shell: true, 
            windowsHide: true,
            detached: true
          });
        },
        
        // 方法3: 使用rundll32
        () => {
          console.log('尝试方法3: rundll32');
          return spawn('rundll32', ['url.dll,FileProtocolHandler', url], {
            windowsHide: true,
            detached: true
          });
        }
      ];
      
      // 尝试每种方法
      let success = false;
      for (const commandFunc of windowsCommands) {
        try {
          const child = commandFunc();
          
          child.on('error', (error) => {
            console.log(`命令执行失败: ${error.message}`);
          });
          
          child.on('spawn', () => {
            console.log('✅ 浏览器启动命令执行成功');
            success = true;
          });
          
          // 如果进程启动成功，跳出循环
          if (child.pid) {
            console.log(`进程PID: ${child.pid}`);
            success = true;
            break;
          }
          
        } catch (methodError) {
          console.log(`方法失败: ${methodError.message}`);
          continue;
        }
      }
      
      if (!success) {
        throw new Error('所有Windows浏览器启动方法都失败了');
      }
      
    } else if (os.platform() === 'darwin') {
      // macOS
      console.log('尝试macOS打开浏览器');
      const child = spawn('open', [url], { detached: true });
      child.on('error', (error) => {
        throw error;
      });
    } else {
      // Linux
      console.log('尝试Linux打开浏览器');
      const child = spawn('xdg-open', [url], { detached: true });
      child.on('error', (error) => {
        throw error;
      });
    }
    
    console.log('✅ 浏览器启动命令已发送');
    
  } catch (error) {
    console.error(`❌ 自动打开浏览器失败: ${error.message}`);
    addLog(`无法自动打开浏览器: ${error.message}`, 'warning');
    addLog(`请手动访问: ${url}`, 'info');
  }
};

// pkg环境下的安全spawn函数
const safeSpawn = (command, args, options = {}) => {
  try {
    console.log(`执行命令: ${command} ${args ? args.join(' ') : ''}`);
    
    const defaultOptions = {
      windowsHide: true,
      detached: true,
      stdio: 'ignore'
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    if (isPkg && isWindows) {
      // pkg环境下，确保使用正确的shell
      finalOptions.shell = true;
      finalOptions.env = { ...process.env };
    }
    
    const child = spawn(command, args, finalOptions);
    
    child.on('error', (error) => {
      console.error(`命令执行错误: ${error.message}`);
    });
    
    child.on('spawn', () => {
      console.log(`命令启动成功，PID: ${child.pid}`);
    });
    
    return child;
    
  } catch (error) {
    console.error(`safeSpawn错误: ${error.message}`);
    throw error;
  }
};

// API 路由
app.get('/api/status', (req, res) => {
  res.json({
    isRunning,
    logs: logs.slice(-20), // 返回最新20条日志
    platform: os.platform(),
    isPkg
  });
});

app.get('/api/logs', (req, res) => {
  res.json({ logs });
});

app.post('/api/start', (req, res) => {
  if (isRunning) {
    return res.status(400).json({ error: '任务已在运行中' });
  }

  const { searchKeyword, maxItems = -1 } = req.body;
  
  if (!searchKeyword) {
    return res.status(400).json({ error: '请提供搜索关键词' });
  }

  // 更新环境变量
  process.env.SEARCH_KEYWORD = searchKeyword;
  
  // 更新 .env 文件
  try {
    const envContent = `SEARCH_KEYWORD=${searchKeyword}\nMAX_ITEMS=${maxItems}`;
    fs.writeFileSync(path.join(__dirname, '.env'), envContent, 'utf8');
  } catch (error) {
    addLog(`写入.env文件失败: ${error.message}`, 'warning');
  }

  addLog(`开始执行自动化任务，关键词: ${searchKeyword}`, 'info');
  
  // 启动 Worker 线程
  const scriptPath = path.join(__dirname, 'src', 'main.js');
  currentProcess = startNodeProcess(scriptPath, {
    searchKeyword: searchKeyword,
    maxItems: maxItems,
    targetUrl: process.env.TARGET_URL || 'https://work.weixin.qq.com/wework_admin/frame#/chatGroup'
  });
  
  isRunning = true;
  
  // 监听 Worker 消息
  currentProcess.on('message', (message) => {
    if (message.type === 'log') {
      addLog(message.data, 'info');
    } else if (message.type === 'error') {
      addLog(message.data, 'error');
    }
  });
  
  currentProcess.on('exit', (code) => {
    isRunning = false;
    currentProcess = null;
    addLog(`任务完成，退出代码: ${code}`, code === 0 ? 'success' : 'error');
  });
  
  currentProcess.on('error', (error) => {
    isRunning = false;
    currentProcess = null;
    addLog(`任务执行错误: ${error.message}`, 'error');
  });
  
  res.json({ success: true, message: '任务已启动' });
});

app.post('/api/stop', (req, res) => {
  if (!isRunning || !currentProcess) {
    return res.status(400).json({ error: '没有正在运行的任务' });
  }
  
  try {
    // 终止 Worker 线程
    currentProcess.terminate();
    addLog('用户手动停止任务', 'warning');
  } catch (error) {
    addLog(`停止任务失败: ${error.message}`, 'error');
  }
  
  res.json({ success: true, message: '任务已停止' });
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    platform: os.platform(),
    isPkg,
    timestamp: new Date().toISOString()
  });
});

// 启动服务器
app.listen(PORT, () => {
  addLog(`服务器启动成功，访问地址: http://localhost:${PORT}`, 'success');
  addLog(`运行平台: ${os.platform()} ${os.arch()}`, 'info');
  addLog(`打包模式: ${isPkg ? '是' : '否'}`, 'info');
  
  // 延迟1秒后自动打开浏览器
  setTimeout(() => {
    openBrowser(`http://localhost:${PORT}`);
  }, 1000);
});

// 优雅关闭
process.on('SIGINT', () => {
  addLog('收到关闭信号，正在关闭服务器...', 'warning');
  if (currentProcess) {
    try {
      if (isWindows) {
        // Windows下使用taskkill强制终止进程
        safeSpawn('taskkill', ['/pid', currentProcess.pid, '/f', '/t'], {
          shell: true,
          windowsHide: true
        });
      } else {
        currentProcess.kill('SIGTERM');
      }
    } catch (killError) {
      console.error(`终止进程失败: ${killError.message}`);
      // 尝试使用Worker的terminate方法
      if (currentProcess.terminate) {
        currentProcess.terminate();
      }
    }
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  addLog('收到终止信号，正在关闭服务器...', 'warning');
  if (currentProcess) {
    try {
      if (isWindows) {
        // Windows下使用taskkill强制终止进程
        safeSpawn('taskkill', ['/pid', currentProcess.pid, '/f', '/t'], {
          shell: true,
          windowsHide: true
        });
      } else {
        currentProcess.kill('SIGTERM');
      }
    } catch (killError) {
      console.error(`终止进程失败: ${killError.message}`);
      // 尝试使用Worker的terminate方法
      if (currentProcess.terminate) {
        currentProcess.terminate();
      }
    }
  }
  process.exit(0);
});