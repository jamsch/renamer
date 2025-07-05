// @ts-check
import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

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
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      sandbox: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    icon: path.join(__dirname, "assets/icon.png"),
  });

  mainWindow.loadFile("index.html");

  // Open DevTools
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for file operations
ipcMain.handle(
  "rename-files",
  async (
    _event,
    /** @type {Array<{originalPath: string, originalName: string, newName: string}>} */ renameOperations
  ) => {
    /** @type {RenameResult[]} */
    const results = [];

    for (const operation of renameOperations) {
      try {
        // Skip if no valid path provided
        if (!operation.originalPath || operation.originalPath.trim() === "") {
          results.push({
            success: false,
            originalName: operation.originalName,
            error:
              "No valid file path provided (drag-and-drop files not supported for renaming)",
          });
          continue;
        }

        const newPath = path.join(
          path.dirname(operation.originalPath),
          operation.newName
        );

        fs.renameSync(operation.originalPath, newPath);
        results.push({
          success: true,
          originalName: operation.originalName,
          newName: operation.newName,
          path: newPath,
        });
      } catch (error) {
        results.push({
          success: false,
          originalName: operation.originalName,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  }
);

// Add handler for opening file dialog
ipcMain.handle("select-files", async () => {
  if (!mainWindow) return [];

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "All Files", extensions: ["*"] }],
  });

  if (!result.canceled) {
    return result.filePaths.map((filePath) => ({
      name: path.basename(filePath),
      path: filePath,
      size: fs.statSync(filePath).size,
    }));
  }

  return [];
});
