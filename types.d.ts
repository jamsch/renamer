export interface FileInfo {
  name: string;
  path: string;
  size?: number;
}

export interface RenameRule {
  type: 'regex' | 'replace' | 'trim' | 'prefix' | 'suffix';
  pattern?: string;
  search?: string;
  replacement?: string;
  flags?: string;
  position?: 'start' | 'end';
  count?: number;
  text?: string;
}

export interface RenameResult {
  success: boolean;
  originalName: string;
  newName?: string;
  path?: string;
  error?: string;
}

export interface PreviewResult {
  originalName: string;
  newName: string;
  path: string;
}