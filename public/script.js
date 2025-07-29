class AutomationController {
    constructor() {
        this.isRunning = false;
        this.autoScroll = true;
        this.initializeElements();
        this.bindEvents();
        this.startStatusPolling();
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
        }, 2000); // 每2秒检查一次状态
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new AutomationController();
});