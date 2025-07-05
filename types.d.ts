/**
 * Represents a file with basic information
 */
export interface FileInfo {
  /** The file name */
  name: string;
  /** The file path */
  path: string;
  /** The file size in bytes (optional) */
  size?: number;
}

/**
 * Represents a rule for renaming files
 */
export interface RenameRule {
  /** The type of rename operation */
  type: 'regex' | 'replace' | 'trim' | 'prefix' | 'suffix' | 'insert-prefix' | 'insert-suffix';
  /** Regular expression pattern (for regex type) */
  pattern?: string;
  /** Text to search for (for replace type) */
  search?: string;
  /** Replacement text */
  replacement?: string;
  /** Regular expression flags (for regex type) */
  flags?: string;
  /** Position to trim from (for trim type) */
  position?: 'start' | 'end';
  /** Number of characters to trim (for trim type) */
  count?: number;
  /** Text to add (for prefix/suffix type) */
  text?: string;
}

/**
 * Represents the result of a file rename operation
 */
export interface RenameResult {
  /** Whether the rename was successful */
  success: boolean;
  /** The original file name */
  originalName: string;
  /** The new file name (if successful) */
  newName?: string;
  /** The new file path (if successful) */
  path?: string;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Represents a preview of how a file would be renamed
 */
export interface PreviewResult {
  /** The original file name */
  originalName: string;
  /** The new file name after applying rules */
  newName: string;
  /** The file path */
  path: string;
}

/**
 * Represents a rename operation to be performed
 */
export interface RenameOperation {
  /** The original file path */
  originalPath: string;
  /** The original file name */
  originalName: string;
  /** The new file name */
  newName: string;
}

/**
 * Electron API exposed to the renderer process
 */
export interface ElectronAPI {
  /** Get the file system path for a File object */
  getPathForFile: (file: File) => string;
  /** Rename files using the main process */
  renameFiles: (renameOperations: RenameOperation[]) => Promise<RenameResult[]>;
  /** Open file dialog to select files */
  selectFiles: () => Promise<FileInfo[]>;
  /** Check if a path is a directory */
  isDirectory: (filePath: string) => Promise<boolean>;
  /** Read contents of a folder */
  readFolderContents: (folderPath: string) => Promise<FileInfo[]>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    fileRenamer: any;
  }
}