// @ts-check
const { contextBridge, webUtils, ipcRenderer } = require('electron');

/**
 * @typedef {import('./types.d.ts').RenameOperation} RenameOperation
 * @typedef {import('./types.d.ts').RenameResult} RenameResult
 * @typedef {import('./types.d.ts').FileInfo} FileInfo
 */

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Get file path for a File object
   * @param {File} file - The File object to get path for
   * @returns {string} The file path
   */
  getPathForFile: (file) => {
    return webUtils.getPathForFile(file);
  },
  
  /**
   * Rename files using the main process
   * @param {RenameOperation[]} renameOperations - Array of rename operations
   * @returns {Promise<RenameResult[]>} Promise resolving to rename results
   */
  renameFiles: (renameOperations) => {
    return ipcRenderer.invoke('rename-files', renameOperations);
  },
  
  /**
   * Open file dialog to select files
   * @returns {Promise<FileInfo[]>} Promise resolving to selected files
   */
  selectFiles: () => {
    return ipcRenderer.invoke('select-files');
  },
  
  /**
   * Get file entries for a path — returns the file itself, or immediate children if it's a directory
   * @param {string} filePath - File or folder path
   * @returns {Promise<FileInfo[]>} Promise resolving to file entries
   */
  getFileEntries: (filePath) => {
    return ipcRenderer.invoke('get-file-entries', filePath);
  }
});