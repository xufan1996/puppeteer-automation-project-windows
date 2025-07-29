import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import os from 'os';

// 配置环境变量
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 检测是否为打包后的可执行文件
const isPkg = typeof process.pkg !== 'undefined';
const isWindows = os.platform() === 'win32';

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
const startNodeProcess = (scriptPath, env) => {
  if (isWindows) {
    // Windows下使用cmd启动
    return spawn('cmd', ['/c', 'node', scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
      cwd: __dirname,
      windowsHide: true // 隐藏命令行窗口
    });
  } else {
    // Unix系统
    return spawn('node', [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
      cwd: __dirname
    });
  }
};

// 自动打开浏览器的函数
const openBrowser = (url) => {
  try {
    if (isWindows) {
      spawn('cmd', ['/c', 'start', url], { windowsHide: true });
    } else if (os.platform() === 'darwin') {
      spawn('open', [url]);
    } else {
      spawn('xdg-open', [url]);
    }
  } catch (error) {
    addLog(`无法自动打开浏览器: ${error.message}`, 'warning');
    addLog(`请手动访问: ${url}`, 'info');
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
  
  // 启动子进程
  const scriptPath = path.join(__dirname, 'src', 'main.js');
  currentProcess = startNodeProcess(scriptPath, {
    SEARCH_KEYWORD: searchKeyword,
    MAX_ITEMS: maxItems
  });
  
  isRunning = true;
  
  // 监听输出
  currentProcess.stdout.on('data', (data) => {
    const message = data.toString().trim();
    if (message) {
      addLog(message, 'info');
    }
  });
  
  currentProcess.stderr.on('data', (data) => {
    const message = data.toString().trim();
    if (message) {
      addLog(message, 'error');
    }
  });
  
  currentProcess.on('close', (code) => {
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
    if (isWindows) {
      // Windows下强制终止进程
      spawn('taskkill', ['/pid', currentProcess.pid, '/f', '/t'], { windowsHide: true });
    } else {
      currentProcess.kill('SIGTERM');
    }
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
    currentProcess.kill('SIGTERM');
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  addLog('收到终止信号，正在关闭服务器...', 'warning');
  if (currentProcess) {
    currentProcess.kill('SIGTERM');
  }
  process.exit(0);
});