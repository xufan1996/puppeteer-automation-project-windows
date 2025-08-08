const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// 检测是否为打包后的可执行文件
const isPkg = typeof process.pkg !== 'undefined';

// 加载环境变量 - 根据环境选择正确的配置文件路径
const loadEnvConfig = () => {
  if (isPkg) {
    // 打包后的可执行文件，从可执行文件目录加载.env
    const execDir = path.dirname(process.execPath);
    const envPath = path.join(execDir, '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
    }
  } else {
    // 开发环境，从项目根目录加载.env
    dotenv.config();
  }
};

module.exports = { isPkg, loadEnvConfig };