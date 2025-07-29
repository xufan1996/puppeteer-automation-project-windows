@echo off
chcp 65001 >nul
echo 开始构建Windows版本...
echo.

echo 1. 清理旧的构建文件...
if exist dist rmdir /s /q dist

echo 2. 安装依赖...
npm install

echo 3. 下载Chrome浏览器...
node install-chrome.js

echo 4. 构建可执行文件...
npm run build-win

echo 5. 复制Chrome浏览器文件...
set CHROME_SOURCE=%USERPROFILE%\.cache\puppeteer\chrome
set CHROME_DEST=dist\chrome
if exist "%CHROME_SOURCE%" (
    echo 复制Chrome文件到打包目录...
    xcopy "%CHROME_SOURCE%" "%CHROME_DEST%" /s /e /i /y
) else (
    echo 警告: 未找到Chrome浏览器文件
)

echo 6. 复制其他必要文件...
if not exist dist\public mkdir dist\public
xcopy public\* dist\public\ /s /e /y
if not exist dist\src mkdir dist\src
xcopy src\* dist\src\ /s /e /y
copy .env dist\
copy README.txt dist\
copy start.bat dist\

echo.
echo 构建完成！
echo 可执行文件位置: dist\puppeteer-automation.exe
echo.
pause