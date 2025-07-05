# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm start` or `npm run dev` - Start the Electron application. Don't run this though, because it should always be running
- `electron .` - Direct Electron execution

## Architecture Overview

This is an Electron-based file renaming application with a secure three-process architecture:

### Main Process (`main.js`)

- Creates the main window (1200x800px) with DevTools enabled
- Implements secure context isolation and sandboxing
- Handles IPC communication through handlers:
  - `rename-files` - Performs actual file renaming operations
  - `select-files` - Opens file selection dialog
  - `read-folder-contents` - Reads directory contents (files only, not subdirectories)
  - `is-directory` - Checks if a path is a directory

### Preload Script (`preload.cjs`)

- Uses CommonJS format for Node.js compatibility
- Exposes secure API to renderer via `contextBridge`
- Bridges: `getPathForFile`, `renameFiles`, `selectFiles`, `readFolderContents`, `isDirectory`

### Renderer Process (`renamer.js`)

- Main application class: `FileRenamer` (~1600 lines)
- Uses custom reactive signals system (`signals.js`) for state management
- Handles drag-and-drop for both files and folders
- Manages rule-based renaming system with real-time preview
- Supports multi-file selection with keyboard shortcuts (Ctrl/Cmd + click, Shift + click)
- Implements resizable table columns and complex UI interactions

## Reactive System

### Custom Signals Implementation (`signals.js`)

- **`createSignal(value)`** - Creates reactive state with getter/setter tuple
- **`createEffect(fn)`** - Runs function when dependencies change
- **`computed(fn)`** - Derives computed values from other signals
- Uses microtask scheduling for batched updates
- Automatic dependency tracking through effect stack

### Signal Integration in FileRenamer

- **`ruleSignals`** - Array of rule signal objects for dynamic form inputs
- **`fileSignals`** - Array of file signal objects for table rows
- **`renameResults`** - Map of rename operation results
- **`selectedRuleIndex`** - Currently selected rule for UI highlighting
- Each signal object contains multiple related signals (e.g., `nameSignal`, `selectedSignal`)

## Key Features

### Rule System

Rules operate only on the base filename (without extension):

- Replace Text / Regex Replace / Case-insensitive Replace
- Trim Characters (start/end) / Trim Whitespace
- Add/Insert Prefix/Suffix
- Remove brackets (parentheses, square, curly)
- Rules can be enabled/disabled individually
- Live preview shows changes before applying
- Rule reordering with drag-and-drop

### File Handling

- Drag-and-drop support for files and folders
- Folders are automatically expanded to their immediate files
- Multi-selection with visual feedback
- Error handling with detailed feedback per file
- Path resolution using Electron's `webUtils.getPathForFile`
- Rename results tracking with success/error/skip states

### Security

- Context isolation enabled with secure IPC
- No direct Node.js access from renderer
- Sandbox disabled for file system operations
- webSecurity disabled for local file access

## TypeScript Integration

- Comprehensive type definitions in `types.d.ts`
- JSDoc comments throughout for type checking without TypeScript compiler
- Key interfaces: `FileInfo`, `RenameRule`, `RenameResult`, `RenameOperation`, `ElectronAPI`
- Uses ES modules (`"type": "module"` in package.json)
- Signal type definitions for complex reactive objects

## UI Structure

- Main file table with columns: Checkbox, Original Name, New Name, Status
- Rules table with drag-reorder functionality
- File action buttons (Select All, Remove Selected, etc.)
- Status bar showing file count
- Resizable columns with mouse interaction
- Toast notifications for user feedback

## Development Patterns

### Adding New Web Components

1. Create component file in `components/` directory
2. Use Shadow DOM for style encapsulation
3. Register with `customElements.define()`
4. Import in `index.html` before main script
5. Reference in main application through DOM APIs

### Signal-Based State Management

- Use `createSignal()` for reactive state
- Wrap UI updates in `createEffect()` for automatic reactivity
- Group related signals into objects for complex state
- Batch updates happen automatically through microtask scheduling

### Rule System Extension

- Add new rule types to `RULE_TYPES` array
- Update `RULE_LABELS` mapping
- Implement rule logic in `applyRulesLocally()` method
- Create corresponding input components in `renderRuleInputs()`
