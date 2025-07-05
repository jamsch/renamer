// @ts-check

import { createSignal, createEffect } from "./signals.js";

/**
 * @typedef {import('./types.d.ts').FileInfo} FileInfo
 * @typedef {import('./types.d.ts').RenameRule} RenameRule
 * @typedef {import('./types.d.ts').RenameResult} RenameResult
 * @typedef {import('./types.d.ts').PreviewResult} PreviewResult
 * @typedef {import('./types.d.ts').RenameOperation} RenameOperation
 */

// --- DOM utility functions ---
/**
 * Shorthand for creating an element with props and children
 * @template {keyof HTMLElementTagNameMap} T
 * @param {T} tag
 * @param {Partial<HTMLElementTagNameMap[T]> | null} props
 * @param {...(string | Node)} children
 * @returns {HTMLElementTagNameMap[T]}
 */
function h(tag, props, ...children) {
  const element = document.createElement(tag);
  if (props) Object.assign(element, props);
  element.append(...children);
  return element;
}

// --- Rule Types and Labels ---

const RULE_TYPES = /** @type {const} */ ([
  "replace",
  "replace-case-insensitive",
  "regex",
  "trim",
  "trim-whitespace",
  "prefix",
  "suffix",
  "remove-parentheses",
  "remove-square-brackets",
  "remove-curly-brackets",
]);

/**
 * @satisfies {Record<typeof RULE_TYPES[number], string>}
 */
const RULE_LABELS = {
  replace: "Replace Text",
  "replace-case-insensitive": "Replace Text (Case Insensitive)",
  regex: "Regex Replace",
  trim: "Trim Characters",
  "trim-whitespace": "Trim Whitespace",
  prefix: "Add Prefix",
  suffix: "Add Suffix",
  "remove-parentheses": "Remove Parentheses (...)",
  "remove-square-brackets": "Remove Square Brackets [...]",
  "remove-curly-brackets": "Remove Curly Brackets {...}",
};

// --- Signal Type Definitions ---

/**
 * @typedef {Object} RuleSignalObject
 * @property {[() => typeof RULE_TYPES[number], (v: typeof RULE_TYPES[number]) => void]} typeSignal
 * @property {[() => boolean, (v: boolean) => void]} enabledSignal
 * @property {[() => string, (v: string) => void]} searchSignal
 * @property {[() => string, (v: string) => void]} replacementSignal
 * @property {[() => string, (v: string) => void]} patternSignal
 * @property {[() => string, (v: string) => void]} flagsSignal
 * @property {[() => boolean, (v: boolean) => void]} caseInsensitiveSignal
 * @property {[() => "start" | "end", (v: "start" | "end") => void]} positionSignal
 * @property {[() => number, (v: number) => void]} countSignal
 * @property {[() => string, (v: string) => void]} textSignal
 */

/**
 * @typedef {Object} FileSignalObject
 * @property {[() => string, (v: string) => void]} nameSignal
 * @property {[() => string, (v: string) => void]} pathSignal
 * @property {[() => number, (v: number) => void]} sizeSignal
 * @property {[() => boolean, (v: boolean) => void]} selectedSignal
 */

class FileRenamer {
  renameResults = createSignal(/** @type {Map<string, import('./types.d.ts').RenameResult>} */ (new Map()));
  ruleSignals = createSignal(/** @type {RuleSignalObject[]} */ ([]));
  selectedRuleIndex = createSignal(/** @type {number | null} */ (null));
  fileSignals = createSignal(/** @type {FileSignalObject[]} */ ([]));

  constructor() {
    // Initialize the UI
    this.initializeEventListeners();
    this.initializeRuleTable();
    this.initializeFileTable();
    this.initializeColumnResizing();
  }

  /**
   * Initialize all reactive signals
   */
  initializeSignals() {
    // Rule signals
    /** @type {RuleSignalObject[]} */
    const initialRules = [];
    /** @type {[() => RuleSignalObject[], (v: RuleSignalObject[]) => void]} */
    this.ruleSignals = createSignal(initialRules);
    /** @type {[() => number | null, (v: number | null) => void]} */
    this.selectedRuleIndex = createSignal(/** @type {number | null} */ (null));

    // File signals
    /** @type {FileSignalObject[]} */
    const initialFiles = [];
    /** @type {[() => FileSignalObject[], (v: FileSignalObject[]) => void]} */
    this.fileSignals = createSignal(initialFiles);
  }

  /**
   * Create a new rule signal object
   * @returns {RuleSignalObject}
   */
  createRuleSignals() {
    return {
      // @ts-expect-error
      typeSignal: createSignal("replace"),
      enabledSignal: createSignal(true),
      searchSignal: createSignal(""),
      replacementSignal: createSignal(""),
      patternSignal: createSignal(""),
      flagsSignal: createSignal("g"),
      caseInsensitiveSignal: createSignal(false),
      positionSignal: createSignal(/** @type {"start" | "end"} */ ("start")),
      countSignal: createSignal(1),
      textSignal: createSignal(""),
    };
  }

  /**
   * Create a new file signal object
   * @param {FileInfo} fileInfo
   * @returns {FileSignalObject}
   */
  createFileSignals(fileInfo) {
    return {
      nameSignal: createSignal(fileInfo.name),
      pathSignal: createSignal(fileInfo.path),
      sizeSignal: createSignal(fileInfo.size ?? 0),
      selectedSignal: createSignal(false),
    };
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

    // File drop handling
    const tableBody = /** @type {HTMLElement} */ (
      document.getElementById("fileTableBody")
    );
    tableBody.addEventListener("click", () => {
      const [getFiles] = this.fileSignals;
      if (getFiles().length === 0) {
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
    addRuleBtn.addEventListener("click", this.addRule.bind(this));
    removeRuleBtn.addEventListener("click", this.removeSelectedRule.bind(this));
    upRuleBtn.addEventListener("click", this.moveRuleUp.bind(this));
    downRuleBtn.addEventListener("click", this.moveRuleDown.bind(this));

    // File action buttons
    const selectAllBtn = document.getElementById("selectAllFiles");
    const deselectAllBtn = document.getElementById("deselectAllFiles");
    const removeSelectedBtn = document.getElementById("removeSelectedFiles");
    const clearAllBtn = document.getElementById("clearAllFiles");
    const invertSelectionBtn = document.getElementById("invertSelection");

    selectAllBtn?.addEventListener("click", this.selectAllFiles.bind(this));
    deselectAllBtn?.addEventListener("click", this.deselectAllFiles.bind(this));
    removeSelectedBtn?.addEventListener(
      "click",
      this.removeSelectedFiles.bind(this)
    );
    clearAllBtn?.addEventListener("click", this.clearAllFiles.bind(this));
    invertSelectionBtn?.addEventListener(
      "click",
      this.invertSelection.bind(this)
    );

    // Header checkbox for select all/deselect all
    const selectAllCheckbox = document.getElementById("selectAllCheckbox");
    selectAllCheckbox?.addEventListener("change", (e) => {
      const target = /** @type {HTMLInputElement} */ (e.target);
      if (target.checked) {
        this.selectAllFiles();
      } else {
        this.deselectAllFiles();
      }
    });

    // Rule table click to add rule
    const emptyRule = document.querySelector(".empty-rule");
    if (emptyRule) {
      emptyRule.addEventListener("click", this.addRule.bind(this));
    }

    // Keyboard event listener for delete key and select all
    document.addEventListener("keydown", (e) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        this.removeSelectedFiles();
      } else if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
        const activeElement = document.activeElement;
        const isInInput =
          activeElement &&
          (activeElement.tagName === "INPUT" ||
            activeElement.tagName === "TEXTAREA" ||
            /** @type {HTMLElement} */ (activeElement).isContentEditable ===
              true);

        const [getFiles] = this.fileSignals;
        if (!isInInput && getFiles().length > 0) {
          e.preventDefault();
          this.selectAllFiles();
        }
      }
    });
  }

  /**
   * Initialize the reactive rule table
   */
  initializeRuleTable() {
    const tbody = /** @type {HTMLTableSectionElement} */ (
      document.getElementById("rulesTableBody")
    );

    createEffect(() => {
      const [getRules] = this.ruleSignals;
      /** @type {RuleSignalObject[]} */
      const rules = getRules();
      if (!tbody) return;

      // Remove empty rule message if it exists
      const emptyRule = tbody.querySelector(".empty-rule");
      if (emptyRule && rules.length > 0) {
        emptyRule.remove();
      }

      // Remove extra rows
      while (tbody.rows.length > rules.length + (rules.length === 0 ? 1 : 0)) {
        tbody.deleteRow(tbody.rows.length - 1);
      }

      // Add missing rows
      for (
        let i = tbody.rows.length - (rules.length === 0 ? 1 : 0);
        i < rules.length;
        ++i
      ) {
        const ruleSignal = rules[i];
        const row = h("tr", {
          className: "rule-row",
          onclick: () => {
            const [, setIndex] = this.selectedRuleIndex;
            setIndex(i);
          },
        });

        const numCell = h("td", null);
        const enabledInputCell = this.createRuleCheckbox(
          ruleSignal.enabledSignal
        );
        const typeCell = this.createRuleTypeSelectCell(ruleSignal.typeSignal);
        const stmtCell = h("td", null);

        row.append(numCell, enabledInputCell, typeCell, stmtCell);
        tbody.appendChild(row);

        createEffect(() => {
          const [getIndex] = this.selectedRuleIndex;
          row.className = "rule-row" + (getIndex() === i ? " selected" : "");
          numCell.textContent = (i + 1).toString();
        });

        const stmtInputs = this.renderRuleInputs(ruleSignal);
        stmtCell.appendChild(stmtInputs);
      }

      // Show empty message if no rules
      if (rules.length === 0 && !tbody.querySelector(".empty-rule")) {
        const emptyRow = h("tr", { className: "empty-rule" });
        const emptyCell = h(
          "td",
          {
            colSpan: 4,
            className: "empty-message",
            onclick: () => this.addRule(),
          },
          "Click here to add a rule"
        );
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
      }
    });
  }

  /**
   * Initialize the reactive file table
   */
  initializeFileTable() {
    const fileTableBody = /** @type {HTMLTableSectionElement} */ (
      document.getElementById("fileTableBody")
    );

    // Track file array reference to detect actual changes vs selection changes
    /** @type {FileSignalObject[] | null} */
    let currentFilesRef = null;

    createEffect(() => {
      const [getFiles] = this.fileSignals;
      /** @type {FileSignalObject[]} */
      const files = getFiles();
      if (!fileTableBody) return;

      // Update status bar
      this.updateStatusBar();

      // Update header checkbox
      this.updateHeaderCheckbox();

      // Show/hide drop message
      const dropZoneWrapper = /** @type {HTMLElement} */ (
        document.getElementById("dropZoneWrapper")
      );
      if (files.length === 0) {
        dropZoneWrapper.classList.remove("has-files");
        fileTableBody.innerHTML = "";
        currentFilesRef = files;
        return;
      } else {
        dropZoneWrapper.classList.add("has-files");
      }

      // Only rebuild if the files array reference has changed (new files added/removed)
      // This prevents rebuilding on selection changes
      if (currentFilesRef === files) {
        return;
      }
      currentFilesRef = files;

      // Clear the entire table body and rebuild all rows
      fileTableBody.innerHTML = "";

      // Rebuild all rows
      for (let index = 0; index < files.length; index++) {
        const fileSignal = files[index];

        const nameCell = this.createNameCell(fileSignal);
        const previewCell = this.createPreviewCell(fileSignal);
        const errorCell = this.createErrorCell(fileSignal);
        const checkboxCell = this.createCheckboxCell(fileSignal);

        const row = h("tr", {
          className: "file-row",
          onclick: (e) => this.handleFileRowClick(e, index),
        });

        row.append(checkboxCell, nameCell, previewCell, errorCell);
        fileTableBody.appendChild(row);

        // Reactive updates for this row
        createEffect(() => {
          const [getSelected] = fileSignal.selectedSignal;
          const isSelected = getSelected();
          row.className = "file-row" + (isSelected ? " selected" : "");
        });
      }
    });

    // Monitor selection changes to update header checkbox
    createEffect(() => {
      const [getFiles] = this.fileSignals;
      const files = getFiles();

      // Create a derived signal that tracks selection state
      files.forEach((file) => {
        createEffect(() => {
          const [getSelected] = file.selectedSignal;
          getSelected(); // Track selection changes
          this.updateHeaderCheckbox();
        });
      });
    });
  }

  /**
   * Handle file row click with multi-selection support
   * @param {MouseEvent} e
   * @param {number} index
   */
  handleFileRowClick(e, index) {
    const [getFiles] = this.fileSignals;
    const files = getFiles();

    if (e.shiftKey) {
      // Shift selection - select range
      const selectedIndices = files
        .map((_, i) => i)
        .filter((i) => {
          const [getSelected] = files[i].selectedSignal;
          return getSelected();
        });

      if (selectedIndices.length > 0) {
        const firstSelected = selectedIndices[0];
        const start = Math.min(index, firstSelected);
        const end = Math.max(index, firstSelected);

        // Clear all selections
        files.forEach((file) => {
          const [, setSelected] = file.selectedSignal;
          setSelected(false);
        });

        // Select range
        for (let i = start; i <= end; i++) {
          const [, setSelected] = files[i].selectedSignal;
          setSelected(true);
        }
      } else {
        const [, setSelected] = files[index].selectedSignal;
        setSelected(true);
      }
    } else if (e.ctrlKey || e.metaKey) {
      // Multi-selection with Ctrl/Cmd
      const [getSelected, setSelected] = files[index].selectedSignal;
      const currentSelection = getSelected();
      setSelected(!currentSelection);
    } else {
      // Single selection
      files.forEach((file) => {
        const [, setSelected] = file.selectedSignal;
        setSelected(false);
      });
      const [, setSelected] = files[index].selectedSignal;
      setSelected(true);
    }
  }

  /**
   * Creates a reactive checkbox input for a rule's enabled state
   * @param {[() => boolean, (v: boolean) => void]} signal
   * @returns {HTMLTableCellElement}
   */
  createRuleCheckbox(signal) {
    const [get, set] = signal;
    const input = h("input", {
      type: "checkbox",
      checked: get(),
      onchange: () => set(input.checked),
    });
    createEffect(() => {
      input.checked = get();
    });
    return h("td", null, input);
  }

  /**
   * Creates a reactive select cell for a rule's type
   * @param {[() => typeof RULE_TYPES[number], (v: typeof RULE_TYPES[number]) => void]} typeSignal
   * @returns {HTMLTableCellElement}
   */
  createRuleTypeSelectCell(typeSignal) {
    const [get, set] = typeSignal;
    const select = h(
      "select",
      {
        onchange: () => {
          set(/** @type {typeof RULE_TYPES[number]} */ (select.value));
        },
      },
      ...RULE_TYPES.map((type) =>
        h(
          "option",
          {
            value: type,
            selected: get() === type,
          },
          RULE_LABELS[type]
        )
      )
    );
    createEffect(() => {
      select.value = get();
    });
    return h("td", null, select);
  }

  /**
   * Creates replace inputs component
   * @param {RuleSignalObject} ruleSignals
   * @returns {DocumentFragment}
   */
  createReplaceInputs(ruleSignals) {
    const search = h("input", {
      type: "text",
      className: "rule-input",
      placeholder: "Search text",
      oninput: () => ruleSignals.searchSignal[1](search.value),
    });
    const replacement = h("input", {
      type: "text",
      className: "rule-input",
      placeholder: "Replace with",
      oninput: () => ruleSignals.replacementSignal[1](replacement.value),
    });
    createEffect(() => {
      search.value = ruleSignals.searchSignal[0]?.();
      replacement.value = ruleSignals.replacementSignal[0]?.();
    });

    const fragment = document.createDocumentFragment();
    fragment.append(search, replacement);
    return fragment;
  }

  /**
   * Creates regex inputs component
   * @param {RuleSignalObject} ruleSignals
   * @returns {DocumentFragment}
   */
  createRegexInputs(ruleSignals) {
    const pattern = h("input", {
      type: "text",
      className: "rule-input",
      placeholder: "Regex pattern",
      oninput: () => ruleSignals.patternSignal[1](pattern.value),
    });
    const replacement = h("input", {
      type: "text",
      className: "rule-input",
      placeholder: "Replace with",
      oninput: () => ruleSignals.replacementSignal[1](replacement.value),
    });
    createEffect(() => {
      pattern.value = ruleSignals.patternSignal[0]?.();
      replacement.value = ruleSignals.replacementSignal[0]?.();
    });

    const fragment = document.createDocumentFragment();
    fragment.append(pattern, replacement);
    return fragment;
  }

  /**
   * Creates trim inputs component
   * @param {RuleSignalObject} ruleSignals
   * @returns {DocumentFragment}
   */
  createTrimInputs(ruleSignals) {
    const options = [
      h("option", { value: "start" }, "Start"),
      h("option", { value: "end" }, "End"),
    ];

    const position = h(
      "select",
      {
        className: "rule-input",
        onchange: () =>
          ruleSignals.positionSignal[1](
            /** @type {"start" | "end"} */ (position.value)
          ),
      },
      ...options
    );

    createEffect(() => {
      position.value = ruleSignals.positionSignal[0]();
      for (const option of options) {
        option.selected = option.value === ruleSignals.positionSignal[0]();
      }
    });

    const count = h("input", {
      type: "number",
      className: "rule-input",
      placeholder: "Count",
      min: "1",
      oninput: () => ruleSignals.countSignal[1](parseInt(count.value) || 1),
    });

    createEffect(() => {
      count.value = String(ruleSignals.countSignal[0]() || 1);
    });

    const fragment = document.createDocumentFragment();
    fragment.append(position, count);
    return fragment;
  }

  /**
   * Creates prefix inputs component
   * @param {RuleSignalObject} ruleSignals
   * @returns {DocumentFragment}
   */
  createPrefixInputs(ruleSignals) {
    const prefix = h("input", {
      type: "text",
      className: "rule-input",
      placeholder: "Prefix text",
      oninput: () => ruleSignals.textSignal[1](prefix.value),
    });
    createEffect(() => {
      prefix.value = ruleSignals.textSignal[0]();
    });

    const fragment = document.createDocumentFragment();
    fragment.append(prefix);
    return fragment;
  }

  /**
   * Creates suffix inputs component
   * @param {RuleSignalObject} ruleSignals
   * @returns {DocumentFragment}
   */
  createSuffixInputs(ruleSignals) {
    const suffix = h("input", {
      type: "text",
      className: "rule-input",
      placeholder: "Suffix text",
      oninput: () => ruleSignals.textSignal[1](suffix.value),
    });
    createEffect(() => {
      suffix.value = ruleSignals.textSignal[0]();
    });

    const fragment = document.createDocumentFragment();
    fragment.append(suffix);
    return fragment;
  }

  /**
   * Render rule inputs based on type
   * @param {RuleSignalObject} ruleSignals
   * @returns {HTMLDivElement}
   */
  renderRuleInputs(ruleSignals) {
    const container = h("div", { className: "rule-inputs" });

    // Reactively update content based on type
    createEffect(() => {
      const type = ruleSignals.typeSignal[0]();

      // Clear and rebuild content
      while (container.firstChild) container.removeChild(container.firstChild);

      // Create inputs based on type
      switch (type) {
        case "replace":
        case "replace-case-insensitive": {
          container.appendChild(this.createReplaceInputs(ruleSignals));
          break;
        }
        case "regex": {
          container.appendChild(this.createRegexInputs(ruleSignals));
          break;
        }
        case "trim": {
          container.appendChild(this.createTrimInputs(ruleSignals));
          break;
        }
        case "prefix": {
          container.appendChild(this.createPrefixInputs(ruleSignals));
          break;
        }
        case "suffix": {
          container.appendChild(this.createSuffixInputs(ruleSignals));
          break;
        }
        case "remove-parentheses":
        case "remove-square-brackets":
        case "remove-curly-brackets": {
          // These rules don't need input fields, just a description
          const description = h(
            "span",
            { className: "rule-description" },
            "Removes brackets and their content"
          );
          container.appendChild(description);
          break;
        }
      }
    });

    return container;
  }

  /**
   * Add a new rule
   */
  addRule() {
    const [getRules, setRules] = this.ruleSignals;
    setRules([...getRules(), this.createRuleSignals()]);
  }

  /**
   * Remove selected rule
   */
  removeSelectedRule() {
    const [getRules, setRules] = this.ruleSignals;
    const [getIndex, setIndex] = this.selectedRuleIndex;
    const idx = getIndex();

    if (idx === null || idx < 0 || idx >= getRules().length) {
      return;
    }

    const newArr = getRules().slice();
    newArr.splice(idx, 1);
    setRules(newArr);
    setIndex(null);
  }

  /**
   * Move selected rule up
   */
  moveRuleUp() {
    const [getRules, setRules] = this.ruleSignals;
    const [getIndex, setIndex] = this.selectedRuleIndex;
    const idx = getIndex();

    if (idx === null || idx <= 0 || idx >= getRules().length) {
      return;
    }

    const newArr = getRules().slice();
    [newArr[idx - 1], newArr[idx]] = [newArr[idx], newArr[idx - 1]];
    setRules(newArr);
    setIndex(idx - 1);
  }

  /**
   * Move selected rule down
   */
  moveRuleDown() {
    const [getRules, setRules] = this.ruleSignals;
    const [getIndex, setIndex] = this.selectedRuleIndex;
    const idx = getIndex();

    if (idx === null || idx < 0 || idx >= getRules().length - 1) {
      return;
    }

    const newArr = getRules().slice();
    [newArr[idx], newArr[idx + 1]] = [newArr[idx + 1], newArr[idx]];
    setRules(newArr);
    setIndex(idx + 1);
  }

  /**
   * Get rules from signals in the format expected by applyRulesLocally
   * @returns {Array<import("./types").RenameRule>}
   */
  getRulesFromSignals() {
    const [getRules] = this.ruleSignals;
    const rules = getRules();
    /** @type {Array<import("./types").RenameRule>} */
    const validRules = [];

    for (const ruleSignal of rules) {
      if (!ruleSignal.enabledSignal[0]()) continue;

      const type = ruleSignal.typeSignal[0]();

      switch (type) {
        case "replace": {
          const rule = {
            type,
            data: {
              search: ruleSignal.searchSignal[0](),
              replacement: ruleSignal.replacementSignal[0](),
            },
          };
          if (rule.data.search && rule.data.replacement !== undefined) {
            validRules.push(rule);
          }
          break;
        }
        case "replace-case-insensitive": {
          const rule = {
            type,
            data: {
              search: ruleSignal.searchSignal[0](),
              replacement: ruleSignal.replacementSignal[0](),
              caseInsensitive: true,
            },
          };
          if (rule.data.search && rule.data.replacement !== undefined) {
            validRules.push(rule);
          }
          break;
        }
        case "regex": {
          const rule = {
            type,
            data: {
              pattern: ruleSignal.patternSignal[0](),
              replacement: ruleSignal.replacementSignal[0](),
              flags: ruleSignal.flagsSignal[0]() || "g",
            },
          };
          if (rule.data.pattern && rule.data.replacement !== undefined) {
            validRules.push(rule);
          }
          break;
        }
        case "trim": {
          const pos = ruleSignal.positionSignal[0]();
          const rule = {
            type,
            data: {
              position: pos === "start" || pos === "end" ? pos : "start",
              count: ruleSignal.countSignal[0](),
            },
          };
          if (rule.data.position && rule.data.count > 0) {
            validRules.push(rule);
          }
          break;
        }
        case "prefix":
        case "suffix": {
          const rule = {
            type,
            data: {
              text: ruleSignal.textSignal[0](),
            },
          };
          if (rule.data.text) {
            validRules.push(rule);
          }
          break;
        }
        case "trim-whitespace":
        case "remove-parentheses":
        case "remove-square-brackets":
        case "remove-curly-brackets": {
          // These rules don't need any parameters
          validRules.push({ type, data: {} });
          break;
        }
      }
    }

    return validRules;
  }

  /**
   * Apply rules locally for preview (same logic as main process)
   * @param {string} filename
   * @param {Array<import("./types").RenameRule>} rules
   * @returns {string}
   */
  applyRulesLocally(filename, rules) {
    // Separate filename from extension
    const lastDotIndex = filename.lastIndexOf(".");
    const hasExtension = lastDotIndex > 0;

    let nameWithoutExt = hasExtension
      ? filename.substring(0, lastDotIndex)
      : filename;
    const ext = hasExtension ? filename.substring(lastDotIndex) : "";

    for (const rule of rules) {
      switch (rule.type) {
        case "regex":
          if (rule.data.pattern && rule.data.replacement !== undefined) {
            try {
              const regex = new RegExp(
                rule.data.pattern,
                rule.data.flags || "g"
              );
              nameWithoutExt = nameWithoutExt.replace(
                regex,
                rule.data.replacement
              );
            } catch (error) {
              console.warn("Invalid regex pattern:", rule.data.pattern);
            }
          }
          break;
        case "replace":
          if (rule.data.search && rule.data.replacement !== undefined) {
            nameWithoutExt = nameWithoutExt
              .split(rule.data.search)
              .join(rule.data.replacement);
          }
          break;
        case "replace-case-insensitive":
          if (rule.data.search && rule.data.replacement !== undefined) {
            const regex = new RegExp(
              rule.data.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              "gi"
            );
            nameWithoutExt = nameWithoutExt.replace(
              regex,
              rule.data.replacement
            );
          }
          break;
        case "trim":
          if (rule.data.position === "start" && rule.data.count) {
            nameWithoutExt = nameWithoutExt.substring(rule.data.count);
          } else if (rule.data.position === "end" && rule.data.count) {
            nameWithoutExt = nameWithoutExt.substring(
              0,
              nameWithoutExt.length - rule.data.count
            );
          }
          break;
        case "trim-whitespace":
          // Trim whitespace from start and end, then replace multiple spaces with single space
          let trimmed = nameWithoutExt.trim();
          // Only replace multiple consecutive whitespace with single space (don't touch single spaces)
          trimmed = trimmed.replace(/\s{2,}/g, " ");
          nameWithoutExt = trimmed;
          break;
        case "prefix":
          if (rule.data.text) {
            nameWithoutExt = rule.data.text + nameWithoutExt;
          }
          break;
        case "suffix":
          if (rule.data.text) {
            nameWithoutExt = nameWithoutExt + rule.data.text;
          }
          break;
        case "remove-parentheses":
          nameWithoutExt = nameWithoutExt.replace(/\([^)]*\)/g, "");
          break;
        case "remove-square-brackets":
          nameWithoutExt = nameWithoutExt.replace(/\[[^\]]*\]/g, "");
          break;
        case "remove-curly-brackets":
          nameWithoutExt = nameWithoutExt.replace(/\{[^}]*\}/g, "");
          break;
      }
    }

    return nameWithoutExt + ext;
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
  async handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const target = /** @type {HTMLElement} */ (e.target);
    target.closest(".drop-zone")?.classList.remove("dragover");

    if (e.dataTransfer?.files) {
      const files = Array.from(e.dataTransfer.files);
      await this.addFiles(files);
    }
  }

  /**
   * Handle file input change
   * @param {Event} e
   */
  async handleFileSelect(e) {
    const target = /** @type {HTMLInputElement} */ (e.target);
    if (target.files) {
      const files = Array.from(target.files);
      await this.addFiles(files);
    }
  }

  /**
   * Add files to the list
   * @param {File[]} files
   */
  async addFiles(files) {
    // Clear existing files when new files are added
    const [, setFiles] = this.fileSignals;
    const newFiles = [];

    // Clear rename results when adding new files
    const [, setRenameResults] = this.renameResults;
    setRenameResults(new Map());

    for (const file of files) {
      let filePath = "";

      try {
        // Use the new Electron API to get file path
        filePath = window.electronAPI.getPathForFile(file);
      } catch (error) {
        console.warn("Could not get file path:", error);
      }

      // Check if this is a directory (folder) using the main process
      try {
        const isDirectory = await window.electronAPI.isDirectory(filePath);

        if (isDirectory) {
          // This is a folder, get its contents
          const folderFiles = await window.electronAPI.readFolderContents(
            filePath
          );
          console.log(`Found folder: ${file.name}, contents:`, folderFiles);
          folderFiles.forEach((folderFile) => {
            newFiles.push(
              this.createFileSignals({
                name: folderFile.name,
                path: folderFile.path,
                size: folderFile.size,
              })
            );
          });
        } else {
          // Regular file
          newFiles.push(
            this.createFileSignals({
              name: file.name,
              path: filePath,
              size: file.size,
            })
          );
        }
      } catch (error) {
        console.warn("Could not check if directory:", error);
        // If we can't determine, treat it as a regular file
        newFiles.push(
          this.createFileSignals({
            name: file.name,
            path: filePath,
            size: file.size,
          })
        );
      }
    }

    setFiles(newFiles);
  }

  /**
   * Remove selected files from the list
   */
  removeSelectedFiles() {
    const [getFiles, setFiles] = this.fileSignals;
    const files = getFiles();
    const newFiles = files.filter((file) => {
      const [getSelected] = file.selectedSignal;
      return !getSelected();
    });
    setFiles(newFiles);
  }

  /**
   * Select all files in the table
   */
  selectAllFiles() {
    const [getFiles] = this.fileSignals;
    const files = getFiles();
    files.forEach((file) => {
      const [, setSelected] = file.selectedSignal;
      setSelected(true);
    });
  }

  /**
   * Deselect all files in the table
   */
  deselectAllFiles() {
    const [getFiles] = this.fileSignals;
    const files = getFiles();
    files.forEach((file) => {
      const [, setSelected] = file.selectedSignal;
      setSelected(false);
    });
  }

  /**
   * Clear all files from the list
   */
  clearAllFiles() {
    const [, setFiles] = this.fileSignals;
    setFiles([]);
    const [, setRenameResults] = this.renameResults;
    setRenameResults(new Map());
  }

  /**
   * Invert the current selection
   */
  invertSelection() {
    const [getFiles] = this.fileSignals;
    const files = getFiles();
    files.forEach((file) => {
      const [getSelected, setSelected] = file.selectedSignal;
      const currentSelection = getSelected();
      setSelected(!currentSelection);
    });
  }

  /**
   * Rename the files
   */
  async renameFiles() {
    const [getFiles] = this.fileSignals;
    const files = getFiles();
    if (files.length === 0) {
      this.showToast("Please add some files first", "warning");
      return;
    }

    const rules = this.getRulesFromSignals();
    if (rules.length === 0) {
      this.showToast("Please add at least one rule", "warning");
      return;
    }

    try {
      // Prepare rename operations with computed names
      /** @type {RenameOperation[]} */
      const allOperations = files.map((fileSignal) => {
        const [getPath] = fileSignal.pathSignal;
        const [getName] = fileSignal.nameSignal;
        const originalName = getName();
        return {
          originalPath: getPath(),
          originalName: originalName,
          newName: this.applyRulesLocally(originalName, rules),
        };
      });

      // Filter to only operations where the name actually changes
      const renameOperations = allOperations.filter(op => op.originalName !== op.newName);
      
      if (renameOperations.length === 0) {
        this.showToast("No files need renaming - all names are unchanged", "warning");
        return;
      }

      const results = await window.electronAPI.renameFiles(renameOperations);
      
      // Create results for unchanged files too (success with no actual rename)
      const unchangedResults = allOperations
        .filter(op => op.originalName === op.newName)
        .map(op => ({
          originalName: op.originalName,
          newName: op.originalName,
          success: true,
          unchanged: true
        }));
      
      this.displayResults([...results, ...unchangedResults]);
    } catch (error) {
      console.error("Rename error:", error);
      this.showToast(
        "Error renaming files: " +
          (error instanceof Error ? error.message : "Unknown error"),
        "error"
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
    const [, setRenameResults] = this.renameResults;
    const newResultsMap = new Map();
    results.forEach((result) => {
      newResultsMap.set(result.originalName, result);
    });
    setRenameResults(newResultsMap);

    // Show summary message
    let message = `Renamed ${successful.length} file(s) successfully.`;
    if (failed.length > 0) {
      message += `\n${failed.length} file(s) failed to rename. See table for details.`;
    }

    this.showToast(message, failed.length > 0 ? "warning" : "success");

    // Update file names in the list for successfully renamed files
    if (successful.length > 0) {
      const [getFiles] = this.fileSignals;
      const files = getFiles();

      files.forEach((fileSignal) => {
        const [getName, setName] = fileSignal.nameSignal;
        const [getPath, setPath] = fileSignal.pathSignal;

        const originalName = getName();
        const [getRenameResults] = this.renameResults;
        const renameResult = getRenameResults().get(originalName);

        if (renameResult && renameResult.success && renameResult.newName) {
          // Update the file name to the new name
          setName(renameResult.newName);

          // Update the path to reflect the new name
          const originalPath = getPath();
          // Only replace the filename at the end of the path, not any substring
          const lastSlashIndex = originalPath.lastIndexOf("/");
          const lastBackslashIndex = originalPath.lastIndexOf("\\");
          const lastSeparatorIndex = Math.max(
            lastSlashIndex,
            lastBackslashIndex
          );

          if (lastSeparatorIndex >= 0) {
            // Path has a directory separator, replace only the filename part
            const directory = originalPath.substring(0, lastSeparatorIndex + 1);
            const newPath = directory + renameResult.newName;
            setPath(newPath);
          } else {
            // No directory separator, treat the entire path as filename
            setPath(renameResult.newName);
          }
        }
      });
    }
  }

  /**
   * Add folders functionality (placeholder)
   */
  addFolders() {
    this.showToast("Add Folders functionality not yet implemented", "warning");
  }

  /**
   * Preview changes functionality
   */
  previewChanges() {
    this.showToast(
      "Preview updated - check the file table for changes",
      "success"
    );
  }

  /**
   * Update status bar with file count
   */
  updateStatusBar() {
    const fileCount = document.getElementById("fileCount");
    if (fileCount) {
      const [getFiles] = this.fileSignals;
      fileCount.textContent = `${getFiles().length} files`;
    }
  }

  /**
   * Create a name cell that displays the original filename
   * @param {FileSignalObject} fileSignal
   * @returns {HTMLTableCellElement}
   */
  createNameCell(fileSignal) {
    const nameCell = h("td", { className: "original-name" });
    const preElement = h("pre", { className: "filename" });
    nameCell.appendChild(preElement);

    createEffect(() => {
      const [getName] = fileSignal.nameSignal;
      preElement.textContent = getName();
    });

    return nameCell;
  }

  /**
   * Create a checkbox cell for file selection
   * @param {FileSignalObject} fileSignal
   * @returns {HTMLTableCellElement}
   */
  createCheckboxCell(fileSignal) {
    // Create checkbox for selection
    const checkbox = h("input", {
      type: "checkbox",
      onclick: (e) => {
        e.stopPropagation(); // Prevent row click when clicking checkbox
        const [, setSelected] = fileSignal.selectedSignal;
        setSelected(checkbox.checked);
      },
    });

    const checkboxCell = h("td", null, checkbox);

    // Reactive updates for this checkbox
    createEffect(() => {
      const [getSelected] = fileSignal.selectedSignal;
      const isSelected = getSelected();
      checkbox.checked = isSelected;
    });

    return checkboxCell;
  }

  /**
   * Create a preview cell that shows the new filename after applying rules
   * @param {FileSignalObject} fileSignal
   * @returns {HTMLTableCellElement}
   */
  createPreviewCell(fileSignal) {
    const previewCell = h("td", { className: "new-name" });
    const preElement = h("pre", { className: "filename" });
    previewCell.appendChild(preElement);

    createEffect(() => {
      const [getName] = fileSignal.nameSignal;
      // Apply rules to get preview
      const originalName = getName();
      const rules = this.getRulesFromSignals();
      const previewName = this.applyRulesLocally(originalName, rules);
      preElement.textContent = previewName;
      previewCell.className =
        "new-name" + (previewName === originalName ? " unchanged" : "");
    });

    return previewCell;
  }

  /**
   * Create an error cell that displays rename results
   * @param {FileSignalObject} fileSignal
   * @returns {HTMLTableCellElement}
   */
  createErrorCell(fileSignal) {
    const errorCell = h("td", { className: "error-message" });

    createEffect(() => {
      const [getName] = fileSignal.nameSignal;
      const [getRenameResults] = this.renameResults;
      
      const originalName = getName();
      const resultsMap = getRenameResults();
      
      // Handle rename results and show status in error column
      const renameResult = resultsMap.get(originalName);
      const hasError = renameResult && !renameResult.success;
      if (hasError) {
        errorCell.innerHTML = `<span class="error-icon">❌</span> ${
          renameResult.error || "Unknown error"
        }`;
      } else if (renameResult && renameResult.success) {
        errorCell.innerHTML = `<span class="success-icon">✅</span> Renamed successfully`;
      } else {
        errorCell.textContent = "";
      }
    });

    return errorCell;
  }

  /**
   * Show a toast notification
   * @param {string} message - The message to display
   * @param {'success' | 'warning' | 'error'} type - The type of toast
   */
  showToast(message, type = "success") {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById("toast-container");
    if (!toastContainer) {
      toastContainer = h("div", {
        id: "toast-container",
        className: "toast-container",
      });
      document.body.appendChild(toastContainer);
    }

    // Create toast element
    const toast = h(
      "div",
      {
        className: `toast toast-${type}`,
      },
      message
    );

    // Add to container
    toastContainer.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.classList.add("show");
    }, 10);

    // Auto remove after 5 seconds
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300); // Wait for fade out animation
    }, 5000);
  }

  /**
   * Update the header checkbox state based on file selections
   */
  updateHeaderCheckbox() {
    const selectAllCheckbox = /** @type {HTMLInputElement} */ (
      document.getElementById("selectAllCheckbox")
    );
    if (!selectAllCheckbox) return;

    const [getFiles] = this.fileSignals;
    const files = getFiles();

    if (files.length === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
      return;
    }

    const selectedFiles = files.filter((file) => {
      const [getSelected] = file.selectedSignal;
      return getSelected();
    });

    if (selectedFiles.length === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    } else if (selectedFiles.length === files.length) {
      selectAllCheckbox.checked = true;
      selectAllCheckbox.indeterminate = false;
    } else {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = true;
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
