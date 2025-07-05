// @ts-check
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @typedef {import('./types.d.ts').FileInfo} FileInfo
 * @typedef {import('./types.d.ts').RenameRule} RenameRule
 * @typedef {import('./types.d.ts').RenameResult} RenameResult
 * @typedef {import('./types.d.ts').PreviewResult} PreviewResult
 */

/** @type {BrowserWindow | null} */
let mainWindow = null;

/**
 * Creates the main application window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets/icon.png')
  });

  mainWindow.loadFile('index.html');
  
  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for file operations
ipcMain.handle('rename-files', async (event, /** @type {FileInfo[]} */ files, /** @type {RenameRule[]} */ rules) => {
  /** @type {RenameResult[]} */
  const results = [];
  
  for (const file of files) {
    try {
      const newName = applyRules(file.name, rules);
      const newPath = path.join(path.dirname(file.path), newName);
      
      fs.renameSync(file.path, newPath);
      results.push({
        success: true,
        originalName: file.name,
        newName: newName,
        path: newPath
      });
    } catch (error) {
      results.push({
        success: false,
        originalName: file.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  return results;
});

ipcMain.handle('preview-rename', async (event, /** @type {FileInfo[]} */ files, /** @type {RenameRule[]} */ rules) => {
  return files.map(file => ({
    originalName: file.name,
    newName: applyRules(file.name, rules),
    path: file.path
  }));
});

/**
 * Applies renaming rules to a filename
 * @param {string} filename - The original filename
 * @param {RenameRule[]} rules - Array of rules to apply
 * @returns {string} The transformed filename
 */
function applyRules(filename, rules) {
  let result = filename;
  
  for (const rule of rules) {
    switch (rule.type) {
      case 'regex':
        if (rule.pattern && rule.replacement !== undefined) {
          const regex = new RegExp(rule.pattern, rule.flags || 'g');
          result = result.replace(regex, rule.replacement);
        }
        break;
      case 'replace':
        if (rule.search && rule.replacement !== undefined) {
          result = result.split(rule.search).join(rule.replacement);
        }
        break;
      case 'trim':
        if (rule.position === 'start' && rule.count) {
          result = result.substring(rule.count);
        } else if (rule.position === 'end' && rule.count) {
          result = result.substring(0, result.length - rule.count);
        }
        break;
      case 'prefix':
        if (rule.text) {
          result = rule.text + result;
        }
        break;
      case 'suffix':
        if (rule.text) {
          const ext = path.extname(result);
          const nameWithoutExt = path.basename(result, ext);
          result = nameWithoutExt + rule.text + ext;
        }
        break;
    }
  }
  
  return result;
}