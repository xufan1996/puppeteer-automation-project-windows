# Puppeteer 自动化工具 - 跨平台支持

本项目支持 Windows 和 macOS 平台，提供了完整的跨平台解决方案。

## 支持的平台

- **Windows** (x64)
- **macOS** (Intel x64)
- **macOS** (Apple Silicon ARM64)

## 快速开始

### Windows 平台

#### 安装依赖
```bash
# 双击运行或在命令行执行
install.bat
```

#### 启动应用
```bash
# 双击运行或在命令行执行
start.bat
# 或者使用 Windows 专用脚本
start-windows.bat
```

#### 构建可执行文件
```bash
# 双击运行或在命令行执行
build-windows.bat
```

### macOS 平台

#### 安装依赖
```bash
# 在终端中执行
./install-mac.sh
```

#### 启动应用
```bash
# 在终端中执行
./start-mac.sh
```

#### 构建可执行文件
```bash
# 在终端中执行
./build-mac.sh
```

## 开发环境

### 通用命令（所有平台）

```bash
# 安装依赖
npm install

# 下载 Chrome 浏览器
node install-chrome.js

# 启动开发服务器
npm start
# 或
npm run dev

# 构建所有平台的可执行文件
npm run build-all

# 单独构建特定平台
npm run build-win      # Windows x64
npm run build-mac      # macOS Intel x64
npm run build-mac-arm  # macOS Apple Silicon ARM64
```

## 平台特定功能

### Chrome 浏览器支持

项目会自动检测平台并下载对应的 Chrome 浏览器：

- **Windows**: `chrome-win64`
- **macOS Intel**: `chrome-mac-x64`
- **macOS ARM**: `chrome-mac-arm64`

### 路径检测

项目包含智能的 Chrome 路径检测逻辑：

1. **开发环境**: 自动检测项目目录下的 Chrome
2. **打包环境**: 检测可执行文件同目录下的 Chrome
3. **系统环境**: 回退到系统安装的 Chrome

## 文件结构

```
project/
├── build-windows.bat    # Windows 构建脚本
├── build-mac.sh         # macOS 构建脚本
├── start-windows.bat    # Windows 启动脚本
├── start-mac.sh         # macOS 启动脚本
├── install.bat          # Windows 安装脚本
├── install-mac.sh       # macOS 安装脚本
├── start.bat            # 通用启动脚本
├── src/
│   ├── chrome-path.js   # 跨平台 Chrome 路径检测
│   ├── pkg-chrome-helper.js # pkg 打包 Chrome 路径处理
│   └── ...
└── ...
```

## 注意事项

### Windows
- 需要 Node.js 18+ 版本
- 建议使用管理员权限运行安装脚本
- 防火墙可能会询问网络访问权限，请允许

### macOS
- 需要 Node.js 18+ 版本
- 首次运行可能需要在"系统偏好设置 > 安全性与隐私"中允许应用运行
- 脚本需要可执行权限（已自动设置）

### 通用
- 确保端口 3000 未被占用
- 首次运行会自动下载 Chrome 浏览器（约 100MB）
- 建议在稳定的网络环境下进行安装

## 故障排除

### Chrome 下载失败
```bash
# 手动下载 Chrome
node install-chrome.js
```

### 端口占用
```bash
# Windows
netstat -ano | findstr :3000

# macOS
lsof -i :3000
```

### 权限问题（macOS）
```bash
# 重新设置脚本权限
chmod +x *.sh
```

## 技术支持

如果遇到平台相关的问题，请检查：

1. Node.js 版本是否为 18+
2. Chrome 是否正确下载到 `chrome/` 目录
3. 防火墙/安全软件是否阻止了应用
4. 端口 3000 是否被占用

更多信息请查看项目日志文件：
- Windows: `logs/startup_*.log`
- macOS: `logs/startup_*.log`