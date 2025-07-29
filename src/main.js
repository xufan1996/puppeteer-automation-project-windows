import puppeteer from 'puppeteer';
import fs from 'fs';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';

// Configure dotenv
dotenv.config();

// 获取Chrome可执行文件路径
const getChromePath = () => {
  const platform = os.platform();
  const homeDir = os.homedir();
  
  // 检测是否为打包后的可执行文件
  const isPkg = typeof process.pkg !== 'undefined';
  
  if (isPkg) {
    // 打包后的路径
    const execDir = path.dirname(process.execPath);
    if (platform === 'win32') {
      return path.join(execDir, 'chrome', 'win64-116.0.5793.0', 'chrome-win64', 'chrome.exe');
    } else if (platform === 'darwin') {
      return path.join(execDir, 'chrome', 'mac-116.0.5793.0', 'chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
    } else {
      return path.join(execDir, 'chrome', 'linux-116.0.5793.0', 'chrome-linux64', 'chrome');
    }
  } else {
    // 开发环境路径
    const cacheDir = path.join(homeDir, '.cache', 'puppeteer');
    if (platform === 'win32') {
      return path.join(cacheDir, 'chrome', 'win64-116.0.5793.0', 'chrome-win64', 'chrome.exe');
    } else if (platform === 'darwin') {
      return path.join(cacheDir, 'chrome', 'mac-116.0.5793.0', 'chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
    } else {
      return path.join(cacheDir, 'chrome', 'linux-116.0.5793.0', 'chrome-linux64', 'chrome');
    }
  }
};

// 全局变量存储认证信息
global.authData = null;

// 延迟函数
const delay = (min, max) => {
  const time = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, time));
};

// 等待元素变化的通用函数
const waitForElementChange = async (page, options = {}) => {
  const {
    selector,
    changeType = 'disappear', // 'disappear', 'appear', 'count', 'content'
    timeout = 10000,
    expectedCount = null,
    checkInterval = 100
  } = options;
  
  console.log(`等待元素变化: ${selector} (${changeType})`);
  const startTime = Date.now();
  
  try {
    switch (changeType) {
      case 'disappear':
        await page.waitForSelector(selector, { hidden: true, timeout });
        break;
        
      case 'appear':
        await page.waitForSelector(selector, { visible: true, timeout });
        break;
        
      case 'count':
        await page.waitForFunction(
          (sel, expected) => {
            const elements = document.querySelectorAll(sel);
            return elements.length === expected;
          },
          { timeout },
          selector,
          expectedCount
        );
        break;
        
      case 'content':
        await page.waitForFunction(
          (sel) => {
            const element = document.querySelector(sel);
            return element && element.textContent.trim() !== '';
          },
          { timeout },
          selector
        );
        break;
    }
    
    const endTime = Date.now();
    console.log(`✅ 元素变化检测完成，耗时: ${endTime - startTime}ms`);
    return true;
    
  } catch (error) {
    console.log(`⚠️ 元素变化检测超时: ${error.message}`);
    return false;
  }
};


// 截图保存函数
const saveScreenshot = async (page, name) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshots/${name}_${timestamp}.png`;
    
    // 确保screenshots目录存在
    if (!fs.existsSync('screenshots')) {
      fs.mkdirSync('screenshots', { recursive: true });
    }
    
    await page.screenshot({ path: filename, fullPage: true });
    console.log(`截图已保存: ${filename}`);
  } catch (error) {
    console.error('保存截图失败:', error);
  }
};


// 执行搜索的辅助函数
const performSearch = async (page, searchKeyword) => {
  try {
    const searchInput = await page.$('.qui_inputText.ww_inputText.ww_searchInput_text.js_cs_index_search_input');
    
    if (searchInput) {
      await searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await delay(1000, 2000);
      
      await searchInput.click();
      await searchInput.evaluate(el => el.value = '');
      await searchInput.type(searchKeyword);
      await searchInput.press('Enter');
      
      await delay(1000, 2000);
      
      try {
        await page.waitForLoadState('networkidle', { timeout: 10000 });
      } catch (networkError) {
        console.log('⚠️ 网络空闲等待超时，但继续执行');
      }
    }
  } catch (error) {
    console.error('搜索执行失败:', error);
  }
};

// 导航到指定页面的辅助函数
const navigateToPage = async (page, targetPage) => {
  try {
    for (let i = 1; i < targetPage; i++) {
      const nextPageButton = await page.$('.next-page, .pagination-next, [aria-label="下一页"]');
      
      if (nextPageButton) {
        const isDisabled = await page.evaluate(el => {
          return el.disabled || el.classList.contains('disabled') || el.getAttribute('aria-disabled') === 'true';
        }, nextPageButton);
        
        if (!isDisabled) {
          await nextPageButton.click();
          await delay(2000, 3000);
        } else {
          break;
        }
      } else {
        break;
      }
    }
  } catch (error) {
    console.error('页面导航失败:', error);
  }
};

// 处理列表数据的函数（多线程版本）
const processListData = async (page, maxItems = -1) => {
  try {
    console.log('开始处理列表数据...');
    
    // 获取搜索关键词配置
    const searchKeyword = process.env.SEARCH_KEYWORD;
    let hasSearched = false;
    
    // 如果配置了搜索关键词，先执行搜索
    if (searchKeyword && searchKeyword.trim() !== '') {
      console.log(`检测到搜索关键词配置: ${searchKeyword}`);
      
      try {
        // 查找搜索输入框
        console.log('查找搜索输入框...');
        const searchInput = await page.$('.qui_inputText.ww_inputText.ww_searchInput_text.js_cs_index_search_input');
        
        if (searchInput) {
          console.log('找到搜索输入框，准备输入搜索关键词...');
          
          // 确保搜索框在视窗中可见
          await searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await delay(1000, 2000);
          
          // 清空搜索框并输入搜索关键词
          await searchInput.click();
          await searchInput.evaluate(el => el.value = '');
          await searchInput.type(searchKeyword);
          
          console.log(`✅ 成功在搜索框中输入关键词: ${searchKeyword}`);
          
          // 触发搜索 - 按回车键
          await searchInput.press('Enter');
          console.log('🔍 已按回车键触发搜索');
          
          // 等待搜索结果加载
          console.log('等待搜索结果加载...');
          await delay(1000, 2000);
          
          // 可选：等待页面网络请求完成
          try {
            await page.waitForLoadState('networkidle', { timeout: 10000 });
            console.log('✅ 搜索结果加载完成');
          } catch (networkError) {
            console.log('⚠️ 网络空闲等待超时，但继续执行');
          }
          
          hasSearched = true;
          
        } else {
          console.log('⚠️ 未找到搜索输入框，跳过搜索功能');
        }
        
      } catch (searchError) {
        console.log('搜索功能执行失败:', searchError.message);
        console.log('继续执行后续流程...');
      }
    } else {
      console.log('未配置搜索关键词，跳过搜索功能');
    }
    
    // 根据搜索状态和MAX_ITEMS配置调整处理策略
    let effectiveMaxItems = maxItems;
    if (maxItems === -1 && hasSearched) {
      console.log('🔍 检测到搜索模式且MAX_ITEMS为-1，将处理搜索结果中的所有列表项');
      effectiveMaxItems = -1; // 保持为-1，处理所有搜索结果
    } else if (maxItems === -1 && !hasSearched) {
      console.log('📋 未执行搜索且MAX_ITEMS为-1，将处理所有列表项');
      effectiveMaxItems = -1; // 保持为-1，处理所有列表项
    } else {
      console.log(`📊 使用配置的MAX_ITEMS限制: ${maxItems}`);
      effectiveMaxItems = maxItems;
    }
    
    let currentPage = 1;
    let totalProcessedCount = 0;
    let hasMorePages = true;
    
    // 获取主浏览器实例
    const browser = page.browser();
    
    while (hasMorePages && (effectiveMaxItems === -1 || totalProcessedCount < effectiveMaxItems)) {
      console.log(`\n=== 处理第 ${currentPage} 页数据 ===`);
      
      // 等待页面加载完成
      await delay(1000, 2000);
      
      // 查找列表项 - 专门查找指定表格下的tbody中的tr元素
      const listItems = await page.$$('.ww_table.csPlugin_index_table tbody tr');
      console.log(`当前页面找到 ${listItems.length} 个列表项`);
      
      if (listItems.length === 0) {
        console.log('当前页面没有找到列表项，结束处理');
        break;
      }
      
      // 计算本页需要处理的数据数量
      let itemsToProcess = listItems.length;
      if (effectiveMaxItems !== -1) {
        const remaining = effectiveMaxItems - totalProcessedCount;
        itemsToProcess = Math.min(itemsToProcess, remaining);
      }
      
      console.log(`\n🚀 启动 ${itemsToProcess} 个并发进程处理数据...`);
      
      // 创建并发进程任务数组
      const concurrentProcesses = [];
      
      // 在 processListData 函数中，修改创建 taskData 的部分
      for (let i = 0; i < itemsToProcess; i++) {
      // 获取当前列表项的编辑链接
      const currentItem = listItems[i];
      const editButton = await currentItem.$('.js_csPlugin_go2edit');
      let editUrl = '';
      
      if (editButton) {
        editUrl = await editButton.evaluate(el => el.href);
        console.log(`获取到第 ${i + 1} 项的编辑链接: ${editUrl}`);
      }
      
      // 为每个数据项创建独立的进程任务
      const taskData = {
        itemIndex: i,
        pageNumber: currentPage,
        searchKeyword: searchKeyword,
        targetUrl: process.env.TARGET_URL || 'https://work.weixin.qq.com/wework_admin/frame#/chatGroup',
        editUrl: editUrl, // 新增编辑链接
        authData: global.authData // 传递认证信息
      };
      
        const processPromise = new Promise((resolve, reject) => {
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = path.dirname(__filename);
          const workerPath = path.join(__dirname, 'worker.js');
          
          const childProcess = spawn('node', [workerPath, JSON.stringify(taskData)], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env }
          });
          
          let stdout = '';
          let stderr = '';
          
          childProcess.stdout.on('data', (data) => {
            stdout += data.toString();
            console.log(`[Process ${childProcess.pid}] ${data.toString().trim()}`);
          });
          
          childProcess.stderr.on('data', (data) => {
            stderr += data.toString();
            console.error(`[Process ${childProcess.pid}] ERROR: ${data.toString().trim()}`);
          });
          
          childProcess.on('close', (code) => {
            if (code === 0) {
              console.log(`✅ 进程 ${childProcess.pid} (任务 ${i + 1}) 处理成功`);
              resolve(true);
            } else {
              console.log(`❌ 进程 ${childProcess.pid} (任务 ${i + 1}) 处理失败，退出码: ${code}`);
              resolve(false);
            }
          });
          
          childProcess.on('error', (error) => {
            console.error(`❌ 进程 ${childProcess.pid} (任务 ${i + 1}) 启动失败:`, error);
            reject(error);
          });
        });
        
        concurrentProcesses.push(processPromise);
      }
      
      // 并发执行所有进程
      const results = await Promise.allSettled(concurrentProcesses);
      
      // 统计处理结果
      let successCount = 0;
      let failureCount = 0;
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value === true) {
          successCount++;
        } else {
          failureCount++;
        }
      });
      
      totalProcessedCount += successCount;
      console.log(`\n📊 本页处理完成: 成功 ${successCount} 条，失败 ${failureCount} 条，总计处理 ${totalProcessedCount} 条`);
      
      // 检查是否有下一页（只有在需要处理更多数据时才翻页）
      if (effectiveMaxItems === -1 || totalProcessedCount < effectiveMaxItems) {
        console.log('\n检查是否有下一页...');
        const nextPageButton = await page.$('.next-page, .pagination-next, [aria-label="下一页"]');
        
        if (nextPageButton) {
          const isDisabled = await page.evaluate(el => {
            return el.disabled || el.classList.contains('disabled') || el.getAttribute('aria-disabled') === 'true';
          }, nextPageButton);
          
          if (!isDisabled) {
            console.log('找到下一页按钮，准备翻页...');
            await nextPageButton.click();
            await delay(3000, 5000);
            currentPage++;
          } else {
            console.log('下一页按钮已禁用，没有更多页面');
            hasMorePages = false;
          }
        } else {
          console.log('未找到下一页按钮，没有更多页面');
          hasMorePages = false;
        }
      } else {
        console.log('已达到处理数量限制，停止翻页');
        hasMorePages = false;
      }
    }
    
    console.log(`\n=== 多进程数据处理完成 ===`);
    if (hasSearched) {
      console.log(`🔍 搜索关键词: ${searchKeyword}`);
    }
    console.log(`📊 总共处理了 ${totalProcessedCount} 条数据`);
    
  } catch (error) {
    console.error('处理列表数据时出错:', error);
  }
};


(async () => {
  let browser;
  let page;
  
  try {
    console.log('启动浏览器...');
    
    // 从环境变量或命令行参数获取配置
    const maxItems = parseInt(process.env.MAX_ITEMS) || parseInt(process.argv[2]) || -1;
    const searchKeyword = process.env.SEARCH_KEYWORD || null;
    
    // 显示处理策略
    if (maxItems === -1 && searchKeyword && searchKeyword.trim() !== '') {
      console.log('🔍 处理策略: 搜索模式 - 处理搜索结果中的所有列表项');
      console.log(`配置的搜索关键词: ${searchKeyword}`);
    } else if (maxItems === -1) {
      console.log('📋 处理策略: 全量模式 - 处理所有列表项');
    } else {
      console.log(`📊 处理策略: 限量模式 - 最多处理 ${maxItems} 条数据`);
    }
    
    // 搜索关键词日志输出
    if (searchKeyword && searchKeyword.trim() !== '') {
      console.log(`配置的搜索关键词: ${searchKeyword}`);
    } else {
      console.log('配置的搜索关键词: 无');
    }
    
  
    // 启动浏览器 - 设置为可视化模式
    browser = await puppeteer.launch({
      headless: false, // 设置为false以显示浏览器窗口
      devtools: false, // 可选：是否打开开发者工具
      slowMo: 100, // 可选：每个操作之间的延迟（毫秒），便于观察
      defaultViewport: null, // 使用默认视口大小
      args: [
        '--start-maximized', // 启动时最大化窗口
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    // 创建新页面
    page = await browser.newPage();
    
    // 设置用户代理
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // 设置视口大小（如果需要）
    await page.setViewport({ width: 1920, height: 1080 });
    
    console.log('浏览器启动成功，开始导航到企业微信登录页面...');
    
    // 1. 导航到企业微信登录页面
    await page.goto('https://work.weixin.qq.com/wework_admin/loginpage_wx', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('已到达企业微信登录页面，请扫描二维码登录...');
    
    // 2. 等待用户扫码登录 - 每60秒刷新一次页面，直到到达工作台页面
    console.log('等待二维码登录...');
    let loginSuccess = false;
    let refreshCount = 0;
    const maxRefreshAttempts = 10; // 最多刷新10次（10分钟）
    
    while (!loginSuccess && refreshCount < maxRefreshAttempts) {
      try {
        console.log(`等待登录中... (第${refreshCount + 1}次检查)`);
        
        // 等待60秒或者页面跳转（以先发生的为准）
        const navigationPromise = page.waitForNavigation({ 
          waitUntil: 'networkidle2', 
          timeout: 60000 // 60秒超时
        });
        
        try {
          await navigationPromise;
          console.log('检测到页面跳转，检查是否到达工作台...');
          
          // 检查当前页面是否是工作台页面
          const currentUrl = page.url();
          console.log(`当前页面URL: ${currentUrl}`);
          
          if (currentUrl.includes('work.weixin.qq.com/wework_admin/frame')) {
            console.log('✅ 已到达工作台页面，登录流程完成！');
            loginSuccess = true;
            break;
          } else if (currentUrl.includes('work.weixin.qq.com') && !currentUrl.includes('login')) {
            console.log('检测到已登录但未到达工作台，可能在短信验证页面，继续等待...');
            // 继续等待，不增加刷新计数
            continue;
          } else {
            console.log('页面跳转但未检测到登录成功，继续等待...');
          }
          
        } catch (timeoutError) {
          // 60秒超时，检查当前页面状态
          console.log('60秒等待超时，检查当前页面状态...');
          const currentUrl = page.url();
          console.log(`当前页面URL: ${currentUrl}`);
          
          if (currentUrl.includes('work.weixin.qq.com/wework_admin/frame')) {
            console.log('✅ 检测到已在工作台页面，登录流程完成！');
            loginSuccess = true;
            break;
          } else if (currentUrl.includes('work.weixin.qq.com') && !currentUrl.includes('login')) {
            console.log('检测到已登录但未到达工作台，可能在短信验证页面，继续等待...');
            // 继续等待，不刷新页面，不增加刷新计数
            continue;
          } else {
            // 仍在登录页面，刷新页面
            refreshCount++;
            console.log(`仍在登录页面，刷新页面 (第${refreshCount}次刷新)...`);
            
            await page.reload({ 
              waitUntil: 'networkidle2',
              timeout: 30000 
            });
            
            console.log('页面已刷新，请重新扫描二维码');
            await delay(2000, 3000); // 刷新后等待一下
          }
        }
        
      } catch (error) {
        console.error('登录检查过程中出错:', error);
        const currentUrl = page.url();
        
        // 即使出错也检查一下是否已经在工作台
        if (currentUrl.includes('work.weixin.qq.com/wework_admin/frame')) {
          console.log('✅ 虽然出现错误，但检测到已在工作台页面，继续执行');
          loginSuccess = true;
          break;
        }
        
        refreshCount++;
        
        if (refreshCount < maxRefreshAttempts) {
          console.log('尝试刷新页面继续等待登录...');
          try {
            await page.reload({ 
              waitUntil: 'networkidle2',
              timeout: 30000 
            });
            await delay(2000, 3000);
          } catch (reloadError) {
            console.error('页面刷新失败:', reloadError);
          }
        }
      }
    }
    
    if (!loginSuccess) {
      throw new Error(`登录失败：已尝试刷新${maxRefreshAttempts}次，仍未检测到到达工作台页面`);
    }
    
    // 3. 导航到工作台后直接跳转到群聊管理页面
    console.log('导航到工作台...');
    await page.goto('https://work.weixin.qq.com/wework_admin/frame', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await delay(3000, 5000);
    
    // 4. 直接跳转到群聊管理页面
    console.log('直接跳转到群聊管理页面...');
    await page.goto('https://work.weixin.qq.com/wework_admin/frame#chatGroup', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    console.log('✅ 已成功跳转到群聊管理页面');
    await delay(3000, 5000);
    
    // 收集认证信息用于子进程共享
    console.log('收集认证信息...');
    const cookies = await page.cookies();
    const localStorage = await page.evaluate(() => {
      const storage = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        storage[key] = localStorage.getItem(key);
      }
      return storage;
    });
    const userAgent = await page.evaluate(() => navigator.userAgent);
    
    // 存储认证信息到全局变量
    global.authData = {
      cookies,
      localStorage,
      userAgent,
      targetUrl: 'https://work.weixin.qq.com/wework_admin/frame#/chatGroup'
    };
    
    console.log(`✅ 认证信息收集完成: ${cookies.length} 个Cookie, ${Object.keys(localStorage).length} 个localStorage项`);
    
    // 5. 处理列表数据
    await processListData(page, maxItems);
    
    console.log('✅ 自动化流程执行完成！');
    
  } catch (error) {
    console.error('❌ 自动化脚本执行失败:', error);
    if (page) {
      await saveScreenshot(page, 'error');
    }
  } finally {
    // 保持浏览器打开以便查看结果
    console.log('脚本执行结束，浏览器将保持打开状态以便查看结果');
    console.log('如需关闭浏览器，请手动关闭或按 Ctrl+C 终止程序');
    // 注释掉自动关闭浏览器的代码
    // await browser?.close();
  }
})();