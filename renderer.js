// @ts-check
const { ipcRenderer } = require('electron');

/**
 * @typedef {import('./types.d.ts').FileInfo} FileInfo
 * @typedef {import('./types.d.ts').RenameRule} RenameRule
 * @typedef {import('./types.d.ts').RenameResult} RenameResult
 * @typedef {import('./types.d.ts').PreviewResult} PreviewResult
 */

class FileRenamer {
  constructor() {
    /** @type {FileInfo[]} */
    this.files = [];
    
    /** @type {RenameRule[]} */
    this.rules = [];
    
    this.initializeEventListeners();
  }

  /**
   * Initialize all event listeners
   */
  initializeEventListeners() {
    const dropZone = /** @type {HTMLElement} */ (document.getElementById('fileTable'));
    const fileInput = /** @type {HTMLInputElement} */ (document.getElementById('fileInput'));
    
    // Toolbar buttons
    const addFilesBtn = /** @type {HTMLButtonElement} */ (document.getElementById('addFiles'));
    const addFoldersBtn = /** @type {HTMLButtonElement} */ (document.getElementById('addFolders'));
    const previewBtn = /** @type {HTMLButtonElement} */ (document.getElementById('preview'));
    const renameBtn = /** @type {HTMLButtonElement} */ (document.getElementById('renameBtn'));
    
    // Rule management buttons
    const addRuleBtn = /** @type {HTMLButtonElement} */ (document.getElementById('addRule'));
    const removeRuleBtn = /** @type {HTMLButtonElement} */ (document.getElementById('removeRule'));
    const upRuleBtn = /** @type {HTMLButtonElement} */ (document.getElementById('upRule'));
    const downRuleBtn = /** @type {HTMLButtonElement} */ (document.getElementById('downRule'));

    // File drop handling
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
    dropZone.addEventListener('drop', this.handleDrop.bind(this));
    dropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));

    fileInput.addEventListener('change', this.handleFileSelect.bind(this));

    // Toolbar actions
    addFilesBtn.addEventListener('click', () => fileInput.click());
    addFoldersBtn.addEventListener('click', this.addFolders.bind(this));
    previewBtn.addEventListener('click', this.previewChanges.bind(this));
    renameBtn.addEventListener('click', this.renameFiles.bind(this));

    // Rule management
    addRuleBtn.addEventListener('click', this.addRuleToTable.bind(this));
    removeRuleBtn.addEventListener('click', this.removeSelectedRule.bind(this));
    upRuleBtn.addEventListener('click', this.moveRuleUp.bind(this));
    downRuleBtn.addEventListener('click', this.moveRuleDown.bind(this));

    // Tab switching
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', this.switchTab.bind(this));
    });

    // Rule table click to add rule
    const emptyRule = document.querySelector('.empty-rule');
    if (emptyRule) {
      emptyRule.addEventListener('click', this.addRuleToTable.bind(this));
    }
  }

  /**
   * Handle drag over event
   * @param {DragEvent} e 
   */
  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const target = /** @type {HTMLElement} */ (e.target);
    target.closest('.drop-zone')?.classList.add('dragover');
  }

  /**
   * Handle drag leave event
   * @param {DragEvent} e 
   */
  handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    const target = /** @type {HTMLElement} */ (e.target);
    target.closest('.drop-zone')?.classList.remove('dragover');
  }

  /**
   * Handle file drop event
   * @param {DragEvent} e 
   */
  handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const target = /** @type {HTMLElement} */ (e.target);
    target.closest('.drop-zone')?.classList.remove('dragover');

    if (e.dataTransfer?.files) {
      const files = Array.from(e.dataTransfer.files);
      this.addFiles(files);
    }
  }

  /**
   * Handle file input change
   * @param {Event} e 
   */
  handleFileSelect(e) {
    const target = /** @type {HTMLInputElement} */ (e.target);
    if (target.files) {
      const files = Array.from(target.files);
      this.addFiles(files);
    }
  }

  /**
   * Add files to the list
   * @param {File[]} files 
   */
  addFiles(files) {
    files.forEach(file => {
      this.files.push({
        name: file.name,
        path: file.path || '',
        size: file.size
      });
    });

    this.updateFileTable();
  }

  /**
   * Update the file table display with preview
   */
  updateFileTable() {
    const tableBody = /** @type {HTMLTableSectionElement} */ (document.getElementById('fileTableBody'));
    tableBody.innerHTML = '';

    // Update status bar
    this.updateStatusBar();

    // Show drop zone message when empty
    if (this.files.length === 0) {
      const row = document.createElement('tr');
      row.className = 'drop-zone-message';
      row.innerHTML = `
        <td colspan="4" class="drop-message">Drag your files here</td>
      `;
      tableBody.appendChild(row);
      return;
    }

    const rules = this.getRules();

    this.files.forEach((file, index) => {
      const newName = this.applyRulesLocally(file.name, rules);
      const row = document.createElement('tr');
      
      const isUnchanged = newName === file.name;
      const hasError = false; // TODO: Implement error checking
      
      row.innerHTML = `
        <td>${hasError ? '❌' : '✅'}</td>
        <td class="original-name">${file.name}</td>
        <td class="new-name ${isUnchanged ? 'unchanged' : ''}">${newName}</td>
        <td>${hasError ? 'Error' : ''}</td>
      `;
      
      // Add click handler to select row
      row.addEventListener('click', () => {
        document.querySelectorAll('.file-table tbody tr').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
      });
      
      tableBody.appendChild(row);
    });
  }

  /**
   * Remove a file from the list
   * @param {number} index 
   */
  removeFile(index) {
    this.files.splice(index, 1);
    this.updateFileTable();
  }

  /**
   * Add a new rule to the rules table
   */
  addRuleToTable() {
    const rulesTableBody = /** @type {HTMLTableSectionElement} */ (document.getElementById('rulesTableBody'));
    
    // Remove empty message if it exists
    const emptyRule = rulesTableBody.querySelector('.empty-rule');
    if (emptyRule) {
      emptyRule.remove();
    }

    const ruleIndex = rulesTableBody.children.length + 1;
    const row = document.createElement('tr');
    row.className = 'rule-row';
    row.innerHTML = `
      <td>${ruleIndex}</td>
      <td>
        <select class="rule-type">
          <option value="replace">Replace Text</option>
          <option value="regex">Regex Replace</option>
          <option value="trim">Trim Characters</option>
          <option value="prefix">Add Prefix</option>
          <option value="suffix">Add Suffix</option>
        </select>
      </td>
      <td class="rule-statement">
        <input type="text" class="rule-input" placeholder="Search text" style="width: 45%; margin-right: 5px;">
        <input type="text" class="rule-input" placeholder="Replace with" style="width: 45%;">
      </td>
    `;

    // Add event listeners to update preview when rule inputs change
    const inputs = row.querySelectorAll('input, select');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        this.updateFileTable();
      });
      input.addEventListener('change', () => {
        this.updateFileTable();
      });
    });

    // Add click handler to select row
    row.addEventListener('click', () => {
      document.querySelectorAll('.rule-row').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
    });

    rulesTableBody.appendChild(row);
    this.updateRuleNumbers();
    this.updateFileTable();
  }

  /**
   * Get all rules from the interface
   * @returns {RenameRule[]}
   */
  getRules() {
    const ruleRows = document.querySelectorAll('.rule-row');
    /** @type {RenameRule[]} */
    const rules = [];

    ruleRows.forEach(row => {
      const typeSelect = /** @type {HTMLSelectElement} */ (row.querySelector('.rule-type'));
      const type = /** @type {RenameRule['type']} */ (typeSelect.value);
      const inputs = /** @type {NodeListOf<HTMLInputElement>} */ (row.querySelectorAll('.rule-input'));
      
      /** @type {RenameRule} */
      const rule = { type };

      switch (type) {
        case 'replace':
          rule.search = inputs[0].value;
          rule.replacement = inputs[1].value;
          break;
        case 'regex':
          rule.pattern = inputs[0].value;
          rule.replacement = inputs[1].value;
          rule.flags = 'g';
          break;
        case 'trim':
          rule.position = /** @type {'start' | 'end'} */ (inputs[0].value);
          rule.count = parseInt(inputs[1].value) || 1;
          break;
        case 'prefix':
          rule.text = inputs[0].value;
          break;
        case 'suffix':
          rule.text = inputs[0].value;
          break;
      }

      if (this.isValidRule(rule)) {
        rules.push(rule);
      }
    });

    return rules;
  }

  /**
   * Check if a rule is valid
   * @param {RenameRule} rule 
   * @returns {boolean}
   */
  isValidRule(rule) {
    switch (rule.type) {
      case 'replace':
        return !!(rule.search && rule.replacement !== undefined);
      case 'regex':
        return !!rule.pattern;
      case 'trim':
        return !!(rule.position && rule.count && rule.count > 0);
      case 'prefix':
      case 'suffix':
        return !!rule.text;
      default:
        return false;
    }
  }

  /**
   * Apply rules locally for preview (same logic as main process)
   * @param {string} filename 
   * @param {RenameRule[]} rules 
   * @returns {string}
   */
  applyRulesLocally(filename, rules) {
    let result = filename;
    
    for (const rule of rules) {
      switch (rule.type) {
        case 'regex':
          if (rule.pattern && rule.replacement !== undefined) {
            try {
              const regex = new RegExp(rule.pattern, rule.flags || 'g');
              result = result.replace(regex, rule.replacement);
            } catch (error) {
              // Invalid regex, skip this rule
              console.warn('Invalid regex pattern:', rule.pattern);
            }
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
            const lastDotIndex = result.lastIndexOf('.');
            if (lastDotIndex > 0) {
              const nameWithoutExt = result.substring(0, lastDotIndex);
              const ext = result.substring(lastDotIndex);
              result = nameWithoutExt + rule.text + ext;
            } else {
              result = result + rule.text;
            }
          }
          break;
      }
    }
    
    return result;
  }

  /**
   * Rename the files
   */
  async renameFiles() {
    if (this.files.length === 0) {
      alert('Please add some files first');
      return;
    }

    const rules = this.getRules();
    if (rules.length === 0) {
      alert('Please add at least one rule');
      return;
    }

    if (!confirm('Are you sure you want to rename these files? This action cannot be undone.')) {
      return;
    }

    try {
      const results = /** @type {RenameResult[]} */ (await ipcRenderer.invoke('rename-files', this.files, rules));
      this.displayResults(results);
    } catch (error) {
      console.error('Rename error:', error);
      alert('Error renaming files: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Display the rename results
   * @param {RenameResult[]} results 
   */
  displayResults(results) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    let message = `Renamed ${successful.length} file(s) successfully.`;
    if (failed.length > 0) {
      message += `\n${failed.length} file(s) failed to rename.`;
    }

    alert(message);

    // Clear files list after successful rename
    if (successful.length > 0) {
      this.files = [];
      this.updateFileTable();
    }
  }

  /**
   * Add folders functionality (placeholder)
   */
  addFolders() {
    alert('Add Folders functionality not yet implemented');
  }

  /**
   * Preview changes functionality
   */
  previewChanges() {
    this.updateFileTable();
    alert('Preview updated - check the file table for changes');
  }

  /**
   * Remove selected rule
   */
  removeSelectedRule() {
    const selectedRule = document.querySelector('.rule-row.selected');
    if (selectedRule) {
      selectedRule.remove();
      this.updateRuleNumbers();
      this.updateFileTable();
    } else {
      alert('Please select a rule to remove');
    }
  }

  /**
   * Move selected rule up
   */
  moveRuleUp() {
    const selectedRule = document.querySelector('.rule-row.selected');
    if (selectedRule && selectedRule.previousElementSibling) {
      selectedRule.parentNode.insertBefore(selectedRule, selectedRule.previousElementSibling);
      this.updateRuleNumbers();
      this.updateFileTable();
    }
  }

  /**
   * Move selected rule down
   */
  moveRuleDown() {
    const selectedRule = document.querySelector('.rule-row.selected');
    if (selectedRule && selectedRule.nextElementSibling) {
      selectedRule.parentNode.insertBefore(selectedRule.nextElementSibling, selectedRule);
      this.updateRuleNumbers();
      this.updateFileTable();
    }
  }

  /**
   * Update rule numbers in the table
   */
  updateRuleNumbers() {
    const ruleRows = document.querySelectorAll('.rule-row');
    ruleRows.forEach((row, index) => {
      const numberCell = row.querySelector('td:first-child');
      if (numberCell) {
        numberCell.textContent = (index + 1).toString();
      }
    });
  }

  /**
   * Switch between tabs
   * @param {Event} e
   */
  switchTab(e) {
    const target = /** @type {HTMLElement} */ (e.target);
    const tabName = target.dataset.tab;
    
    // Remove active class from all tabs
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    
    // Add active class to clicked tab
    target.classList.add('active');
    
    // Show/hide content based on tab (placeholder for now)
    console.log('Switched to tab:', tabName);
  }

  /**
   * Update status bar with file count
   */
  updateStatusBar() {
    const fileCount = document.getElementById('fileCount');
    if (fileCount) {
      fileCount.textContent = `${this.files.length} files`;
    }
  }
}

// Initialize the application
const fileRenamer = new FileRenamer();

// Make it globally accessible for HTML onclick handlers
window.fileRenamer = fileRenamer;