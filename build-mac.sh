#!/bin/bash
echo "开始构建Mac版本..."
echo

echo "1. 清理旧的构建文件..."
rm -rf dist

echo "2. 安装依赖..."
npm install

echo "3. 下载Chrome浏览器..."
node install-chrome.js

echo "4. 构建可执行文件..."
npm run build-mac

echo "5. 复制Chrome浏览器文件..."
CHROME_SOURCE="$HOME/.cache/puppeteer/chrome"
CHROME_DEST="dist/chrome"
if [ -d "$CHROME_SOURCE" ]; then
    echo "复制Chrome文件到打包目录..."
    cp -r "$CHROME_SOURCE" "$CHROME_DEST"
else
    echo "警告: 未找到Chrome浏览器文件"
fi

echo "6. 复制其他必要文件..."
mkdir -p dist/public
cp -r public/* dist/public/
mkdir -p dist/src
cp -r src/* dist/src/
cp .env dist/ 2>/dev/null || cp .env.example dist/.env
cp README.txt dist/
cp start-mac.sh dist/

echo
echo "构建完成！"
echo "可执行文件位置: dist/puppeteer-automation"
echo
read -p "按任意键继续..."