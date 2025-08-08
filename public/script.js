class AutomationController {
    constructor() {
        this.isRunning = false;
        this.autoScroll = true;
        this.initializeElements();
        this.bindEvents();
        this.loadConfig(); // 添加这行：页面加载时加载配置
        this.startStatusPolling();
        this.loadLogFiles();
    }

    // 添加加载配置的方法
    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            const config = await response.json();
            
            this.elements.searchKeyword.value = config.searchKeyword;
            this.elements.maxItems.value = config.maxItems;
            
            this.showMessage(`已从.env文件加载配置：关键词="${config.searchKeyword}"，最大数量=${config.maxItems}`, 'info');
        } catch (error) {
            console.error('加载配置失败:', error);
            this.showMessage('无法从.env文件加载配置，使用默认值', 'warning');
        }
    }


initializeElements() {
        this.elements = {
            searchKeyword: document.getElementById('searchKeyword'),
            maxItems: document.getElementById('maxItems'),
            startBtn: document.getElementById('startBtn'),
            stopBtn: document.getElementById('stopBtn'),
            clearLogsBtn: document.getElementById('clearLogsBtn'),
            refreshLogsBtn: document.getElementById('refreshLogsBtn'),
            autoScrollBtn: document.getElementById('autoScrollBtn'),
            downloadLogsBtn: document.getElementById('downloadLogsBtn'),
            logFilesSelect: document.getElementById('logFilesSelect'),
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText'),
            logsContainer: document.getElementById('logsContainer')
        };
    }

    bindEvents() {
        this.elements.startBtn.addEventListener('click', () => this.startAutomation());
        this.elements.stopBtn.addEventListener('click', () => this.stopAutomation());
        this.elements.clearLogsBtn.addEventListener('click', () => this.clearLogs());
        this.elements.refreshLogsBtn.addEventListener('click', () => this.refreshLogs());
        this.elements.autoScrollBtn.addEventListener('click', () => this.toggleAutoScroll());
        this.elements.downloadLogsBtn.addEventListener('click', () => this.downloadLogs()); // 添加这行
    }

    async startAutomation() {
        const searchKeyword = this.elements.searchKeyword.value.trim();
        const maxItems = parseInt(this.elements.maxItems.value) || -1;

        if (!searchKeyword) {
            alert('请输入搜索关键词');
            return;
        }

        try {
            const response = await fetch('/api/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ searchKeyword, maxItems })
            });

            const result = await response.json();

            if (response.ok) {
                this.showMessage('任务启动成功', 'success');
            } else {
                this.showMessage(result.error || '启动失败', 'error');
            }
        } catch (error) {
            this.showMessage('网络错误: ' + error.message, 'error');
        }
    }

    async stopAutomation() {
        try {
            const response = await fetch('/api/stop', {
                method: 'POST'
            });

            const result = await response.json();

            if (response.ok) {
                this.showMessage('任务已停止', 'warning');
            } else {
                this.showMessage(result.error || '停止失败', 'error');
            }
        } catch (error) {
            this.showMessage('网络错误: ' + error.message, 'error');
        }
    }

    clearLogs() {
        this.elements.logsContainer.innerHTML = '<div class="log-entry info"><span class="timestamp">[已清空]</span><span class="message">日志已清空</span></div>';
    }

    async refreshLogs() {
        try {
            const response = await fetch('/api/logs');
            const result = await response.json();
            this.updateLogs(result.logs);
        } catch (error) {
            this.showMessage('刷新日志失败: ' + error.message, 'error');
        }
    }

    toggleAutoScroll() {
        this.autoScroll = !this.autoScroll;
        this.elements.autoScrollBtn.classList.toggle('active', this.autoScroll);
        this.elements.autoScrollBtn.textContent = this.autoScroll ? '自动滚动' : '手动滚动';
    }

    updateStatus(isRunning) {
        this.isRunning = isRunning;
        
        this.elements.startBtn.disabled = isRunning;
        this.elements.stopBtn.disabled = !isRunning;
        
        this.elements.statusIndicator.className = `status-indicator ${isRunning ? 'running' : ''}`;
        this.elements.statusText.textContent = isRunning ? '运行中' : '就绪';
    }

    updateLogs(logs) {
        if (!logs || logs.length === 0) return;

        this.elements.logsContainer.innerHTML = '';
        
        logs.forEach(log => {
            const logElement = document.createElement('div');
            logElement.className = `log-entry ${log.type}`;
            logElement.innerHTML = `
                <span class="timestamp">[${log.timestamp}]</span>
                <span class="message">${this.escapeHtml(log.message)}</span>
            `;
            this.elements.logsContainer.appendChild(logElement);
        });

        if (this.autoScroll) {
            this.elements.logsContainer.scrollTop = this.elements.logsContainer.scrollHeight;
        }
    }

    showMessage(message, type = 'info') {
        const timestamp = new Date().toLocaleString();
        const logElement = document.createElement('div');
        logElement.className = `log-entry ${type}`;
        logElement.innerHTML = `
            <span class="timestamp">[${timestamp}]</span>
            <span class="message">${this.escapeHtml(message)}</span>
        `;
        
        this.elements.logsContainer.appendChild(logElement);
        
        if (this.autoScroll) {
            this.elements.logsContainer.scrollTop = this.elements.logsContainer.scrollHeight;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async startStatusPolling() {
        setInterval(async () => {
            try {
                const response = await fetch('/api/status');
                const result = await response.json();
                
                this.updateStatus(result.isRunning);
                
                if (result.logs && result.logs.length > 0) {
                    this.updateLogs(result.logs);
                }
            } catch (error) {
                console.error('状态轮询失败:', error);
            }
        }, 2000);
    }

    // 将这三个方法移动到类内部
    async downloadLogs() {
        const selectedFile = this.elements.logFilesSelect.value;
        const url = selectedFile ? `/api/logs/download?date=${selectedFile}` : '/api/logs/download';
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('下载失败');
            
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = selectedFile ? `${selectedFile}.log` : new Date().toISOString().split('T')[0] + '.log';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
            
            this.showMessage('日志下载成功', 'success');
        } catch (error) {
            this.showMessage('下载日志失败: ' + error.message, 'error');
        }
    }

    async loadLogFiles() {
        try {
            const response = await fetch('/api/logs/files');
            const result = await response.json();
            
            this.elements.logFilesSelect.innerHTML = '<option value="">今日日志</option>';
            
            result.files.forEach(file => {
                const option = document.createElement('option');
                option.value = file.date;
                option.textContent = `${file.date} (${(file.size / 1024).toFixed(1)}KB)`;
                this.elements.logFilesSelect.appendChild(option);
            });
        } catch (error) {
            console.error('加载日志文件列表失败:', error);
            this.showMessage('加载日志文件列表失败: ' + error.message, 'error');
        }
    }
}

// 移除类外部的重复方法定义
// 只保留这个初始化代码
document.addEventListener('DOMContentLoaded', () => {
    new AutomationController();
});

