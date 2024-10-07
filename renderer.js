const { marked } = require('marked');
const { ipcRenderer } = require('electron');

const markdownInput = document.getElementById('markdown-input');
const preview = document.getElementById('preview');
const editorTitle = document.querySelector('h1');
const editLabel = document.getElementById('editLabel');
const previewLabel = document.getElementById('previewLabel');
const editModeBtn = document.getElementById('edit-mode');
const previewModeBtn = document.getElementById('preview-mode');
const splitModeBtn = document.getElementById('split-mode');
const editorContainer = document.getElementById('editor');

let currentFilePath = null;

// 配置 marked 选项
marked.setOptions({
    breaks: true,
    gfm: true
});

function updatePreview() {
    const markdownText = markdownInput.value;
    const htmlText = marked.parse(markdownText);
    preview.innerHTML = htmlText;
}

function setViewMode(mode) {
    editorContainer.className = mode + '-mode';
    [editModeBtn, previewModeBtn, splitModeBtn].forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${mode}-mode`).classList.add('active');
}

function initializeEditor() {
    console.log('Initializing editor...');
    
    markdownInput.addEventListener('input', updatePreview);

    // 初始内容
    markdownInput.value = `# Welcome to Markdown Editor

This is a **bold** text, and this is an *italic* text.

## Features:
1. Real-time preview
2. GitHub-flavored Markdown
3. File management (New, Open, Save, Save As, Recent Files)

\`\`\`javascript
console.log('Hello, Markdown!');
\`\`\`

> This is a blockquote.

Enjoy writing!`;

    updatePreview();
    console.log('Editor initialized');

    // 设置默认视图模式
    setViewMode('split');

    // 应用保存的主题
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.className = savedTheme;
    ipcRenderer.send('change-theme', savedTheme);

    // 添加模式切换事件监听器
    editModeBtn.addEventListener('click', () => setViewMode('edit'));
    previewModeBtn.addEventListener('click', () => setViewMode('preview'));
    splitModeBtn.addEventListener('click', () => setViewMode('split'));

    // 添加右键菜单格式化处理
    ipcRenderer.on('format-text', (event, format) => {
        const start = markdownInput.selectionStart;
        const end = markdownInput.selectionEnd;
        const selectedText = markdownInput.value.substring(start, end);
        let formattedText = '';

        switch (format) {
            case 'bold':
                formattedText = `**${selectedText}**`;
                break;
            case 'italic':
                formattedText = `*${selectedText}*`;
                break;
            case 'orderedList':
                formattedText = `1. ${selectedText}`;
                break;
            case 'unorderedList':
                formattedText = `- ${selectedText}`;
                break;
            case 'link':
                formattedText = `[${selectedText}](url)`;
                break;
            case 'image':
                formattedText = `![${selectedText}](image_url)`;
                break;
        }

        markdownInput.value = markdownInput.value.substring(0, start) + formattedText + markdownInput.value.substring(end);
        updatePreview();
    });
}

// IPC 事件监听
ipcRenderer.on('file-new', () => {
    markdownInput.value = '';
    currentFilePath = null;
    ipcRenderer.send('reset-current-file-path'); // 发送消息到主进程
    updatePreview();
    ipcRenderer.send('update-title');
});

ipcRenderer.on('file-opened', (event, { content, filePath }) => {
    markdownInput.value = content;
    currentFilePath = filePath;
    updatePreview();
    ipcRenderer.send('update-title', filePath);
});

ipcRenderer.on('file-save', () => {
    ipcRenderer.send('save-file', markdownInput.value);
});

ipcRenderer.on('file-save-as', (event, filePath) => {
    currentFilePath = filePath;
    ipcRenderer.send('save-file-content', { filePath, content: markdownInput.value });
});

ipcRenderer.on('save-result', (event, result) => {
    if (result.success) {
        currentFilePath = result.filePath;
        ipcRenderer.send('update-title', currentFilePath);
        // 可以在这里添加一些用户反馈，比如显示一个"保存成功"的消息
    } else {
        // 处理保存失败的情况，比如显示一个错误消息
        console.error('Failed to save file:', result.message);
    }
});

ipcRenderer.on('language-changed', (event, lang) => {
    updateLanguage(lang);
});

function updateLanguage(lang) {
    ipcRenderer.invoke('get-translation', 'appTitle').then(text => editorTitle.textContent = text);
    ipcRenderer.invoke('get-translation', 'editLabel').then(text => editLabel.textContent = text);
    ipcRenderer.invoke('get-translation', 'previewLabel').then(text => previewLabel.textContent = text);
    ipcRenderer.invoke('get-translation', 'inputPlaceholder').then(text => markdownInput.placeholder = text);
    ipcRenderer.invoke('get-translation', 'editMode').then(text => editModeBtn.textContent = text);
    ipcRenderer.invoke('get-translation', 'previewMode').then(text => previewModeBtn.textContent = text);
    ipcRenderer.invoke('get-translation', 'splitMode').then(text => splitModeBtn.textContent = text);
}

// 应用主题变更
ipcRenderer.on('theme-changed', (event, theme) => {
    document.body.className = theme;
    localStorage.setItem('theme', theme);
});

document.addEventListener('DOMContentLoaded', initializeEditor);