@echo off
chcp 65001 >nul
echo 正在启动 Puppeteer 自动化工具...
echo.

:: 创建日志目录
if not exist logs mkdir logs

:: 设置日志文件
set LOG_FILE=logs\startup_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%.log
set LOG_FILE=%LOG_FILE: =0%

echo 启动时间: %date% %time% > %LOG_FILE%
echo 系统信息: %OS% >> %LOG_FILE%

:: 检查端口
netstat -ano | findstr :3000 >> %LOG_FILE%

:: 检查Chrome目录
if exist chrome (
    echo Chrome目录存在 >> %LOG_FILE%
    dir chrome /s /b >> %LOG_FILE%
) else (
    echo Chrome目录不存在 >> %LOG_FILE%
)

:: 创建默认环境变量文件
if not exist .env (
    echo 创建默认环境变量文件 >> %LOG_FILE%
    copy .env.example .env
)

:: 启动浏览器
start http://localhost:3000

:: 启动应用并记录输出
echo 正在启动应用... >> %LOG_FILE%
puppeteer-automation.exe >> %LOG_FILE% 2>&1

echo 应用已退出，错误代码: %errorlevel% >> %LOG_FILE%
echo 如果应用闪退，请查看日志文件: %LOG_FILE%
pause