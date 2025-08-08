#!/bin/bash
echo "正在启动 Puppeteer 自动化工具..."
echo

# 创建日志目录
mkdir -p logs

# 设置日志文件
LOG_FILE="logs/startup_$(date +%Y%m%d_%H%M%S).log"

echo "启动时间: $(date)" > "$LOG_FILE"
echo "系统信息: $(uname -a)" >> "$LOG_FILE"

# 检查端口
echo "检查端口3000..." >> "$LOG_FILE"
lsof -i :3000 >> "$LOG_FILE" 2>&1

# 检查Chrome目录
if [ -d "chrome" ]; then
    echo "Chrome目录存在" >> "$LOG_FILE"
    find chrome -type f -name "*Chrome*" >> "$LOG_FILE"
else
    echo "Chrome目录不存在" >> "$LOG_FILE"
fi

# 创建默认环境变量文件
if [ ! -f ".env" ]; then
    echo "创建默认环境变量文件" >> "$LOG_FILE"
    cp .env.example .env
fi

# 启动应用
echo "启动Node.js应用..." >> "$LOG_FILE"
echo "启动Node.js应用..."
node server.js 2>&1 | tee -a "$LOG_FILE"

# 如果应用退出，显示错误信息
if [ $? -ne 0 ]; then
    echo "应用启动失败，请查看日志文件: $LOG_FILE"
    echo "按任意键退出..."
    read -n 1
fi