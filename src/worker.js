const puppeteer = require('puppeteer');
const fs = require('fs');
const dotenv = require('dotenv');
const path = require('path');
const os = require('os');
const { getPkgChromePath } = require('./pkg-chrome-helper');

// 检测是否为打包后的可执行文件
const isPkg = typeof process.pkg !== 'undefined';

// Configure dotenv - 根据环境选择正确的配置文件路径
if (isPkg) {
  // 打包环境中，从可执行文件同目录读取
  const execDir = path.dirname(process.execPath);
  const envPath = path.join(execDir, '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
} else {
  // 开发环境中，从项目根目录读取
  dotenv.config();
}

// 获取Chrome可执行文件路径 - pkg优化版本
const getChromePath = () => {
  console.log(`[Worker ${process.pid}] === Chrome路径检测（pkg优化版）===`);
  
  // 首先尝试pkg兼容的路径检测
  const pkgPath = getPkgChromePath();
  if (pkgPath && fs.existsSync(pkgPath)) {
    console.log(`[Worker ${process.pid}] ✅ pkg兼容路径检测成功: ${pkgPath}`);
    return pkgPath;
  }
  
  // 如果pkg方法失败，使用原始方法
  const platform = os.platform();
  const isPkg = typeof process.pkg !== 'undefined';
  
  console.log(`[Worker ${process.pid}] 平台: ${platform}, 架构: ${os.arch()}, pkg模式: ${isPkg}`);
  console.log(`[Worker ${process.pid}] process.execPath: ${process.execPath}`);
  console.log(`[Worker ${process.pid}] __dirname: ${__dirname}`);
  
  let chromePath;
  
  if (isPkg) {
    let execDir;
    
    if (platform === 'win32') {
      execDir = path.dirname(process.execPath);
      console.log(`[Worker ${process.pid}] pkg执行目录: ${execDir}`);
      
      const possiblePaths = [
        path.join(execDir, 'chrome', 'win64-116.0.5793.0', 'chrome-win64', 'chrome.exe'),
        path.join(execDir, 'chrome-win64', 'chrome.exe'),
        path.join(execDir, 'chrome', 'chrome-win64', 'chrome.exe'),
        path.resolve(execDir, 'chrome', 'win64-116.0.5793.0', 'chrome-win64', 'chrome.exe')
      ];
      
      console.log(`[Worker ${process.pid}] 尝试的Chrome路径:`);
      for (let i = 0; i < possiblePaths.length; i++) {
        console.log(`[Worker ${process.pid}]   ${i + 1}. ${possiblePaths[i]}`);
        if (fs.existsSync(possiblePaths[i])) {
          chromePath = possiblePaths[i];
          console.log(`[Worker ${process.pid}]   ✅ 找到有效路径: ${chromePath}`);
          break;
        } else {
          console.log(`[Worker ${process.pid}]   ❌ 路径不存在`);
        }
      }
    } else {
      execDir = path.dirname(process.execPath);
      console.log('此版本仅支持Windows平台');
    }
  } else {
    const projectDir = path.join(__dirname, '..');
    console.log(`[Worker ${process.pid}] 开发环境项目目录: ${projectDir}`);
    
    if (platform === 'win32') {
      chromePath = path.join(projectDir, 'chrome', 'win64-116.0.5793.0', 'chrome-win64', 'chrome.exe');
    } else {
      console.log('此版本仅支持Windows平台');
    }
  }
  
  if (!chromePath) {
    console.error(`[Worker ${process.pid}] ❌ 无法找到Chrome可执行文件`);
    console.error(`[Worker ${process.pid}] 请确保Chrome已正确安装或打包到应用程序中`);
    throw new Error('Chrome可执行文件未找到');
  }
  
  console.log(`[Worker ${process.pid}] ✅ 最终Chrome路径: ${chromePath}`);
  console.log(`[Worker ${process.pid}] ==================\n`);
  return chromePath;
};

// 延迟函数
const delay = (min, max) => {
  const time = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, time));
};

// 等待元素变化的通用函数
const waitForElementChange = async (page, options = {}) => {
  const {
    selector,
    changeType = 'disappear',
    timeout = 10000,
    expectedCount = null,
    checkInterval = 100
  } = options;
  
  console.log(`[Worker ${process.pid}] 等待元素变化: ${selector} (${changeType})`);
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
    console.log(`[Worker ${process.pid}] ✅ 元素变化检测完成，耗时: ${endTime - startTime}ms`);
    return true;
    
  } catch (error) {
    console.log(`[Worker ${process.pid}] ⚠️ 元素变化检测超时: ${error.message}`);
    return false;
  }
};

// 通用的页面跳转等待函数
const waitForPageTransition = async (page, options = {}) => {
  const {
    timeout = 10000,
    waitForUrlChange = true,
    waitForElementDisappear = null,
    waitForElementAppear = null,
    waitForNetworkIdle = true,
    checkInterval = 500
  } = options;
  
  console.log(`[Worker ${process.pid}] 开始等待页面跳转...`);
  const startTime = Date.now();
  const initialUrl = page.url();
  
  try {
    await Promise.race([
      waitForUrlChange ? page.waitForFunction(
        (initialUrl) => window.location.href !== initialUrl,
        { timeout },
        initialUrl
      ).then(() => console.log(`[Worker ${process.pid}] ✅ 检测到URL变化`)) : Promise.resolve(),
      
      waitForElementDisappear ? page.waitForSelector(waitForElementDisappear, { 
        hidden: true, 
        timeout 
      }).then(() => console.log(`[Worker ${process.pid}] ✅ 元素已消失: ${waitForElementDisappear}`)) : Promise.resolve(),
      
      waitForElementAppear ? page.waitForSelector(waitForElementAppear, { 
        visible: true, 
        timeout 
      }).then(() => console.log(`[Worker ${process.pid}] ✅ 元素已出现: ${waitForElementAppear}`)) : Promise.resolve(),
      
      waitForNetworkIdle ? page.waitForLoadState('networkidle').catch(() => {
        console.log(`[Worker ${process.pid}] ⚠️ 网络空闲等待超时，但继续执行`);
      }) : Promise.resolve()
    ]);
    
    const endTime = Date.now();
    console.log(`[Worker ${process.pid}] ✅ 页面跳转等待完成，耗时: ${endTime - startTime}ms`);
    return true;
    
  } catch (error) {
    console.log(`[Worker ${process.pid}] ⚠️ 页面跳转等待超时: ${error.message}`);
    return false;
  }
};

// 元素验证公共函数
const validateElement = async (page, element, elementName = '元素') => {
  if (!element) {
    console.log(`${elementName}不存在`);
    return false;
  }
  
  const isConnected = await page.evaluate(el => el.isConnected, element);
  if (!isConnected) {
    console.log(`${elementName}已从文档中分离`);
    return false;
  }
  
  const isClickable = await page.evaluate(el => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && 
           style.visibility !== 'hidden' && 
           style.display !== 'none' &&
           !el.disabled &&
           el.isConnected;
  }, element);
  
  return isClickable;
};

// 提取剪贴板操作为公共函数
const copyToClipboard = async (page, text, description = '') => {
  await page.evaluate(text => {
    navigator.clipboard.writeText(text).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    });
  }, text);
  
  if (description) {
    console.log(`${description}已保存到剪贴板`);
  }
};

// 保存截图函数
const saveScreenshot = async (page, name) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}_${timestamp}.png`;
    const screenshotPath = path.join(__dirname, '..', 'screenshots', filename);
    
    // 确保screenshots目录存在
    const screenshotsDir = path.dirname(screenshotPath);
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`[Worker ${process.pid}] 📸 截图已保存: ${screenshotPath}`);
  } catch (error) {
    console.error(`[Worker ${process.pid}] 截图保存失败:`, error);
  }
};

// 执行搜索的函数
const performSearch = async (page, searchKeyword) => {
  try {
    console.log(`[Worker ${process.pid}] 执行搜索: ${searchKeyword}`);
    
    const searchInput = await page.$('.qui_inputText.ww_inputText.ww_searchInput_text.js_cs_index_search_input');
    
    if (searchInput) {
      await searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await delay(1000, 2000);
      
      await searchInput.click();
      await searchInput.evaluate(el => el.value = '');
      await searchInput.type(searchKeyword);
      await searchInput.press('Enter');
      
      console.log(`[Worker ${process.pid}] ✅ 搜索执行完成`);
      await delay(2000, 3000);
    }
  } catch (error) {
    console.error(`[Worker ${process.pid}] 搜索执行失败:`, error);
  }
};

// 导航到指定页面的函数
const navigateToPage = async (page, targetPage) => {
  try {
    console.log(`[Worker ${process.pid}] 导航到第 ${targetPage} 页`);
    // 这里需要根据实际的分页逻辑来实现
    // 暂时使用简单的等待
    await delay(1000, 2000);
  } catch (error) {
    console.error(`[Worker ${process.pid}] 页面导航失败:`, error);
  }
};

// 执行群聊创建步骤的函数
const executeGroupCreationSteps = async (page, copy1, copy2, itemIndex) => {
  try {
    // 步骤1: 点击选择群主按钮
    console.log('查找选择群主按钮...');
    
    // 根据提供的HTML结构，使用更精确的选择器
    const selectOwnerBtn = await page.$('.ww_btnWithMenu.js_ownerDropdown .qui_btn.ww_btn.ww_btn_Dropdown');
    
    if (selectOwnerBtn) {
      await selectOwnerBtn.scrollIntoView();
      await delay(1000, 2000);
      await selectOwnerBtn.click();
      console.log('成功点击选择群主按钮');
      
      // 等待下拉菜单出现
      console.log('等待下拉菜单加载...');
      await delay(2000, 3000);
      
      // 步骤2: 在搜索框中粘贴copy2内容
      try {
        console.log('查找搜索输入框...');
        
        // 等待搜索输入框出现并重新获取
        await page.waitForSelector('#memberSearchInput', {
          timeout: 10000,
          visible: true
        }).catch(() => {
          console.log('等待搜索输入框出现超时');
        });
        
        // 重新获取搜索框元素，确保元素是最新的
        let searchInput = await page.$('#memberSearchInput');
        
        if (searchInput) {
          console.log('找到搜索输入框，检查元素状态...');
          
          // 检查元素是否仍然连接到文档
          const isConnected = await page.evaluate(el => el.isConnected, searchInput);
          if (!isConnected) {
            console.log('搜索框元素已从文档中分离，重新获取...');
            const freshSearchInput = await page.$('#memberSearchInput');
            if (!freshSearchInput) {
              throw new Error('无法重新获取搜索框元素');
            }
            searchInput = freshSearchInput;
          }
          
          // 确保元素在视口中
          await searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await delay(1000, 2000);
          
          // 验证元素可点击性
          const isClickable = await page.evaluate(el => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.width > 0 && rect.height > 0 && 
                   style.visibility !== 'hidden' && 
                   style.display !== 'none' &&
                   !el.disabled &&
                   el.isConnected;
          }, searchInput);
          
          if (!isClickable) {
            throw new Error('搜索框元素不可点击');
          }
          
          console.log('搜索框元素状态正常，开始操作...');
          
          try {
            // 方法1: 直接点击
            await searchInput.click();
           
            await delay(1000, 2000);
            await searchInput.click();
            console.log('成功点击搜索框');
          } catch (clickError) {
            console.log('直接点击失败，尝试JavaScript点击...', clickError);
            
            // 方法2: JavaScript点击
            await page.evaluate(el => {
              el.focus();
              el.click();
            }, searchInput);
            console.log('使用JavaScript成功点击搜索框');
          }
          
          // 等待输入框获得焦点
          await delay(500, 1000);
          
          // 清空输入框并输入内容
          try {
            // 清空输入框
            await page.evaluate(el => {
              el.value = '';
              el.focus();
            }, searchInput);
            
            // 使用键盘快捷键确保清空
            await page.keyboard.down('Control');
            await page.keyboard.press('a');
            await page.keyboard.up('Control');
            await page.keyboard.press('Delete');
            
            // 输入内容
          await searchInput.type(copy2, { delay: 100 });
          console.log(`成功在搜索框中输入: ${copy2}`);
          
          // 触发搜索事件
          await page.evaluate(el => {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
          }, searchInput);
          
        } catch (inputError) {
          console.error('输入操作失败:', inputError);
          
          // 备用输入方法：直接设置值
          await page.evaluate((value) => {
            const input = document.getElementById('memberSearchInput');
            if (input) {
              input.value = value;
              input.focus();
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
              input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
            }
          }, copy2);
          console.log(`备用方法成功输入: ${copy2}`);
        }
        
        // 等待搜索结果出现
        console.log('等待搜索结果出现...');
        await waitForElementChange(page, {
          selector: '.ww_searchResult_title_peopleName',
          changeType: 'appear',
          timeout: 10000
        });
        
        // 步骤3: 点击搜索结果中的人名
        try {
          console.log('查找搜索结果中的人名...');
          const personName = await page.$('.ww_searchResult_title_peopleName');
          
          if (personName) {
            await personName.scrollIntoView();
            await personName.click();
            console.log('成功点击搜索结果中的人名');
            
            // 等待选择结果更新（可以通过检查选中状态或其他UI变化）
            await waitForElementChange(page, {
              selector: '.ww_searchResult_title_peopleName.selected, .ww_memberItem_selected',
              changeType: 'appear',
              timeout: 5000
            });
              
              // 检查群主名称是否已更新
              const ownerNameElement = await page.$('#js_ownerName');
              if (ownerNameElement) {
                const ownerName = await page.evaluate(el => el.textContent || el.innerText, ownerNameElement);
                console.log(`群主已选择: ${ownerName}`);
              }
              
              // 步骤4: 检查右侧选择区域是否不为空
              try {
                console.log('检查选择区域内容...');
                const rightContent = await page.$('.multiPickerDlg_right_cnt');
                
                if (rightContent) {
                  const contentText = await page.evaluate(el => el.textContent || el.innerText, rightContent);
                  
                  if (contentText && contentText.trim() !== '') {
                    console.log('选择区域不为空，查找确认按钮...');
                    
                    // 步骤5: 点击确认按钮
                    const confirmBtn = await page.$('.qui_btn.ww_btn.ww_btn_Blue.js_submit');
                    
                    if (confirmBtn) {
                      await confirmBtn.scrollIntoView();
                      await delay(1000, 2000);
                      await confirmBtn.click();
                      console.log('成功点击确认按钮');
                      
                      // 等待弹窗关闭
                      console.log('等待弹窗关闭...');
                      await delay(1000, 2000);
                      
                      // 弹窗关闭后的操作
                      await handleGroupNameInput(page, copy1, itemIndex);
                      
                    } else {
                      console.log('未找到确认按钮');
                    }
                  } else {
                    console.log('选择区域为空，跳过确认操作');
                  }
                } else {
                  console.log('未找到选择区域');
                }
                
              } catch (error) {
                console.error('检查选择区域时出错:', error);
              }
              
            } else {
              console.log('未找到搜索结果中的人名');
            }
            
          } catch (error) {
            console.error('点击搜索结果时出错:', error);
          }
          
        } else {
          console.log('未找到搜索输入框');
        }
        
      } catch (error) {
        console.error('操作搜索框时出错:', error);
      }
      
    } else {
      console.log('未找到选择群主按钮');
    }
    
  } catch (error) {
    console.error('执行群聊创建步骤时出错:', error);
  }
};

// 处理群名称输入的函数
const handleGroupNameInput = async (page, copy1, itemIndex) => {
  try {
    console.log('等待回到群聊创建页面...');
    await delay(1000, 2000);
    
    // 在群名称输入框中粘贴copy1内容
    console.log('查找群名称输入框...');
    const groupNameInput = await page.$('.qui_inputText.ww_inputText.ww_inputText_Big.js_chatGroup_name');
    
    if (groupNameInput) {
      await groupNameInput.scrollIntoView();
      await delay(1000, 2000);
      
      // 清空输入框并粘贴copy1内容
      await groupNameInput.click();
      await groupNameInput.evaluate(el => el.value = '');
      await groupNameInput.type(copy1);
      console.log(`成功在群名称输入框中输入: ${copy1}`);
      
      await delay(2000, 3000);
      
      // 检查群主和群名称信息是否都不为空
      try {
        console.log('检查群主和群名称信息...');
        
        // 检查群名称是否不为空
        const groupNameValue = await page.evaluate(el => el.value, groupNameInput);
        const isGroupNameValid = groupNameValue && groupNameValue.trim() !== '';
        
        // 检查群主信息是否不为空
        const groupOwnerInfo = await page.$('.multiPickerDlg_right_cnt, .group-owner-info, .selected-owner');
        let isGroupOwnerValid = false;
        
        if (groupOwnerInfo) {
          const ownerText = await page.evaluate(el => el.textContent || el.innerText, groupOwnerInfo);
          isGroupOwnerValid = ownerText && ownerText.trim() !== '';
        }
        
        console.log(`群名称有效: ${isGroupNameValid}, 群主信息有效: ${isGroupOwnerValid}`);
        
        // 如果群主和群名称都不为空，点击确认按钮
        if (isGroupNameValid && isGroupOwnerValid) {
          console.log('群主和群名称信息都不为空，查找最终确认按钮...');
          
          // 等待对话框完全加载
          await delay(1000, 2000);
          
          // 使用精确的选择器定位确定按钮
          const finalConfirmBtn = await page.$('.qui_dialog_foot .qui_btn.ww_btn.ww_btn_Blue[d_ck="submit"]');
          
          if (finalConfirmBtn) {
            console.log('找到确定按钮，准备点击...');
            
            // 确保按钮在视窗中可见
            await finalConfirmBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await delay(500, 1000);
            
            // 验证按钮状态
            const isClickable = await page.evaluate(el => {
              const rect = el.getBoundingClientRect();
              const style = window.getComputedStyle(el);
              return rect.width > 0 && rect.height > 0 && 
                     style.visibility !== 'hidden' && 
                     style.display !== 'none' &&
                     !el.disabled;
            }, finalConfirmBtn);
            
            if (isClickable) {
              try {
                // 方法1: 直接点击
                await finalConfirmBtn.click();
                console.log('✅ 成功点击确定按钮');
                
              } catch (error) {
                console.log('直接点击失败，尝试JavaScript点击...');
                
                // 方法2: JavaScript点击
                await page.evaluate(el => {
                  el.click();
                }, finalConfirmBtn);
                console.log('✅ 使用JavaScript成功点击确定按钮');
              }
              
              // 使用优化的页面跳转等待机制
              console.log('等待群聊创建完成...');
              const transitionSuccess = await waitForPageTransition(page, {
                timeout: 15000,
                waitForUrlChange: true,
                waitForElementDisappear: '.qui_dialog_foot',
                waitForNetworkIdle: true
              });
              
              if (transitionSuccess) {
                console.log('✅ 群聊创建操作完成，页面已跳转');
              } else {
                console.log('⚠️ 页面跳转等待超时，但继续执行后续操作');
              }
              
              // 继续后续操作
              await handleSaveButton(page, itemIndex);
              
            } else {
              console.log('❌ 确定按钮不可点击');
            }
            
          } else {
            console.log('❌ 未找到确定按钮，尝试备用选择器...');
            
            // 备用选择器
            const backupSelectors = [
              'a[d_ck="submit"]',
              '.qui_btn.ww_btn_Blue:contains("确定")',
              '.qui_dialog_foot a.qui_btn.ww_btn_Blue',
              'a.qui_btn[href="javascript:;"][d_ck="submit"]'
            ];
            
            for (const selector of backupSelectors) {
              const btn = await page.$(selector);
              if (btn) {
                console.log(`使用备用选择器找到按钮: ${selector}`);
                await btn.click();
                console.log('✅ 备用方法点击成功');
                
                // 使用页面跳转等待机制
                await waitForPageTransition(page, {
                  timeout: 15000,
                  waitForElementDisappear: '.qui_dialog_foot',
                  waitForNetworkIdle: true
                });
                
                await handleSaveButton(page, itemIndex);
                break;
              }
            }
          }
        } else {
          console.log('群主或群名称信息为空，跳过最终确认');
        }
        
      } catch (error) {
        console.error('检查群信息时出错:', error);
      }
      
    } else {
      console.log('未找到群名称输入框');
    }
    
  } catch (error) {
    console.error('处理群名称输入时出错:', error);
  }
};

// 删除操作公共函数
const performDeleteOperations = async (page) => {
  console.log('开始删除操作...');
  
  let deleteCount = 0;
  let hasMoreDeletes = true;
  
  while (hasMoreDeletes) {
    const deleteButtons = await page.$$('.ww_commonImg.ww_commonImg_DeleteItem.js_delete_chat');
    
    if (deleteButtons && deleteButtons.length > 0) {
      console.log(`找到 ${deleteButtons.length} 个删除按钮，点击第一个...`);
      
      try {
        const beforeCount = deleteButtons.length;
        await deleteButtons[0].scrollIntoView();
        await deleteButtons[0].click();
        deleteCount++;
        console.log(`成功点击第 ${deleteCount} 个删除按钮`);
        
        const changeDetected = await waitForElementChange(page, {
          selector: '.ww_commonImg.ww_commonImg_DeleteItem.js_delete_chat',
          changeType: 'count',
          expectedCount: beforeCount - 1,
          timeout: 5000
        });
        
        if (!changeDetected) {
          console.log('删除按钮数量未减少，可能删除失败');
          hasMoreDeletes = false;
        }
        
        await delay(1000, 2000);
      } catch (error) {
        console.error(`点击删除按钮时出错: ${error}`);
        hasMoreDeletes = false;
      }
    } else {
      console.log('没有找到更多删除按钮，删除操作完成');
      hasMoreDeletes = false;
    }
  }
  
  console.log(`删除操作完成，共删除了 ${deleteCount} 个项目`);
};

// 处理保存按钮的函数
const handleSaveButton = async (page, itemIndex) => {
  try {
    console.log('查找保存按钮...');
    
    // 等待页面稳定
    await delay(2000, 3000);
    
    // 使用精确的选择器定位保存按钮
    const saveBtn = await page.$('.csPlugin_mod_item_opt .qui_btn.ww_btn.ww_btn_Blue.js_save_form');
    
    if (saveBtn) {
      console.log('找到保存按钮，准备点击...');
      
      // 确保按钮在视窗中可见
      await saveBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await delay(1000, 1500);
      
      // 验证按钮状态
      const isClickable = await page.evaluate(el => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && 
               style.visibility !== 'hidden' && 
               style.display !== 'none' &&
               !el.disabled;
      }, saveBtn);
      
      console.log(`保存按钮可点击状态: ${isClickable}`);
      
      if (isClickable) {
        try {
          // 点击保存按钮
          await saveBtn.click();
          console.log('✅ 成功点击保存按钮');
          
          // 等待保存操作完成（短暂等待，不等待页面跳转）
          await delay(2000, 3000);
          
          console.log(`✅ 第 ${itemIndex + 1} 条数据保存操作完成，准备关闭页面`);
          
        } catch (clickError) {
          console.log('直接点击失败，尝试JavaScript点击...', clickError);
          
          // 方法2: JavaScript点击
          await page.evaluate(el => {
            el.click();
          }, saveBtn);
          console.log('✅ 使用JavaScript成功点击保存按钮');
          
          // 等待保存操作完成
          await delay(2000, 3000);
          console.log(`✅ 第 ${itemIndex + 1} 条数据保存操作完成，准备关闭页面`);
        }
        
      } else {
        console.log('❌ 保存按钮不可点击');
      }
      
    } else {
      console.log('❌ 未找到保存按钮，尝试备用选择器...');
      
      // 备用选择器
      const backupSelectors = [
        'a.js_save_form',
        '.qui_btn.ww_btn_Blue.js_save_form',
        'a[href="javascript:;"].js_save_form',
        '.csPlugin_mod_item a.qui_btn.ww_btn_Blue',
        'a.qui_btn:contains("保存")'
      ];
      
      for (const selector of backupSelectors) {
        const btn = await page.$(selector);
        if (btn) {
          console.log(`使用备用选择器找到保存按钮: ${selector}`);
          
          try {
            await btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await delay(1000, 1500);
            
            await btn.click();
            console.log('✅ 备用方法点击保存按钮成功');
            
            // 等待保存操作完成
            await delay(2000, 3000);
            console.log(`✅ 第 ${itemIndex + 1} 条数据保存操作完成，准备关闭页面`);
            break;
          } catch (backupError) {
            console.log(`备用选择器 ${selector} 点击失败:`, backupError);
            continue;
          }
        }
      }
    }
    
  } catch (error) {
    console.error('处理保存按钮时出错:', error);
    
    // 最后的备用方案：通过文本内容查找
    try {
      console.log('尝试通过文本内容查找保存按钮...');
      const saveByText = await page.evaluateHandle(() => {
        const links = Array.from(document.querySelectorAll('a'));
        return links.find(link => link.textContent.trim() === '保存');
      });
      
      if (saveByText) {
        await saveByText.click();
        console.log('✅ 通过文本内容成功点击保存按钮');
        
        // 等待保存操作完成
        await delay(2000, 3000);
        console.log(`✅ 第 ${itemIndex + 1} 条数据保存操作完成，准备关闭页面`);
      }
    } catch (textError) {
      console.error('通过文本查找也失败:', textError);
    }
  }
};


// 提取有效群组信息的函数
const extractValidGroupInfo = async (page) => {
  const targetTextElements = await page.$$('span.ww_groupSelBtn_item_text');
  
  if (!targetTextElements || targetTextElements.length === 0) {
    console.log('未找到span.ww_groupSelBtn_item_text元素');
    return { validTitle: '', validAdminInfo: '' };
  }
  
  console.log(`找到 ${targetTextElements.length} 个文本元素，开始处理...`);
  
  let hasValidHKOrDD = false;
  let validTitle = '';
  let validAdminInfo = '';
  
  // 遍历所有文本元素
  for (let i = 0; i < targetTextElements.length; i++) {
    try {
      console.log(`处理第 ${i + 1} 个文本元素...`);
      
      // 重新获取文本元素，确保元素仍然有效
      const freshTextElements = await page.$$('span.ww_groupSelBtn_item_text');
      if (i >= freshTextElements.length) {
        console.log(`文本元素 ${i + 1} 已不存在，跳过`);
        continue;
      }
      
      const textElement = freshTextElements[i];
      
      // 检查元素是否仍然连接到文档
      const isConnected = await page.evaluate(el => el.isConnected, textElement);
      if (!isConnected) {
        console.log(`文本元素 ${i + 1} 已从文档中分离，跳过`);
        continue;
      }
      
      // 确保元素在视口中
      await textElement.scrollIntoView();
      await delay(500, 1000);
      
      // 模拟鼠标悬停在文本元素上
      await textElement.hover();
      console.log(`鼠标悬停在第 ${i + 1} 个文本元素上`);
      
      // 等待悬停效果显示
      await delay(1500, 2500);
      
      // 获取悬停后显示的群卡片标题
      const titleElement = await page.$('.customer_qunCard_title');
      let titleText = '';
      if (titleElement) {
        titleText = await page.evaluate(el => el.textContent || el.innerText, titleElement);
        console.log(`群名称标题: ${titleText}`);
      }
      
      // 获取悬停后显示的群管理员信息
      const adminElement = await page.$('.customer_qunCard_adminInfo');
      let adminText = '';
      if (adminElement) {
        adminText = await page.evaluate(el => el.textContent || el.innerText, adminElement);
        console.log(`群主信息: ${adminText}`);
      }
      
      // 对群卡片标题进行HK和DD检测
      if (titleText && (titleText.includes('HK') || titleText.includes('DD'))) {
        console.log(`发现HK或DD文字: ${titleText}`);
        hasValidHKOrDD = true;
        validTitle = titleText;
        validAdminInfo = adminText || '';
        console.log(`包含HK或DD的有效标题: ${validTitle}`);
        console.log(`对应的管理员信息: ${validAdminInfo}`);
      } else if (titleText) {
        console.log(`标题不包含HK或DD，跳过: ${titleText}`);
      }
      
      // 移开鼠标，避免影响后续操作
      await page.mouse.move(0, 0);
      await delay(500, 1000);
      
    } catch (error) {
      console.error(`处理第 ${i + 1} 个文本元素时出错:`, error);
      // 继续处理下一个元素，而不是中断整个流程
      continue;
    }
  }
  
  if (!hasValidHKOrDD) {
    console.log('数据不包含HK或DD，跳过处理');
    return { validTitle: null, validAdminInfo: '' }; // 返回null表示跳过
  }
  
  return { validTitle, validAdminInfo };
};

// 处理群组信息的函数
const processGroupInfo = async (validTitle, validAdminInfo) => {
  console.log('找到包含HK或DD的数据，开始处理标题信息');
  
  // 对包含HK或DD的customer_qunCard_title进行阿拉伯数字查找和加1处理
  let processedTitle = validTitle;
  const numberMatches = [...validTitle.matchAll(/\d+/g)];
  
  if (numberMatches && numberMatches.length > 0) {
    // 找到最大的数字并加1
    let maxNumber = 0;
    let maxNumberInfo = null;

    for (const match of numberMatches) {
      const number = parseInt(match[0]);
      if (number > maxNumber) {
        maxNumber = number;
        maxNumberInfo = {
          value: match[0],
          startIndex: match.index,
          endIndex: match.index + match[0].length - 1
        };
      }
    }

    if (maxNumberInfo) {
      const newNumber = maxNumber + 1;
      const beforeMax = validTitle.substring(0, maxNumberInfo.startIndex);
      const afterMax = validTitle.substring(maxNumberInfo.endIndex + 1);
      processedTitle = beforeMax + newNumber.toString() + afterMax;
      
      console.log(`标题数字处理后: ${processedTitle}`);
    }
  } else {
    // 如果找不到阿拉伯数字，就在末尾添加"1群"
    processedTitle = validTitle + '1群';
    console.log(`标题未找到阿拉伯数字，在末尾添加1群: ${processedTitle}`);
  }
  
  // 复制1：处理后的customer_qunCard_title
  const copy1 = processedTitle;
  console.log(`复制1: ${copy1}`);
  
  // 复制2：从customer_qunCard_adminInfo中提取群主信息
  let copy2 = '';
  const groupOwnerPrefix = '群主：';
  const groupOwnerIndex = validAdminInfo.indexOf(groupOwnerPrefix);
  
  if (groupOwnerIndex !== -1) {
    // 找到"群主："，截取后面的内容
    copy2 = validAdminInfo.substring(groupOwnerIndex + groupOwnerPrefix.length).trim();
    console.log(`从管理员信息中提取群主信息: ${copy2}`);
  } else {
    console.log(`管理员信息中未找到"群主："，使用空字符串`);
    copy2 = '';
  }
  
  console.log(`复制2: ${copy2}`);
  
  return { copy1, copy2 };
};

// 执行添加操作的函数
const performAddOperations = async (page, copy1, copy2, itemIndex) => {
  await delay(1000, 2000);
  
  // 删除完成后，点击添加按钮
  try {
    console.log('查找修改按钮...');
    const addButton = await page.$('.ww_groupSelBtn_add');
    
    if (addButton) {
      // 确保按钮在视口中
      await addButton.scrollIntoView();
      
      // 点击添加按钮
      await addButton.click();
      console.log('成功点击添加按钮');
      
      // 等待下拉菜单出现
      await waitForElementChange(page, {
        selector: '.qui_dropdownMenu_itemLink.ww_dropdownMenu_itemLink',
        changeType: 'appear',
        timeout: 5000
      });
      
      // 查找并点击"新建群聊"选项
      try {
        console.log('查找新建群聊选项...');
        const newGroupOption = await page.$('.qui_dropdownMenu_itemLink.ww_dropdownMenu_itemLink');
        
        if (newGroupOption) {
          // 检查是否是"新建群聊"选项
          const optionText = await page.evaluate(el => el.textContent || el.innerText, newGroupOption);
          
          if (optionText && optionText.includes('新建群聊')) {
            // 确保选项在视口中
            await newGroupOption.scrollIntoView();
            
            // 点击新建群聊选项
            await newGroupOption.click();
            console.log('成功点击新建群聊选项');
            
            // 等待新建群聊页面的关键元素出现
            await waitForElementChange(page, {
              selector: '#memberSearchInput, .ww_searchInput_text',
              changeType: 'appear',
              timeout: 10000
            });
            
            // 执行新建群聊的步骤
            await executeGroupCreationSteps(page, copy1, copy2, itemIndex);
            
          } else {
            console.log(`找到的选项文本不匹配: ${optionText}`);
          }
        } else {
          console.log('未找到新建群聊选项');
        }
        
      } catch (error) {
        console.error('点击新建群聊选项时出错:', error);
      }
      
    } else {
      console.log('未找到添加按钮 (.ww_groupSelBtn_add)');
    }
    
  } catch (error) {
    console.error('点击添加按钮时出错:', error);
  }
};

// 直接处理编辑页面的函数
const processEditPageDirectly = async (page, itemIndex) => {
  try {
    console.log(`[Worker ${process.pid}] 开始处理编辑页面...`);
    
    const { validTitle, validAdminInfo } = await extractValidGroupInfo(page);
    
    if (validTitle === null) {
      console.log('数据不包含HK或DD，跳过处理');
      return true; // 跳过处理但返回true表示检测完成
    } else if (validTitle) {
      const { copy1, copy2 } = await processGroupInfo(validTitle, validAdminInfo);
      
      // 复制到剪贴板
      await copyToClipboard(page, copy1, '复制1');
      await copyToClipboard(page, copy2, '复制2');
      
      console.log('文字处理和复制完成');
      
      // 执行删除操作
      try {
        await performDeleteOperations(page);
        
        // 执行添加操作
        await performAddOperations(page, copy1, copy2, itemIndex);
        
      } catch (error) {
        console.error('删除操作时出错:', error);
      }
      
    } else {
      console.log(`第 ${itemIndex + 1} 条数据：未检测到有效的群组标题信息，可能原因：1) 悬停未触发群卡片显示 2) 群卡片标题为空 3) 所有标题都不包含HK或DD关键字`);
      return false;
    }
    
  } catch (error) {
    console.error(`[Worker ${process.pid}] 处理编辑页面时出错:`, error);
  }
};

// 工作进程主函数
const workerMain = async () => {
  const args = process.argv.slice(2);
  const taskData = JSON.parse(args[0]);
  
  const { itemIndex, pageNumber, searchKeyword, targetUrl, editUrl, authData } = taskData;
  
  let browser = null;
  let page = null;
  
  try {
    console.log(`[Worker ${process.pid}] 🚀 启动工作进程处理第 ${itemIndex + 1} 条数据...`);
    
    // 获取Chrome可执行文件路径
    const chromePath = getChromePath();
    
    console.log(`[Worker ${process.pid}] === 启动独立浏览器实例 ===`);
    console.log(`[Worker ${process.pid}] 使用Chrome路径: ${chromePath}`);
    
    try {
      // 启动独立的浏览器实例
      browser = await puppeteer.launch({
        executablePath: chromePath, // 指定Chrome可执行文件路径
        headless: false,
        devtools: false,
        slowMo: 100,
        defaultViewport: null,
        args: [
          '--start-maximized',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding'
        ]
      });
      
      console.log(`[Worker ${process.pid}] ✅ 浏览器实例启动成功`);
    } catch (launchError) {
      console.error(`[Worker ${process.pid}] ❌ 浏览器启动失败: ${launchError.message}`);
      console.error(`[Worker ${process.pid}] Chrome路径: ${chromePath}`);
      console.error(`[Worker ${process.pid}] 堆栈跟踪: ${launchError.stack}`);
      
      // 提供详细的错误信息
      console.error(`[Worker ${process.pid}] \n=== 工作进程错误诊断 ===`);
      console.error(`[Worker ${process.pid}] 工作进程ID: ${process.pid}`);
      console.error(`[Worker ${process.pid}] 可能的原因:`);
      console.error(`[Worker ${process.pid}] 1. Chrome文件损坏或权限问题`);
      console.error(`[Worker ${process.pid}] 2. 多个浏览器实例冲突`);
      console.error(`[Worker ${process.pid}] 3. 系统资源不足`);
      console.error(`[Worker ${process.pid}] ========================\n`);
      
      throw launchError;
    }
    
    page = await browser.newPage();
    
    // 设置用户代理
    if (authData && authData.userAgent) {
      await page.setUserAgent(authData.userAgent);
    } else {
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    }
    
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 设置认证信息
    if (authData) {
      console.log(`[Worker ${process.pid}] 设置认证信息...`);
      
      // 先导航到域名，然后设置Cookie
      await page.goto('https://work.weixin.qq.com', { waitUntil: 'networkidle2', timeout: 30000 });
      
      // 设置Cookie
      if (authData.cookies && authData.cookies.length > 0) {
        await page.setCookie(...authData.cookies);
        console.log(`[Worker ${process.pid}] ✅ 已设置 ${authData.cookies.length} 个Cookie`);
      }
      
      // 设置localStorage
      if (authData.localStorage) {
        await page.evaluate((storage) => {
          for (const [key, value] of Object.entries(storage)) {
            localStorage.setItem(key, value);
          }
        }, authData.localStorage);
        console.log(`[Worker ${process.pid}] ✅ 已设置localStorage`);
      }
    }
    
    // 直接导航到编辑页面（如果有编辑链接）
    if (editUrl && editUrl.trim() !== '') {
      console.log(`[Worker ${process.pid}] 直接导航到编辑页面: ${editUrl}`);
      await page.goto(editUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // 验证是否成功跳过登录
      const currentUrl = page.url();
      if (currentUrl.includes('login')) {
        console.error(`[Worker ${process.pid}] ❌ 认证失败，仍在登录页面`);
        process.exit(1);
      }
      
      console.log(`[Worker ${process.pid}] ✅ 成功打开编辑页面: ${currentUrl}`);
      
      await delay(1000, 2000);
      
      // 等待编辑页面的删除按钮出现
      await waitForElementChange(page, {
        selector: '.ww_commonImg.ww_commonImg_DeleteItem.js_delete_chat',
        changeType: 'appear',
        timeout: 10000
      });
      
      // 直接调用processEditPageDirectly函数处理编辑页面
      await processEditPageDirectly(page, itemIndex);
      
    } else {
      console.log(`[Worker ${process.pid}] ⚠️ 未获取到编辑链接，跳过处理`);
      process.exit(1);
    }
    
    console.log(`[Worker ${process.pid}] ✅ 数据处理完成`);
    process.exit(0);
    
  } catch (error) {
    console.error(`[Worker ${process.pid}] ❌ 工作进程处理失败:`, error);
    if (page) {
      await saveScreenshot(page, `worker_error_${process.pid}`);
    }
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};



// 启动工作进程
if (require.main === module) {
  workerMain();
}