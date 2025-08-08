const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { getChromePath, delay, smartWait } = require('./chrome-path');
const { loadEnvConfig } = require('./env-config');

// 加载环境配置
loadEnvConfig();

// 等待元素变化的通用函数
const waitForElementChange = async (page, options = {}) => {
  const {
    selector,
    changeType = 'disappear',
    timeout = 10000,
    expectedCount = null
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

// 页面跳转等待函数
// waitForPageTransition 函数已移除，使用 smartWait 替代以提高性能



// 执行群聊创建步骤的函数
const executeGroupCreationSteps = async (page, processedTitle, processedAdminInfo, itemIndex) => {
  try {
    // 步骤1: 点击选择群主按钮
    console.log('查找选择群主按钮...');
    
    // 根据提供的HTML结构，使用更精确的选择器
    const selectOwnerBtn = await page.$('.ww_btnWithMenu.js_ownerDropdown .qui_btn.ww_btn.ww_btn_Dropdown');
    
    if (selectOwnerBtn) {
      await selectOwnerBtn.scrollIntoView();
      await smartWait(page, { fallbackDelay: [800, 1500] });
      await selectOwnerBtn.click();
      console.log('成功点击选择群主按钮');
      
      // 等待下拉菜单出现
          console.log('等待下拉菜单加载...');
          await smartWait(page, { selector: '#memberSearchInput', action: 'appear', timeout: 5000 });
      
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
          await smartWait(page, { selector: '#memberSearchInput', action: 'stable', timeout: 3000 });
          
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
           
            await smartWait(page, { fallbackDelay: [300, 800] });
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
          await smartWait(page, { fallbackDelay: [300, 800] });
          
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
          await searchInput.type(processedAdminInfo, { delay: 100 });
          console.log(`成功在搜索框中输入: ${processedAdminInfo}`);
          
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
          }, processedAdminInfo);
          console.log(`备用方法成功输入: ${processedAdminInfo}`);
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
            await smartWait(page, { selector: '.ww_searchResult_title_peopleName.selected, .ww_memberItem_selected', action: 'appear', timeout: 5000 });
              
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
                      await smartWait(page, { selector: '.qui_btn.ww_btn.ww_btn_Blue.js_submit', action: 'stable', timeout: 3000 });
                      await confirmBtn.click();
                      console.log('成功点击确认按钮');
                      
                      // 等待弹窗关闭
                      console.log('等待弹窗关闭...');
                      await smartWait(page, { selector: '.multiPickerDlg_right_cnt', action: 'disappear', timeout: 5000 });
                      
                      // 弹窗关闭后的操作
                      await handleGroupNameInput(page, processedTitle, itemIndex);
                      
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
const handleGroupNameInput = async (page, processedTitle, itemIndex) => {
  try {
    console.log('等待回到群聊创建页面...');
    await smartWait(page, { selector: '.qui_inputText.ww_inputText.ww_inputText_Big.js_chatGroup_name', action: 'appear', timeout: 5000 });
    
    // 在群名称输入框中粘贴copy1内容
    console.log('查找群名称输入框...');
    const groupNameInput = await page.$('.qui_inputText.ww_inputText.ww_inputText_Big.js_chatGroup_name');
    
    if (groupNameInput) {
      await groupNameInput.scrollIntoView();
      await smartWait(page, { selector: '.qui_inputText.ww_inputText', action: 'stable', timeout: 3000 });
      
      // 清空输入框并输入processedTitle内容
      await groupNameInput.click();
      await smartWait(page, { fallbackDelay: [500, 1000] });
      await groupNameInput.evaluate(el => el.value = '');
      await groupNameInput.type(processedTitle);
      console.log(`成功在群名称输入框中输入: ${processedTitle}`);
      
      await smartWait(page, { fallbackDelay: [800, 1500] });
      
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
          await smartWait(page, { selector: '.qui_dialog_foot .qui_btn.ww_btn.ww_btn_Blue[d_ck="submit"]', action: 'stable', timeout: 3000 });
          
          // 使用精确的选择器定位确定按钮
          const finalConfirmBtn = await page.$('.qui_dialog_foot .qui_btn.ww_btn.ww_btn_Blue[d_ck="submit"]');
          
          if (finalConfirmBtn) {
            console.log('找到确定按钮，准备点击...');
            
            // 确保按钮在视窗中可见
            await finalConfirmBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await smartWait(page, { selector: '.qui_dialog_foot .qui_btn.ww_btn.ww_btn_Blue[d_ck="submit"]', action: 'stable', timeout: 2000 });
            
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
              
              // 简化等待机制：只等待对话框消失
              console.log('等待对话框关闭...');
              const dialogClosed = await smartWait(page, {
                selector: '.qui_dialog_foot',
                action: 'hidden',
                timeout: 5000,
                fallbackDelay: [800, 1200]
              });
              
              if (dialogClosed) {
                console.log('✅ 对话框已关闭，操作完成');
              } else {
                console.log('⚠️ 对话框关闭检测超时，使用回退延迟后继续');
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
                
                // 简化等待：只等待对话框消失
                await smartWait(page, {
                  selector: '.qui_dialog_foot',
                  action: 'hidden',
                  timeout: 5000,
                  fallbackDelay: [800, 1200]
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
        
        await smartWait(page, { fallbackDelay: [500, 1000] });
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
    await smartWait(page, { selector: '.csPlugin_mod_item_opt .qui_btn.ww_btn.ww_btn_Blue.js_save_form', action: 'stable', timeout: 5000 });
    
    // 使用精确的选择器定位保存按钮
    const saveBtn = await page.$('.csPlugin_mod_item_opt .qui_btn.ww_btn.ww_btn_Blue.js_save_form');
    
    if (saveBtn) {
      console.log('找到保存按钮，准备点击...');
      
      // 确保按钮在视窗中可见
      await saveBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await smartWait(page, { selector: '.csPlugin_mod_item_opt .qui_btn.ww_btn.ww_btn_Blue.js_save_form', action: 'stable', timeout: 3000 });
      
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
          // 找到第554行的 console.log('✅ 成功点击保存按钮'); 后添加
          console.log('✅ 成功点击保存按钮');
          console.log(`[Worker ${process.pid}] 修改${validTitle}为${processedTitle}`);
          
          
          // 等待保存操作完成（短暂等待，不等待页面跳转）
          await smartWait(page, { fallbackDelay: [1000, 2000] });
          
          console.log(`✅ 第 ${itemIndex + 1} 条数据保存操作完成，准备关闭页面`);
          
        } catch (clickError) {
          console.log('直接点击失败，尝试JavaScript点击...', clickError);
          
          // 方法2: JavaScript点击
          await page.evaluate(el => {
            el.click();
          }, saveBtn);
          console.log('✅ 使用JavaScript成功点击保存按钮');
          
          // 等待保存操作完成
          await smartWait(page, { fallbackDelay: [1000, 2000] });
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
            await smartWait(page, { fallbackDelay: [500, 1000] });
            
            await btn.click();
            console.log('✅ 备用方法点击保存按钮成功');
            
            // 等待保存操作完成
            await smartWait(page, { fallbackDelay: [1000, 2000] });
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
        await smartWait(page, { fallbackDelay: [1000, 2000] });
        console.log(`✅ 第 ${itemIndex + 1} 条数据保存操作完成，准备关闭页面`);
      }
    } catch (textError) {
      console.error('通过文本查找也失败:', textError);
    }
  }
};

// 执行添加操作的函数
const performAddOperations = async (page, processedTitle, processedAdminInfo, itemIndex) => {
  await smartWait(page, { fallbackDelay: [800, 1500] });
  
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
            await executeGroupCreationSteps(page, processedTitle, processedAdminInfo, itemIndex);
            
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
const processEditPageDirectly = async (page, browser, itemIndex, validTitle, validAdminInfo) => {
  try {
    console.log(`[Worker ${process.pid}] 开始处理编辑页面...`);
    console.log(`[Worker ${process.pid}] 使用预筛选的数据: ${validTitle}`);
    
    // 直接使用传递过来的有效数据，不再重新检测
    if (validTitle && validTitle !== null) {
      // 直接处理标题信息，无需调用processGroupInfo函数
      console.log('开始处理标题信息');
      
      // 处理标题：查找"群"字前面的阿拉伯数字进行加1处理
      let processedTitle = validTitle;
      
      // 使用正则表达式查找"群"字前面的阿拉伯数字
      const groupNumberMatch = validTitle.match(/(\d+)群/);
      
      if (groupNumberMatch) {
        // 找到"群"前面的数字
        const currentNumber = parseInt(groupNumberMatch[1]);
        const newNumber = currentNumber + 1;
        
        // 替换原数字为新数字
        processedTitle = validTitle.replace(/(\d+)群/, `${newNumber}群`);
        
        console.log(`找到群前面的数字 ${currentNumber}，处理后: ${processedTitle}`);
      } else {
        // 如果找不到"群"前面的阿拉伯数字，认为数据有问题，抛出异常
        console.error(`❌ 标题格式错误：未找到"群"前面的阿拉伯数字，标题: ${validTitle}`);
        
        // 保存错误截图
        await saveScreenshot(page, `error_invalid_title_${itemIndex}`);
      
        // 关闭浏览器
        await browser.close();
      }
      
      // 处理后的群名称
       console.log(`处理后的群名称: ${processedTitle}`);
       
       // 从管理员信息中提取群主信息
       let processedAdminInfo = '';
       const groupOwnerPrefix = '群主：';
       const groupOwnerIndex = validAdminInfo.indexOf(groupOwnerPrefix);
       
       if (groupOwnerIndex !== -1) {
         // 找到"群主："，截取后面的内容
         processedAdminInfo = validAdminInfo.substring(groupOwnerIndex + groupOwnerPrefix.length).trim();
         console.log(`从管理员信息中提取群主信息: ${processedAdminInfo}`);
       } else {
         // 如果找不到"群主："，认为数据有问题，抛出异常
         console.error(`❌ 管理员信息格式错误：未找到"群主："，管理员信息: ${validAdminInfo}`);
         
         // 保存错误截图
         await saveScreenshot(page, `error_invalid_admin_${itemIndex}`);
         
         // 关闭浏览器
         await browser.close();
         
       }
       
       console.log(`提取的群主信息: ${processedAdminInfo}`);
       
       console.log('数据处理完成，开始执行操作');
       
       // 执行删除操作
       try {
         await performDeleteOperations(page);
         
         // 执行添加操作，直接使用处理后的数据
         await performAddOperations(page, processedTitle, processedAdminInfo, itemIndex);
        
      } catch (error) {
        console.error('删除操作时出错:', error);
      }
      
    } else {
      console.log(`第 ${itemIndex + 1} 条数据：无效的群组标题信息`);
      return false;
    }
    
  } catch (error) {
    console.error(`[Worker ${process.pid}] 处理编辑页面时出错:`, error);
  }
};

// 工作进程主函数
const workerMain = async () => {
  const args = process.argv.slice(2);
  const tempFile = args[0]; // 现在第一个参数是临时文件路径
  
  let taskData;
  try {
    // 从临时文件读取数据
    const fileContent = fs.readFileSync(tempFile, 'utf8');
    taskData = JSON.parse(fileContent);
    console.log(`[Worker ${process.pid}] 从临时文件读取数据: ${tempFile}`);
  } catch (error) {
    console.error(`[Worker ${process.pid}] 读取临时文件失败: ${error.message}`);
    process.exit(1);
  }
  
  const { itemIndex, targetUrl, editUrl, validTitle, validAdminInfo, authData } = taskData;
  
  let browser = null;
  let page = null;
  
  try {
    console.log(`[Worker ${process.pid}] 🚀 启动工作进程处理第 ${itemIndex + 1} 条数据...`);
    
    // 获取Chrome可执行文件路径
    const chromePath = getChromePath();
    
    console.log(`[Worker ${process.pid}] === 启动独立浏览器实例 ===`);
    console.log(`[Worker ${process.pid}] 使用Chrome路径: ${chromePath}`);
    
    try {
      // 启动独立的浏览器实例 - 性能优化版
      browser = await puppeteer.launch({
        executablePath: chromePath, // 指定Chrome可执行文件路径
        headless: false,
        devtools: false,
        slowMo: 50, // 减少操作延迟
        defaultViewport: null,
        args: [
          '--start-maximized',
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
      
      await smartWait(page, { fallbackDelay: [800, 1500] });
      
      // 等待编辑页面的删除按钮出现
      await waitForElementChange(page, {
        selector: '.ww_commonImg.ww_commonImg_DeleteItem.js_delete_chat',
        changeType: 'appear',
        timeout: 10000
      });await smartWait(page, { selector: '.ww_commonImg.ww_commonImg_DeleteItem.js_delete_chat', action: 'stable', timeout: 3000 });
      
      // 直接调用processEditPageDirectly函数处理编辑页面，使用预筛选的数据
      await processEditPageDirectly(page, browser, itemIndex, validTitle, validAdminInfo);      
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
    
    // 清理临时文件
    try {
      if (tempFile && fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
        console.log(`[Worker ${process.pid}] 清理临时文件: ${tempFile}`);
      }
    } catch (error) {
      console.error(`[Worker ${process.pid}] 清理临时文件失败: ${error.message}`);
    }
  }
};



// 启动工作进程
if (require.main === module) {
  workerMain();
}