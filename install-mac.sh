#!/bin/bash
echo "正在安装依赖..."
echo
npm install
echo
echo "正在下载Chrome浏览器..."
node install-chrome.js
echo
echo "安装完成！"
echo "运行 ./start-mac.sh 启动应用"
echo "按任意键继续..."
read -n 1