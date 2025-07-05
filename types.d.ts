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
 * Base rule interface with generic type parameter
 */
export interface BaseRule<T extends string, P = {}> {
  type: T;
  data: P;
}

/**
 * Specific rule types
 */
export interface ReplaceRule {
  search: string;
  replacement: string;
}

export interface ReplaceCaseInsensitiveRule {
  search: string;
  replacement: string;
  caseInsensitive: boolean;
}

export interface RegexRule {
  pattern: string;
  replacement: string;
  flags: string;
}

export interface TrimRule {
  position: "start" | "end";
  count: number;
}

export interface PrefixRule {
  text: string;
}

export interface SuffixRule {
  text: string;
}

export interface RemoveParenthesesRule {
  // No additional properties needed
}

export interface RemoveSquareBracketsRule {
  // No additional properties needed
}

export interface RemoveCurlyBracketsRule {
  // No additional properties needed
}

export interface TrimWhitespaceRule {
  // No additional properties needed
}

/**
 * Union type for all rename rules
 */
export type RenameRule =
  | BaseRule<"replace", ReplaceRule>
  | BaseRule<"replace-case-insensitive", ReplaceCaseInsensitiveRule>
  | BaseRule<"regex", RegexRule>
  | BaseRule<"trim", TrimRule>
  | BaseRule<"prefix", PrefixRule>
  | BaseRule<"suffix", SuffixRule>
  | BaseRule<"remove-parentheses", RemoveParenthesesRule>
  | BaseRule<"remove-square-brackets", RemoveSquareBracketsRule>
  | BaseRule<"remove-curly-brackets", RemoveCurlyBracketsRule>
  | BaseRule<"trim-whitespace", TrimWhitespaceRule>;

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
  /** Whether the rename was skipped */
  skipped?: boolean;
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
