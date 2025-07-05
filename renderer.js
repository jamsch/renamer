// @ts-check

/**
 * @typedef {import('./types.d.ts').FileInfo} FileInfo
 * @typedef {import('./types.d.ts').RenameRule} RenameRule
 * @typedef {import('./types.d.ts').RenameResult} RenameResult
 * @typedef {import('./types.d.ts').PreviewResult} PreviewResult
 * @typedef {import('./types.d.ts').RenameOperation} RenameOperation
 */

class FileRenamer {
  constructor() {
    /** @type {FileInfo[]} */
    this.files = [];

    /** @type {RenameRule[]} */
    this.rules = [];

    /** @type {Map<string, RenameResult>} */
    this.renameResults = new Map();

    this.initializeEventListeners();
    this.initializeColumnResizing();
  }

  /**
   * Initialize all event listeners
   */
  initializeEventListeners() {
    const dropZone = /** @type {HTMLElement} */ (
      document.getElementById("dropZoneWrapper")
    );
    const fileInput = /** @type {HTMLInputElement} */ (
      document.getElementById("fileInput")
    );

    // Toolbar buttons
    const addFilesBtn = /** @type {HTMLButtonElement} */ (
      document.getElementById("addFiles")
    );
    const addFoldersBtn = /** @type {HTMLButtonElement} */ (
      document.getElementById("addFolders")
    );
    const previewBtn = /** @type {HTMLButtonElement} */ (
      document.getElementById("preview")
    );
    const renameBtn = /** @type {HTMLButtonElement} */ (
      document.getElementById("renameBtn")
    );

    // Rule management buttons
    const addRuleBtn = /** @type {HTMLButtonElement} */ (
      document.getElementById("addRule")
    );
    const removeRuleBtn = /** @type {HTMLButtonElement} */ (
      document.getElementById("removeRule")
    );
    const upRuleBtn = /** @type {HTMLButtonElement} */ (
      document.getElementById("upRule")
    );
    const downRuleBtn = /** @type {HTMLButtonElement} */ (
      document.getElementById("downRule")
    );

    // File drop handling - only on table body, not header
    const tableBody = /** @type {HTMLElement} */ (
      document.getElementById("fileTableBody")
    );
    tableBody.addEventListener("click", () => {
      // Only allow clicking to add files when no files are loaded
      if (this.files.length === 0) {
        fileInput.click();
      }
    });
    dropZone.addEventListener("dragover", this.handleDragOver.bind(this));
    dropZone.addEventListener("drop", this.handleDrop.bind(this));
    dropZone.addEventListener("dragleave", this.handleDragLeave.bind(this));

    fileInput.addEventListener("change", this.handleFileSelect.bind(this));

    // Toolbar actions
    addFilesBtn.addEventListener("click", () => fileInput.click());
    addFoldersBtn.addEventListener("click", this.addFolders.bind(this));
    previewBtn.addEventListener("click", this.previewChanges.bind(this));
    renameBtn.addEventListener("click", this.renameFiles.bind(this));

    // Rule management
    addRuleBtn.addEventListener("click", this.addRuleToTable.bind(this));
    removeRuleBtn.addEventListener("click", this.removeSelectedRule.bind(this));
    upRuleBtn.addEventListener("click", this.moveRuleUp.bind(this));
    downRuleBtn.addEventListener("click", this.moveRuleDown.bind(this));

    // Tab switching
    const tabs = document.querySelectorAll(".tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", this.switchTab.bind(this));
    });

    // Rule table click to add rule
    const emptyRule = document.querySelector(".empty-rule");
    if (emptyRule) {
      emptyRule.addEventListener("click", this.addRuleToTable.bind(this));
    }

    // Keyboard event listener for delete key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        this.removeSelectedFiles();
      }
    });
  }

  /**
   * Handle drag over event
   * @param {DragEvent} e
   */
  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const target = /** @type {HTMLElement} */ (e.target);
    target.closest(".drop-zone")?.classList.add("dragover");
  }

  /**
   * Handle drag leave event
   * @param {DragEvent} e
   */
  handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    const target = /** @type {HTMLElement} */ (e.target);
    target.closest(".drop-zone")?.classList.remove("dragover");
  }

  /**
   * Handle file drop event
   * @param {DragEvent} e
   */
  handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const target = /** @type {HTMLElement} */ (e.target);
    target.closest(".drop-zone")?.classList.remove("dragover");

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
    // Clear existing files when new files are added
    this.files = [];

    files.forEach((file) => {
      let filePath = "";

      try {
        // Use the new Electron API to get file path
        filePath = window.electronAPI.getPathForFile(file);
      } catch (error) {
        console.warn("Could not get file path:", error);
      }

      this.files.push({
        name: file.name,
        path: filePath,
        size: file.size,
      });
    });

    this.updateFileTable();
  }

  /**
   * Update the file table display with preview
   */
  updateFileTable() {
    const tableBody = /** @type {HTMLTableSectionElement} */ (
      document.getElementById("fileTableBody")
    );
    const dropZoneWrapper = /** @type {HTMLElement} */ (
      document.getElementById("dropZoneWrapper")
    );
    
    tableBody.innerHTML = "";

    // Update status bar
    this.updateStatusBar();

    // Show/hide drop message and update wrapper class
    if (this.files.length === 0) {
      dropZoneWrapper.classList.remove("has-files");
      return;
    } else {
      dropZoneWrapper.classList.add("has-files");
    }

    const rules = this.getRules();

    this.files.forEach((file) => {
      const newName = this.applyRulesLocally(file.name, rules);
      const row = document.createElement("tr");

      const isUnchanged = newName === file.name;
      const renameResult = this.renameResults.get(file.name);
      const hasError = renameResult && !renameResult.success;
      const errorMessage = hasError
        ? renameResult.error || "Unknown error"
        : "";

      row.innerHTML = `
        <td>${hasError ? "❌" : "✅"}</td>
        <td class="original-name">${file.name}</td>
        <td class="new-name ${isUnchanged ? "unchanged" : ""}">${newName}</td>
        <td class="error-message">${errorMessage}</td>
      `;

      // Add click handler to select row with multi-selection support
      row.addEventListener("click", (e) => {
        const allRows = Array.from(document.querySelectorAll(".file-table tbody tr"));
        const currentIndex = allRows.indexOf(row);
        
        if (e.shiftKey) {
          // Shift selection - select range from last selected to current
          const selectedRows = document.querySelectorAll(".file-table tbody tr.selected");
          if (selectedRows.length > 0) {
            const lastSelected = selectedRows[selectedRows.length - 1];
            const lastIndex = allRows.indexOf(lastSelected);
            const start = Math.min(currentIndex, lastIndex);
            const end = Math.max(currentIndex, lastIndex);
            
            // Select all rows in the range
            for (let i = start; i <= end; i++) {
              allRows[i].classList.add("selected");
            }
          } else {
            // No previous selection, just select current
            row.classList.add("selected");
          }
        } else if (e.ctrlKey || e.metaKey) {
          // Multi-selection with Ctrl/Cmd key
          row.classList.toggle("selected");
        } else {
          // Single selection - clear all others and select this one
          allRows.forEach((r) => r.classList.remove("selected"));
          row.classList.add("selected");
        }
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
   * Remove selected files from the list
   */
  removeSelectedFiles() {
    const selectedRows = document.querySelectorAll(".file-table tbody tr.selected");
    if (selectedRows.length === 0) {
      return;
    }

    // Get the file names of selected rows
    const selectedFileNames = Array.from(selectedRows).map(row => {
      const nameCell = row.querySelector(".original-name");
      return nameCell ? nameCell.textContent : null;
    }).filter(name => name !== null);

    // Remove files from the array
    this.files = this.files.filter(file => !selectedFileNames.includes(file.name));
    
    // Clear any stored rename results for removed files
    selectedFileNames.forEach(name => {
      this.renameResults.delete(name);
    });

    this.updateFileTable();
  }

  /**
   * Add a new rule to the rules table
   */
  addRuleToTable() {
    const rulesTableBody = /** @type {HTMLTableSectionElement} */ (
      document.getElementById("rulesTableBody")
    );

    // Remove empty message if it exists
    const emptyRule = rulesTableBody.querySelector(".empty-rule");
    if (emptyRule) {
      emptyRule.remove();
    }

    const ruleIndex = rulesTableBody.children.length + 1;
    const row = document.createElement("tr");
    row.className = "rule-row";
    row.innerHTML = `
      <td>${ruleIndex}</td>
      <td>
        <input type="checkbox" class="rule-enabled" checked>
      </td>
      <td>
        <select class="rule-type">
          <option value="replace">Replace Text</option>
          <option value="regex">Regex Replace</option>
          <option value="trim">Trim Characters</option>
          <option value="prefix">Add Prefix</option>
          <option value="suffix">Add Suffix</option>
          <option value="insert-prefix">Insert Prefix</option>
          <option value="insert-suffix">Insert Suffix</option>
        </select>
      </td>
      <td class="rule-statement">
        <div class="rule-inputs">
          <input type="text" class="rule-input" placeholder="Search text">
          <input type="text" class="rule-input" placeholder="Replace with">
        </div>
      </td>
    `;

    // Add event listeners to update preview when rule inputs change
    const inputs = row.querySelectorAll("input, select");
    inputs.forEach((input) => {
      input.addEventListener("input", () => {
        this.updateFileTable();
      });
      input.addEventListener("change", () => {
        this.updateFileTable();
      });
    });

    // Add event listener to update input fields when rule type changes
    const typeSelect = /** @type {HTMLSelectElement} */ (
      row.querySelector(".rule-type")
    );
    typeSelect.addEventListener("change", () => {
      this.updateRuleInputs(row, typeSelect.value);
    });

    // Initialize with default rule type
    this.updateRuleInputs(row, typeSelect.value);

    // Add click handler to select row
    row.addEventListener("click", () => {
      document
        .querySelectorAll(".rule-row")
        .forEach((r) => r.classList.remove("selected"));
      row.classList.add("selected");
    });

    rulesTableBody.appendChild(row);
    this.updateRuleNumbers();
    this.updateFileTable();
  }

  /**
   * Update rule inputs based on rule type
   * @param {HTMLTableRowElement} row
   * @param {string} ruleType
   */
  updateRuleInputs(row, ruleType) {
    const inputsContainer = /** @type {HTMLElement} */ (
      row.querySelector(".rule-inputs")
    );

    // Preserve existing values
    const existingInputs =
      /** @type {NodeListOf<HTMLInputElement | HTMLSelectElement>} */ (
        inputsContainer.querySelectorAll(".rule-input")
      );
    const existingValues = Array.from(existingInputs).map(
      (input) => input.value
    );

    switch (ruleType) {
      case "replace":
        inputsContainer.innerHTML = `
          <input type="text" class="rule-input" placeholder="Search text" value="${
            existingValues[0] || ""
          }">
          <input type="text" class="rule-input" placeholder="Replace with" value="${
            existingValues[1] || ""
          }">
        `;
        break;
      case "regex":
        inputsContainer.innerHTML = `
          <input type="text" class="rule-input" placeholder="Regex pattern" value="${
            existingValues[0] || ""
          }">
          <input type="text" class="rule-input" placeholder="Replace with" value="${
            existingValues[1] || ""
          }">
        `;
        break;
      case "trim":
        inputsContainer.innerHTML = `
          <select class="rule-input">
            <option value="start" ${
              existingValues[0] === "start" ? "selected" : ""
            }>Start</option>
            <option value="end" ${
              existingValues[0] === "end" ? "selected" : ""
            }>End</option>
          </select>
          <input type="number" class="rule-input" placeholder="Count" min="1" value="${
            existingValues[1] || "1"
          }">
        `;
        break;
      case "prefix":
        inputsContainer.innerHTML = `
          <input type="text" class="rule-input" placeholder="Prefix text" value="${
            existingValues[0] || ""
          }">
        `;
        break;
      case "suffix":
        inputsContainer.innerHTML = `
          <input type="text" class="rule-input" placeholder="Suffix text" value="${
            existingValues[0] || ""
          }">
        `;
        break;
      case "insert-prefix":
        inputsContainer.innerHTML = `
          <input type="text" class="rule-input" placeholder="Insert text" value="${
            existingValues[0] || ""
          }">
        `;
        break;
      case "insert-suffix":
        inputsContainer.innerHTML = `
          <input type="text" class="rule-input" placeholder="Insert text" value="${
            existingValues[0] || ""
          }">
        `;
        break;
      default:
        inputsContainer.innerHTML = `
          <input type="text" class="rule-input" placeholder="Search text" value="${
            existingValues[0] || ""
          }">
          <input type="text" class="rule-input" placeholder="Replace with" value="${
            existingValues[1] || ""
          }">
        `;
        break;
    }

    // Re-add event listeners to new inputs
    const newInputs = inputsContainer.querySelectorAll("input, select");
    newInputs.forEach((input) => {
      input.addEventListener("input", () => {
        this.updateFileTable();
      });
      input.addEventListener("change", () => {
        this.updateFileTable();
      });
    });
  }

  /**
   * Get all rules from the interface
   * @returns {RenameRule[]}
   */
  getRules() {
    const ruleRows = document.querySelectorAll(".rule-row");
    /** @type {RenameRule[]} */
    const rules = [];

    ruleRows.forEach((row) => {
      const enabledCheckbox = /** @type {HTMLInputElement} */ (
        row.querySelector(".rule-enabled")
      );
      
      // Skip disabled rules
      if (!enabledCheckbox.checked) {
        return;
      }
      
      const typeSelect = /** @type {HTMLSelectElement} */ (
        row.querySelector(".rule-type")
      );
      const type = /** @type {RenameRule['type']} */ (typeSelect.value);
      const inputs = /** @type {NodeListOf<HTMLInputElement>} */ (
        row.querySelectorAll(".rule-input")
      );

      /** @type {RenameRule} */
      const rule = { type };

      switch (type) {
        case "replace":
          rule.search = inputs[0].value;
          rule.replacement = inputs[1].value;
          break;
        case "regex":
          rule.pattern = inputs[0].value;
          rule.replacement = inputs[1].value;
          rule.flags = "g";
          break;
        case "trim":
          rule.position = /** @type {'start' | 'end'} */ (inputs[0].value);
          rule.count = parseInt(inputs[1].value) || 1;
          break;
        case "prefix":
          rule.text = inputs[0].value;
          break;
        case "suffix":
          rule.text = inputs[0].value;
          break;
        case "insert-prefix":
          rule.text = inputs[0].value;
          break;
        case "insert-suffix":
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
      case "replace":
        return !!(rule.search && rule.replacement !== undefined);
      case "regex":
        return !!rule.pattern;
      case "trim":
        return !!(rule.position && rule.count && rule.count > 0);
      case "prefix":
      case "suffix":
      case "insert-prefix":
      case "insert-suffix":
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
    // Separate filename from extension
    const lastDotIndex = filename.lastIndexOf(".");
    const hasExtension = lastDotIndex > 0;
    
    let nameWithoutExt = hasExtension ? filename.substring(0, lastDotIndex) : filename;
    const ext = hasExtension ? filename.substring(lastDotIndex) : "";

    for (const rule of rules) {
      switch (rule.type) {
        case "regex":
          if (rule.pattern && rule.replacement !== undefined) {
            try {
              const regex = new RegExp(rule.pattern, rule.flags || "g");
              nameWithoutExt = nameWithoutExt.replace(regex, rule.replacement);
            } catch (error) {
              // Invalid regex, skip this rule
              console.warn("Invalid regex pattern:", rule.pattern);
            }
          }
          break;
        case "replace":
          if (rule.search && rule.replacement !== undefined) {
            nameWithoutExt = nameWithoutExt.split(rule.search).join(rule.replacement);
          }
          break;
        case "trim":
          if (rule.position === "start" && rule.count) {
            nameWithoutExt = nameWithoutExt.substring(rule.count);
          } else if (rule.position === "end" && rule.count) {
            nameWithoutExt = nameWithoutExt.substring(0, nameWithoutExt.length - rule.count);
          }
          break;
        case "prefix":
          if (rule.text) {
            nameWithoutExt = rule.text + nameWithoutExt;
          }
          break;
        case "suffix":
          if (rule.text) {
            nameWithoutExt = nameWithoutExt + rule.text;
          }
          break;
        case "insert-prefix":
          if (rule.text) {
            nameWithoutExt = rule.text + nameWithoutExt;
          }
          break;
        case "insert-suffix":
          if (rule.text) {
            nameWithoutExt = nameWithoutExt + rule.text;
          }
          break;
      }
    }

    return nameWithoutExt + ext;
  }

  /**
   * Rename the files
   */
  async renameFiles() {
    if (this.files.length === 0) {
      alert("Please add some files first");
      return;
    }

    const rules = this.getRules();
    if (rules.length === 0) {
      alert("Please add at least one rule");
      return;
    }

    if (
      !confirm(
        "Are you sure you want to rename these files? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      // Prepare rename operations with computed names
      /** @type {RenameOperation[]} */
      const renameOperations = this.files.map((file) => ({
        originalPath: file.path,
        originalName: file.name,
        newName: this.applyRulesLocally(file.name, rules),
      }));

      const results = await window.electronAPI.renameFiles(renameOperations);
      this.displayResults(results);
    } catch (error) {
      console.error("Rename error:", error);
      alert(
        "Error renaming files: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    }
  }

  /**
   * Display the rename results
   * @param {RenameResult[]} results
   */
  displayResults(results) {
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    // Store results for display in table
    this.renameResults.clear();
    results.forEach((result) => {
      this.renameResults.set(result.originalName, result);
    });

    // Update the file table to show errors
    this.updateFileTable();

    // Show summary message
    let message = `Renamed ${successful.length} file(s) successfully.`;
    if (failed.length > 0) {
      message += `\n${failed.length} file(s) failed to rename. See table for details.`;
    }

    alert(message);

    // Remove successfully renamed files from the list
    if (successful.length > 0) {
      const successfulNames = new Set(successful.map((r) => r.originalName));
      this.files = this.files.filter((file) => !successfulNames.has(file.name));
      this.updateFileTable();
    }
  }

  /**
   * Add folders functionality (placeholder)
   */
  addFolders() {
    alert("Add Folders functionality not yet implemented");
  }

  /**
   * Preview changes functionality
   */
  previewChanges() {
    this.updateFileTable();
    alert("Preview updated - check the file table for changes");
  }

  /**
   * Remove selected rule
   */
  removeSelectedRule() {
    const selectedRule = document.querySelector(".rule-row.selected");
    if (selectedRule) {
      selectedRule.remove();
      this.updateRuleNumbers();
      this.updateFileTable();
    }
  }

  /**
   * Move selected rule up
   */
  moveRuleUp() {
    const selectedRule = document.querySelector(".rule-row.selected");
    if (
      selectedRule &&
      selectedRule.previousElementSibling &&
      selectedRule.parentNode
    ) {
      selectedRule.parentNode.insertBefore(
        selectedRule,
        selectedRule.previousElementSibling
      );
      this.updateRuleNumbers();
      this.updateFileTable();
    }
  }

  /**
   * Move selected rule down
   */
  moveRuleDown() {
    const selectedRule = document.querySelector(".rule-row.selected");
    if (
      selectedRule &&
      selectedRule.nextElementSibling &&
      selectedRule.parentNode
    ) {
      selectedRule.parentNode.insertBefore(
        selectedRule.nextElementSibling,
        selectedRule
      );
      this.updateRuleNumbers();
      this.updateFileTable();
    }
  }

  /**
   * Update rule numbers in the table
   */
  updateRuleNumbers() {
    const ruleRows = document.querySelectorAll(".rule-row");
    ruleRows.forEach((row, index) => {
      const numberCell = row.querySelector("td:first-child");
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
    document
      .querySelectorAll(".tab")
      .forEach((tab) => tab.classList.remove("active"));

    // Add active class to clicked tab
    target.classList.add("active");

    // Show/hide content based on tab (placeholder for now)
    console.log("Switched to tab:", tabName);
  }

  /**
   * Update status bar with file count
   */
  updateStatusBar() {
    const fileCount = document.getElementById("fileCount");
    if (fileCount) {
      fileCount.textContent = `${this.files.length} files`;
    }
  }

  /**
   * Initialize column resizing functionality
   */
  initializeColumnResizing() {
    const table = /** @type {HTMLTableElement} */ (
      document.getElementById("fileTable")
    );
    const resizeHandles = document.querySelectorAll(
      ".file-table th .resize-handle"
    );

    let isResizing = false;
    /** @type {HTMLTableCellElement | null} */
    let currentColumn = null;
    let startX = 0;
    let startWidth = 0;

    resizeHandles.forEach((handle) => {
      handle.addEventListener("mousedown", (e) => {
        const mouseEvent = /** @type {MouseEvent} */ (e);
        mouseEvent.preventDefault();
        mouseEvent.stopPropagation();

        isResizing = true;
        currentColumn = /** @type {HTMLTableCellElement} */ (
          handle.parentElement
        );
        startX = mouseEvent.clientX;
        startWidth = currentColumn.offsetWidth;

        table.classList.add("resizing");
        currentColumn.classList.add("resizing");

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
      });
    });

    /**
     * @param {MouseEvent} e
     */
    function handleMouseMove(e) {
      if (!isResizing || !currentColumn) return;

      const deltaX = e.clientX - startX;
      const newWidth = Math.max(30, startWidth + deltaX); // Minimum width of 30px
      const tableWidth = table.offsetWidth;
      const maxWidth = tableWidth - 200; // Leave room for other columns

      const finalWidth = Math.min(newWidth, maxWidth);
      currentColumn.style.width = finalWidth + "px";
    }

    function handleMouseUp() {
      if (!isResizing) return;

      isResizing = false;
      table.classList.remove("resizing");
      if (currentColumn) {
        currentColumn.classList.remove("resizing");
      }

      currentColumn = null;

      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    }
  }
}

// Initialize the application
const fileRenamer = new FileRenamer();

// Make it globally accessible for HTML onclick handlers
window.fileRenamer = fileRenamer;
