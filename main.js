const { app, BrowserWindow, Menu, dialog, ipcMain, contextBridge } = require('electron');
const path = require('path');
const fs = require('fs');
const i18n = require('./i18n');

// 添加热重载
try {
  require('electron-reloader')(module, {
    debug: true,
    watchRenderer: true
  });
} catch (_) { console.log('Error'); }

let mainWindow;
let settingsWindow;
let recentFiles = [];
let currentLanguage = 'zh'; // 默认使用中文
let currentFilePath = null; // 添加这行来定义 currentFilePath
let currentTheme = 'light'; // 默认主题
let contextMenu;

function createWindow() {
  console.log('Creating window...');
  mainWindow = new BrowserWindow({
    width: 1200,  // 可以根据需要调整
    height: 800,  // 可以根据需要调整
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  console.log('Loading index.html...');
  mainWindow.loadFile('index.html');

  updateContextMenu();
  updateMenu();
  updateWindowTitle();
}

function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 300,
    height: 300,
    parent: mainWindow,
    modal: true,
    frame: false,  // 移除窗口框架
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  settingsWindow.loadFile('settings.html');
  settingsWindow.setMenu(null);

  // 初始化语言和主题
  settingsWindow.webContents.on('did-finish-load', () => {
    settingsWindow.webContents.send('init-settings', { lang: currentLanguage, theme: currentTheme });
  });

  // 当窗口失去点时关闭
  settingsWindow.on('blur', () => {
    settingsWindow.close();
  });
}

app.whenReady().then(() => {
  console.log('App is ready. Creating window...');
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function updateMenu() {
  const menu = Menu.buildFromTemplate(getMenuTemplate());
  Menu.setApplicationMenu(menu);
    
}

function getMenuTemplate() {
  return [
    {
      label: i18n.t('settings'),
      submenu: [
        {
          label: i18n.t('settings'),
          click() { createSettingsWindow(); }
        }
      ]
    },
    {
      label: i18n.t('file'),
      submenu: [
        {
          label: i18n.t('new'),
          accelerator: 'CmdOrCtrl+N',
          click() { mainWindow.webContents.send('file-new'); }
        },
        {
          label: i18n.t('open'),
          accelerator: 'CmdOrCtrl+O',
          click() { openFile(); }
        },
        {
          label: i18n.t('save'),
          accelerator: 'CmdOrCtrl+S',
          click() { mainWindow.webContents.send('file-save'); }
        },
        {
          label: i18n.t('saveAs'),
          accelerator: 'CmdOrCtrl+Shift+S',
          click() { saveFileAs(); }
        },
        { type: 'separator' },
        {
          label: i18n.t('recentFiles'),
          submenu: getRecentFilesSubmenu()
        },
        { type: 'separator' },
        { role: 'quit', label: i18n.t('quit') }
      ]
    },
    {
      label: i18n.t('edit'),
      submenu: [
        { role: 'undo', label: i18n.t('undo') },
        { role: 'redo', label: i18n.t('redo') },
        { type: 'separator' },
        { role: 'cut', label: i18n.t('cut') },
        { role: 'copy', label: i18n.t('copy') },
        { role: 'paste', label: i18n.t('paste') }
      ]
    }
  ];
}

function getRecentFilesSubmenu() {
  const recentFilesSubmenu = recentFiles.map((file, index) => ({
    label: file,
    click() { openRecentFile(file); }
  }));

  if (recentFilesSubmenu.length === 0) {
    recentFilesSubmenu.push({ label: 'No recent files', enabled: false });
  } else {
    recentFilesSubmenu.push(
      { type: 'separator' },
      { label: 'Clear Recent Files', click() { clearRecentFiles(); } }
    );
  }

  return recentFilesSubmenu;
}

function openFile() {
  dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Markdown Files', extensions: ['md'] }]
  }).then(result => {
    if (!result.canceled) {
      const filePath = result.filePaths[0];
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          console.error("An error ocurred reading the file :" + err.message);
          return;
        }
        currentFilePath = filePath; // 更新 currentFilePath
        mainWindow.webContents.send('file-opened', { content: data, filePath });
        addRecentFile(filePath);
        updateWindowTitle(filePath);
      });
    }
  });
}

function saveFileAs() {
  dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'Markdown Files', extensions: ['md'] }]
  }).then(result => {
    if (!result.canceled) {
      currentFilePath = result.filePath; // 更新 currentFilePath
      fs.writeFile(currentFilePath, markdownInput.value, (err) => {
        if (err) {
          console.error("An error occurred writing the file :" + err.message);
          mainWindow.webContents.send('save-result', { success: false, message: err.message });
        } else {
          addRecentFile(currentFilePath);
          mainWindow.webContents.send('save-result', { success: true, filePath: currentFilePath });
        }
      });
      updateWindowTitle(currentFilePath);
    }
  });
}

function addRecentFile(filePath) {
  recentFiles = recentFiles.filter(file => file !== filePath);
  recentFiles.unshift(filePath);
  recentFiles = recentFiles.slice(0, 5); // Keep only the 5 most recent files
  updateMenu();
}

function openRecentFile(filePath) {
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error("An error ocurred reading the file :" + err.message);
      return;
    }
    mainWindow.webContents.send('file-opened', { content: data, filePath });
  });
}

function clearRecentFiles() {
  recentFiles = [];
  updateMenu();
}

ipcMain.on('save-file-content', (event, { filePath, content }) => {
  fs.writeFile(filePath, content, (err) => {
    if (err) {
      console.error("An error ocurred writing the file :" + err.message);
    } else {
      addRecentFile(filePath);
    }
  });
});

ipcMain.on('change-language', (event, lang) => {
  currentLanguage = lang;
  i18n.setLanguage(lang);
  updateMenu();
  updateContextMenu();
  mainWindow.webContents.send('language-changed', i18n.language);
});

ipcMain.handle('get-translation', (event, key) => {
  return i18n.t(key);
});

ipcMain.on('save-file', (event, content) => {
  if (currentFilePath) {
    fs.writeFile(currentFilePath, content, (err) => {
      if (err) {
        console.error("An error occurred writing the file :" + err.message);
        mainWindow.webContents.send('save-result', { success: false, message: err.message });
      } else {
        addRecentFile(currentFilePath);
        mainWindow.webContents.send('save-result', { success: true, filePath: currentFilePath });
      }
    });
  } else {
    saveFileAs();
  }
});

ipcMain.on('save-file-as', (event, content) => {
  saveFileAs();
});

ipcMain.on('reset-current-file-path', () => {
  currentFilePath = null;
});

ipcMain.on('change-theme', (event, theme) => {
  currentTheme = theme;
  mainWindow.webContents.send('theme-changed', theme);
});

function updateWindowTitle(filePath) {
  const fileName = filePath ? path.basename(filePath) : i18n.t('untitled');
  const title = `${i18n.t('appTitle')} - ${fileName}`;
  mainWindow.setTitle(title);
}

function updateContextMenu() {
  contextMenu = Menu.buildFromTemplate([
    { label: i18n.t('bold'), click: () => mainWindow.webContents.send('format-text', 'bold') },
    { label: i18n.t('italic'), click: () => mainWindow.webContents.send('format-text', 'italic') },
    { label: i18n.t('orderedList'), click: () => mainWindow.webContents.send('format-text', 'orderedList') },
    { label: i18n.t('unorderedList'), click: () => mainWindow.webContents.send('format-text', 'unorderedList') },
    { label: i18n.t('link'), click: () => mainWindow.webContents.send('format-text', 'link') },
    { label: i18n.t('image'), click: () => mainWindow.webContents.send('format-text', 'image') },
  ]);

  mainWindow.webContents.on('context-menu', (e, params) => {
    contextMenu.popup(mainWindow, params.x, params.y);
  });
}

console.log('main.js loaded');