Puppeteer 自动化工具 - Windows版本
=====================================

使用方法：
1. 双击 puppeteer-automation.exe 启动程序
2. 程序会自动打开浏览器访问 http://localhost:3000
3. 在界面中输入搜索关键词
4. 点击"开始执行"启动自动化任务
5. 实时查看执行日志
6. 可随时点击"停止执行"终止任务

开发构建：
如需重新构建可执行文件：
1. 安装依赖：npm install
2. 构建：npm run build

注意事项：
- 首次运行时Windows防火墙可能会询问，请选择"允许访问"
- 确保网络连接正常
- 程序运行期间请勿关闭命令行窗口
- 截图文件保存在 screenshots 目录下

故障排除：
- 如果浏览器没有自动打开，请手动访问 http://localhost:3000
- 如果端口3000被占用，程序会自动选择其他端口
- 遇到问题请查看命令行窗口的错误信息

技术支持：
- GitHub: https://github.com/NaN-ztn/puppeteer-automation-project-windows
- 如有问题请提交Issue