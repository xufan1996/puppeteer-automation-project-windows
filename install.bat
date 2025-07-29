@echo off
chcp 65001 >nul
echo 正在安装依赖...
echo.
npm install
echo.
echo 正在下载Chrome浏览器...
node install-chrome.js
echo.
echo 安装完成！
echo 运行 start.bat 启动应用
pause