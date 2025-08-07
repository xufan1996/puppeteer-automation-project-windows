const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { getChromePath, delay, smartWait } = require('./chrome-path');
const { loadEnvConfig } = require('./env-config');

// 加载环境配置
loadEnvConfig();

// 日志函数
const log = (message) => {
  console.log(message);
};

const logError = (message) => {
  console.error(message);
};

// 全局变量存储认证信息
global.authData = null;

// 处理列表数据的函数（多线程版本）
const processListData = async (page, maxItems = -1) => {
  try {
    log('开始处理列表数据...');
    
    // 获取搜索关键词配置
    const searchKeyword = process.env.SEARCH_KEYWORD;
    let hasSearched = false;
    
    // 如果配置了搜索关键词，先执行搜索
    if (searchKeyword && searchKeyword.trim() !== '') {
      log(`检测到搜索关键词配置: ${searchKeyword}`);
      
      try {
        // 查找搜索输入框
        log('查找搜索输入框...');
        const searchInput = await page.$('.qui_inputText.ww_inputText.ww_searchInput_text.js_cs_index_search_input');
        
        if (searchInput) {
          log('找到搜索输入框，准备输入搜索关键词...');
          
          // 确保搜索框在视窗中可见
          await searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await smartWait(page, { fallbackDelay: [800, 1500] });
          
          // 清空搜索框并输入搜索关键词
          await searchInput.click();
          await searchInput.evaluate(el => el.value = '');
          await searchInput.type(searchKeyword);
          
          log(`✅ 成功在搜索框中输入关键词: ${searchKeyword}`);
          
          // 触发搜索 - 按回车键
          await searchInput.press('Enter');
          log('🔍 已按回车键触发搜索');
          
          // 等待搜索结果加载
          log('等待搜索结果加载...');
          await smartWait(page, { fallbackDelay: [800, 1500] });
          
          // 可选：等待页面网络请求完成
          try {
            await page.waitForLoadState('networkidle', { timeout: 10000 });
            await smartWait(page, { selector: 'body', action: 'stable', timeout: 5000 });
            log('✅ 搜索结果加载完成');
          } catch (networkError) {
            log('⚠️ 网络空闲等待超时，但继续执行');
          }
          
          hasSearched = true;
          
        } else {
          log('⚠️ 未找到搜索输入框，跳过搜索功能');
        }
        
      } catch (searchError) {
        log('搜索功能执行失败:', searchError.message);
        log('继续执行后续流程...');
      }
    } else {
      log('未配置搜索关键词，跳过搜索功能');
    }
    
    // 根据搜索状态和MAX_ITEMS配置调整处理策略
    let effectiveMaxItems = maxItems;
    if (maxItems === -1 && hasSearched) {
      log('🔍 检测到搜索模式且MAX_ITEMS为-1，将处理搜索结果中的所有列表项');
      effectiveMaxItems = -1; // 保持为-1，处理所有搜索结果
    } else if (maxItems === -1 && !hasSearched) {
      log('📋 未执行搜索且MAX_ITEMS为-1，将处理所有列表项');
      effectiveMaxItems = -1; // 保持为-1，处理所有列表项
    } else {
      log(`📊 使用配置的MAX_ITEMS限制: ${maxItems}`);
      effectiveMaxItems = maxItems;
    }
    
    let currentPage = 1;
    let totalProcessedCount = 0;
    let hasMorePages = true;
    
    // 获取主浏览器实例
    const browser = page.browser();
    
    while (hasMorePages && (effectiveMaxItems === -1 || totalProcessedCount < effectiveMaxItems)) {
      log(`\n=== 处理第 ${currentPage} 页数据 ===`);
      
      // 等待页面加载完成
      await smartWait(page, { selector: '.ww_table.csPlugin_index_table tbody tr', action: 'visible', timeout: 3000 });
      
      // 查找列表项 - 专门查找指定表格下的tbody中的tr元素
      const listItems = await page.$$('.ww_table.csPlugin_index_table tbody tr');
      log(`当前页面找到 ${listItems.length} 个列表项`);
      
      if (listItems.length === 0) {
        log('当前页面没有找到列表项，结束处理');
        break;
      }
      
      // 数据筛选：遍历每个列表项，查找指定class元素并进行HK和DD检测
      log('\n🔍 开始数据筛选，检测包含HK或DD的群组...');
      const validItems = [];
      
      // 遍历每个列表项进行单独检测
      for (let i = 0; i < listItems.length; i++) {
        const currentItem = listItems[i];
        log(`开始处理第 ${i + 1} 个列表项...`);
        
        // 查找当前列表项中的csPlugin_index_row_member ww_groupSelBtn_WithoutEdit元素
        const memberElements = await currentItem.$$('.csPlugin_index_row_member.ww_groupSelBtn_WithoutEdit');
        
        if (memberElements.length > 0) {
          log(`在第 ${i + 1} 个列表项中找到 ${memberElements.length} 个csPlugin_index_row_member ww_groupSelBtn_WithoutEdit元素`);
          
          // 如果有多个，选择最后一个进行悬停操作
          const lastElement = memberElements[memberElements.length - 1];
          const spanElement = await lastElement.$('span.ww_groupSelBtn_item_text');
          
          if (spanElement) {
            log(`找到第 ${i + 1} 个列表项最后一个元素的span.ww_groupSelBtn_item_text，开始模拟鼠标悬停...`);
            
            try {
              // 确保元素在视窗中可见
              await spanElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              await smartWait(page, { fallbackDelay: [300, 800] });
              
              // 模拟鼠标悬停
              await spanElement.hover();
              log(`✅ 成功模拟鼠标悬停在第 ${i + 1} 个列表项的最后一个span.ww_groupSelBtn_item_text元素上`);
              
              // 等待悬停效果显示
              await smartWait(page, { selector: '.customer_qunCard_title', action: 'visible', timeout: 3000 });
              
              // 获取悬停后显示的群卡片标题
              const titleElement = await page.$('.customer_qunCard_title');
              let titleText = '';
              if (titleElement) {
                titleText = await page.evaluate(el => el.textContent || el.innerText, titleElement);
                log(`第 ${i + 1} 个列表项的群名称标题: ${titleText}`);
              }
              
              // 获取悬停后显示的群管理员信息
              const adminElement = await page.$('.customer_qunCard_adminInfo');
              let adminText = '';
              if (adminElement) {
                adminText = await page.evaluate(el => el.textContent || el.innerText, adminElement);
                log(`第 ${i + 1} 个列表项的群主信息: ${adminText}`);
              }
              
              // 对群卡片标题进行HK和DD检测
              if (titleText && (titleText.includes('HK') || titleText.includes('DD'))) {
                log(`第 ${i + 1} 个列表项发现HK或DD文字: ${titleText}`);
                
                // 获取编辑链接并添加到处理队列
                const editButton = await currentItem.$('.js_csPlugin_go2edit');
                if (editButton) {
                  try {
                    const editUrl = await editButton.evaluate(el => el.href);
                    validItems.push({
                      index: i,
                      editUrl: editUrl,
                      validTitle: titleText,
                      validAdminInfo: adminText || ''
                    });
                    log(`✅ 第 ${i + 1} 项添加到处理队列: ${editUrl}`);
                  } catch (error) {
                    log(`⚠️ 第 ${i + 1} 项获取编辑链接失败: ${error.message}`);
                  }
                }
              } else if (titleText) {
                log(`第 ${i + 1} 个列表项标题不包含HK或DD，跳过: ${titleText}`);
              }
              
              // 移开鼠标，避免影响后续操作
              await page.mouse.move(0, 0);
              await smartWait(page, { selector: 'body', action: 'stable', timeout: 1000 });
              
            } catch (error) {
              log(`⚠️ 第 ${i + 1} 个列表项悬停操作失败: ${error.message}`);
            }
          } else {
            log(`⚠️ 在第 ${i + 1} 个列表项的最后一个csPlugin_index_row_member元素中未找到span.ww_groupSelBtn_item_text`);
          }
        } else {
          log(`⚠️ 在第 ${i + 1} 个列表项中未找到csPlugin_index_row_member ww_groupSelBtn_WithoutEdit元素`);
        }
      }
      
      log(`\n📊 数据筛选完成: 共检测 ${listItems.length} 项，通过 ${validItems.length} 项`);
      
      if (validItems.length === 0) {
        log('本页没有通过检测的数据，跳过处理');
        // 检查是否有下一页
        if (effectiveMaxItems === -1 || totalProcessedCount < effectiveMaxItems) {
          const nextPageButton = await page.$('.next-page, .pagination-next, [aria-label="下一页"]');
          if (nextPageButton) {
            await nextPageButton.click();
            await smartWait(page, { fallbackDelay: [1500, 2500] });
            currentPage++;
            continue;
          } else {
            hasMorePages = false;
            break;
          }
        } else {
          hasMorePages = false;
          break;
        }
      }
      
      // 计算本页需要处理的数据数量（基于筛选后的有效数据）
      let itemsToProcess = validItems.length;
      if (effectiveMaxItems !== -1) {
        const remaining = effectiveMaxItems - totalProcessedCount;
        itemsToProcess = Math.min(itemsToProcess, remaining);
      }
      
      // 设置合理的并发数量，避免系统资源耗尽
      const maxConcurrency = Math.min(4, itemsToProcess); // 最多4个并发进程
      const batchSize = maxConcurrency;
      
      log(`\n🚀 使用 ${maxConcurrency} 个并发进程分批处理 ${itemsToProcess} 项数据...`);
      
      // 分批处理数据
      for (let batchStart = 0; batchStart < itemsToProcess; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, itemsToProcess);
        const currentBatch = validItems.slice(batchStart, batchEnd);
        
        log(`\n处理第 ${Math.floor(batchStart / batchSize) + 1} 批数据 (${batchStart + 1}-${batchEnd})...`);
        
        // 创建当前批次的并发进程任务数组
        const concurrentProcesses = [];
        
        // 基于当前批次的有效数据创建任务
        for (let i = 0; i < currentBatch.length; i++) {
          const validItem = currentBatch[i];
          const globalIndex = batchStart + i;
          log(`准备处理第 ${globalIndex + 1} 项有效数据: ${validItem.editUrl}`);
      
        // 为每个数据项创建独立的进程任务
        const taskData = {
          itemIndex: validItem.index,
          pageNumber: currentPage,
          searchKeyword: searchKeyword,
          targetUrl: process.env.TARGET_URL || 'https://work.weixin.qq.com/wework_admin/frame#/chatGroup',
          editUrl: validItem.editUrl, // 使用筛选后的编辑链接
          validTitle: validItem.validTitle, // 传递有效标题
          validAdminInfo: validItem.validAdminInfo, // 传递管理员信息
          authData: global.authData // 传递认证信息
        };
      
        const processPromise = new Promise((resolve, reject) => {
          const workerPath = path.join(__dirname, 'worker.js');
          
          // 创建临时文件传递数据，避免命令行参数过长
          const tempDir = os.tmpdir();
          const tempFile = path.join(tempDir, `worker-data-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`);
          
          try {
            fs.writeFileSync(tempFile, JSON.stringify(taskData));
            log(`创建临时数据文件: ${tempFile}`);
          } catch (error) {
            logError(`创建临时数据文件失败: ${error.message}`);
            reject(error);
            return;
          }
          
          const childProcess = spawn('node', [workerPath, tempFile], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env }
          });
          
          let stdout = '';
          let stderr = '';
          
          childProcess.stdout.on('data', (data) => {
            stdout += data.toString();
            log(`[Process ${childProcess.pid}] ${data.toString().trim()}`);
          });
          
          childProcess.stderr.on('data', (data) => {
            stderr += data.toString();
            logError(`[Process ${childProcess.pid}] ERROR: ${data.toString().trim()}`);
          });
          
          childProcess.on('close', (code) => {
            // 清理临时文件
            try {
              if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
                log(`清理临时文件: ${tempFile}`);
              }
            } catch (error) {
              logError(`清理临时文件失败: ${error.message}`);
            }
            
            if (code === 0) {
              log(`✅ 进程 ${childProcess.pid} (任务 ${i + 1}) 处理成功`);
              resolve(true);
            } else {
              log(`❌ 进程 ${childProcess.pid} (任务 ${i + 1}) 处理失败，退出码: ${code}`);
              resolve(false);
            }
          });
          
          childProcess.on('error', (error) => {
            // 清理临时文件
            try {
              if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
                log(`清理临时文件: ${tempFile}`);
              }
            } catch (cleanupError) {
              logError(`清理临时文件失败: ${cleanupError.message}`);
            }
            
            logError(`❌ 进程 ${childProcess.pid} (任务 ${i + 1}) 启动失败:`, error);
            reject(error);
          });
          });
          
          concurrentProcesses.push(processPromise);
        }
        
        // 并发执行当前批次的所有进程
        const results = await Promise.allSettled(concurrentProcesses);
        
        // 统计当前批次的处理结果
        let batchSuccessCount = 0;
        let batchFailureCount = 0;
        
        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value === true) {
            batchSuccessCount++;
          } else {
            batchFailureCount++;
          }
        });
        
        totalProcessedCount += batchSuccessCount;
        
        log(`\n📊 第 ${Math.floor(batchStart / batchSize) + 1} 批处理完成:`);
        log(`✅ 成功: ${batchSuccessCount} 项`);
        log(`❌ 失败: ${batchFailureCount} 项`);
        log(`📈 累计处理: ${totalProcessedCount} 项`);
        
        // 如果达到最大处理数量，提前退出
        if (effectiveMaxItems !== -1 && totalProcessedCount >= effectiveMaxItems) {
          log(`\n🎯 已达到最大处理数量 ${effectiveMaxItems}，停止处理`);
          break;
        }
      }
      log(`\n📊 本页处理完成，总计处理 ${totalProcessedCount} 条`);
      
      // 检查是否有下一页（只有在需要处理更多数据时才翻页）
      if (effectiveMaxItems === -1 || totalProcessedCount < effectiveMaxItems) {
        log('\n检查是否有下一页...');
        const nextPageButton = await page.$('.next-page, .pagination-next, [aria-label="下一页"]');
        
        if (nextPageButton) {
          const isDisabled = await page.evaluate(el => {
            return el.disabled || el.classList.contains('disabled') || el.getAttribute('aria-disabled') === 'true';
          }, nextPageButton);
          
          if (!isDisabled) {
            log('找到下一页按钮，准备翻页...');
            await nextPageButton.click();
            await smartWait(page, { selector: '.ww_table.csPlugin_index_table tbody tr', action: 'visible', timeout: 5000 });
            currentPage++;
          } else {
            log('下一页按钮已禁用，没有更多页面');
            hasMorePages = false;
          }
        } else {
          log('未找到下一页按钮，没有更多页面');
          hasMorePages = false;
        }
      } else {
        log('已达到处理数量限制，停止翻页');
        hasMorePages = false;
      }
    }
    
    log(`\n=== 多进程数据处理完成 ===`);
    if (hasSearched) {
      log(`🔍 搜索关键词: ${searchKeyword}`);
    }
    log(`📊 总共处理了 ${totalProcessedCount} 条数据`);
    
  } catch (error) {
    logError('处理列表数据时出错:', error);
  }
};


(async () => {
  let browser;
  let page;
  
  try {
    log('启动浏览器...');
    
    // 从环境变量或命令行参数获取配置
    const maxItems = parseInt(process.env.MAX_ITEMS) || parseInt(process.argv[2]) || -1;
    const searchKeyword = process.env.SEARCH_KEYWORD || null;
    
    // 显示处理策略
    if (maxItems === -1 && searchKeyword && searchKeyword.trim() !== '') {
      log('🔍 处理策略: 搜索模式 - 处理搜索结果中的所有列表项');
      log(`配置的搜索关键词: ${searchKeyword}`);
    } else if (maxItems === -1) {
      log('📋 处理策略: 全量模式 - 处理所有列表项');
    } else {
      log(`📊 处理策略: 限量模式 - 最多处理 ${maxItems} 条数据`);
    }
    
    // 搜索关键词日志输出
    if (searchKeyword && searchKeyword.trim() !== '') {
      log(`配置的搜索关键词: ${searchKeyword}`);
    } else {
      log('配置的搜索关键词: 无');
    }
    
  
    // 获取Chrome路径
    const chromePath = getChromePath();
    if (!chromePath) {
      throw new Error('无法找到Chrome可执行文件');
    }
    log(`使用Chrome路径: ${chromePath}`);
    
    // 启动浏览器 - 性能优化版
    browser = await puppeteer.launch({
      executablePath: chromePath, // 指定Chrome可执行文件路径
      headless: false, // 设置为false以显示浏览器窗口
      devtools: false, // 可选：是否打开开发者工具
      slowMo: 50, // 减少操作延迟
      defaultViewport: null, // 使用默认视口大小
      args: [
        '--start-maximized', // 启动时最大化窗口
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images', // 禁用图片加载以提升速度
        '--disable-javascript-harmony-shipping',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-translate',
        '--disable-ipc-flooding-protection',
        '--memory-pressure-off',
        '--max_old_space_size=4096'
      ]
    });
    
    // 创建新页面
    page = await browser.newPage();
    
    // 设置用户代理
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // 设置视口大小（如果需要）
    await page.setViewport({ width: 1920, height: 1080 });
    
    log('浏览器启动成功，开始导航到企业微信登录页面...');
    
    // 1. 导航到企业微信登录页面
    await page.goto('https://work.weixin.qq.com/wework_admin/loginpage_wx', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    log('已到达企业微信登录页面，请扫描二维码登录...');
    
    // 2. 等待用户扫码登录 - 每60秒刷新一次页面，直到到达工作台页面
    log('等待二维码登录...');
    let loginSuccess = false;
    let refreshCount = 0;
    const maxRefreshAttempts = 10; // 最多刷新10次（10分钟）
    
    while (!loginSuccess && refreshCount < maxRefreshAttempts) {
      try {
        log(`等待登录中... (第${refreshCount + 1}次检查)`);
        
        // 等待60秒或者页面跳转（以先发生的为准）
        const navigationPromise = page.waitForNavigation({ 
          waitUntil: 'networkidle2', 
          timeout: 60000 // 60秒超时
        });
        
        try {
          await navigationPromise;
          log('检测到页面跳转，检查是否到达工作台...');
          
          // 检查当前页面是否是工作台页面
          const currentUrl = page.url();
          log(`当前页面URL: ${currentUrl}`);
          
          if (currentUrl.includes('work.weixin.qq.com/wework_admin/frame')) {
            log('✅ 已到达工作台页面，登录流程完成！');
            loginSuccess = true;
            break;
          } else if (currentUrl.includes('work.weixin.qq.com') && !currentUrl.includes('login')) {
            log('检测到已登录但未到达工作台，可能在短信验证页面，继续等待...');
            // 继续等待，不增加刷新计数
            continue;
          } else {
            log('页面跳转但未检测到登录成功，继续等待...');
          }
          
        } catch (timeoutError) {
          // 60秒超时，检查当前页面状态
          log('60秒等待超时，检查当前页面状态...');
          const currentUrl = page.url();
          log(`当前页面URL: ${currentUrl}`);
          
          if (currentUrl.includes('work.weixin.qq.com/wework_admin/frame')) {
            log('✅ 检测到已在工作台页面，登录流程完成！');
            loginSuccess = true;
            break;
          } else if (currentUrl.includes('work.weixin.qq.com') && !currentUrl.includes('login')) {
            log('检测到已登录但未到达工作台，可能在短信验证页面，继续等待...');
            // 继续等待，不刷新页面，不增加刷新计数
            continue;
          } else {
            // 仍在登录页面，刷新页面
            refreshCount++;
            log(`仍在登录页面，刷新页面 (第${refreshCount}次刷新)...`);
            
            await page.reload({ 
              waitUntil: 'networkidle2',
              timeout: 30000 
            });
            
            log('页面已刷新，请重新扫描二维码');
            await smartWait(page, { selector: 'body', action: 'stable', timeout: 3000 }); // 刷新后等待一下
          }
        }
        
      } catch (error) {
        logError('登录检查过程中出错:', error);
        const currentUrl = page.url();
        
        // 即使出错也检查一下是否已经在工作台
        if (currentUrl.includes('work.weixin.qq.com/wework_admin/frame')) {
          log('✅ 虽然出现错误，但检测到已在工作台页面，继续执行');
          loginSuccess = true;
          break;
        }
        
        refreshCount++;
        
        if (refreshCount < maxRefreshAttempts) {
          log('尝试刷新页面继续等待登录...');
          try {
            await page.reload({ 
              waitUntil: 'networkidle2',
              timeout: 30000 
            });
            await smartWait(page, { selector: 'body', action: 'stable', timeout: 3000 });
          } catch (reloadError) {
            logError('页面刷新失败:', reloadError);
          }
        }
      }
    }
    
    if (!loginSuccess) {
      throw new Error(`登录失败：已尝试刷新${maxRefreshAttempts}次，仍未检测到到达工作台页面`);
    }
    
    // 3. 导航到工作台后直接跳转到群聊管理页面
    log('导航到工作台...');
    await page.goto('https://work.weixin.qq.com/wework_admin/frame', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await smartWait(page, { selector: 'body', action: 'stable', timeout: 5000 });
    
    // 4. 直接跳转到群聊管理页面
    log('直接跳转到群聊管理页面...');
    await page.goto('https://work.weixin.qq.com/wework_admin/frame#chatGroup', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    log('✅ 已成功跳转到群聊管理页面');
    await smartWait(page, { selector: '.ww_table.csPlugin_index_table', action: 'visible', timeout: 5000 });
    
    // 收集认证信息用于子进程共享
    log('收集认证信息...');
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
    
    log(`✅ 认证信息收集完成: ${cookies.length} 个Cookie, ${Object.keys(localStorage).length} 个localStorage项`);
    
    // 5. 处理列表数据
    await processListData(page, maxItems);
    
    log('✅ 自动化流程执行完成！');
    
  } catch (error) {
    logError(`❌ 自动化脚本执行失败: ${error.message}`);
    if (page) {
      await saveScreenshot(page, 'error');
    }
  } finally {
    // 保持浏览器打开以便查看结果
    log('脚本执行结束，浏览器将保持打开状态以便查看结果');
    log('如需关闭浏览器，请手动关闭或按 Ctrl+C 终止程序');
    // 注释掉自动关闭浏览器的代码
    // await browser?.close();
  }
})();