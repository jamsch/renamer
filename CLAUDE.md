# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm start` or `npm run dev` - Start the Electron application
- `electron .` - Direct Electron execution

## Architecture Overview

This is an Electron-based file renaming application with a secure three-process architecture:

### Main Process (`main.js`)
- Creates the main window (1200x800px) with DevTools enabled
- Implements secure context isolation and sandboxing
- Handles IPC communication through three handlers:
  - `rename-files` - Performs actual file renaming operations
  - `select-files` - Opens file selection dialog  
  - `read-folder-contents` - Reads directory contents (files only, not subdirectories)

### Preload Script (`preload.cjs`)
- Uses CommonJS format for Node.js compatibility
- Exposes secure API to renderer via `contextBridge`
- Bridges: `getPathForFile`, `renameFiles`, `selectFiles`, `readFolderContents`

### Renderer Process (`renderer.js`)
- Main application class: `FileRenamer`
- Handles drag-and-drop for both files and folders
- Manages rule-based renaming system with real-time preview
- Supports multi-file selection with keyboard shortcuts (Ctrl/Cmd + click, Shift + click)
- Implements resizable table columns and tabbed interface

## Key Features

### Rule System
Rules operate only on the base filename (without extension):
- Replace Text / Regex Replace
- Trim Characters (start/end)
- Add/Insert Prefix/Suffix
- Rules can be enabled/disabled individually
- Live preview shows changes before applying

### File Handling
- Drag-and-drop support for files and folders
- Folders are automatically expanded to their immediate files
- Multi-selection with visual feedback
- Error handling with detailed feedback per file
- Path resolution using Electron's `webUtils.getPathForFile`

### Security
- Context isolation enabled with secure IPC
- No direct Node.js access from renderer
- Sandbox disabled for file system operations
- webSecurity disabled for local file access

## TypeScript Integration

- Comprehensive type definitions in `types.d.ts`
- JSDoc comments throughout for type checking
- Key interfaces: `FileInfo`, `RenameRule`, `RenameResult`, `RenameOperation`, `ElectronAPI`
- Uses ES modules (`"type": "module"` in package.json)

## UI Structure

- Main file table with columns: Status, Original Name, New Name, Error
- Rules table with drag-reorder functionality
- Tabbed interface (Files, Columns, Options, Export, Filters, Analyze)
- Status bar showing file count
- Resizable columns with mouse interaction