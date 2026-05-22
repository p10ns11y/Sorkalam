/**
 * Tamil VU glossary HTML → structured JSON (DOMParser; use in popup / extension pages).
 *
 * @typedef {Object} TamilVUGlossaryTable
 * @property {string[]} columns - Normalized keys (e.g. english, tamil, subject)
 * @property {Record<string, string>[]} rows - One object per data row
 *
 * @typedef {Object} TamilVUGlossaryEntry
 * @property {string} translationText - Term to show (usually Tamil when searching English)
 * @property {string} subjectArea
 * @property {Record<string, string>} row - Full row for traversal / future UI
 */

const TAMIL_VU_HEADER_KEYS = {
  'sl. no': 'slNo',
  'sl no': 'slNo',
  's.no': 'slNo',
  's no': 'slNo',
  's.no.': 'slNo',
  english: 'english',
  tamil: 'tamil',
  subject: 'subject',
  volume: 'volume',
};

/** Tamil VU result rows are usually 5 cells (header is often HTML-commented out). */
const TAMIL_VU_DATA_COLUMNS_5 = ['slNo', 'volume', 'subject', 'english', 'tamil'];

function normalizeCellText(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}

function normalizeColumnKey(headerText) {
  const normalized = normalizeCellText(headerText).toLowerCase();
  if (TAMIL_VU_HEADER_KEYS[normalized]) return TAMIL_VU_HEADER_KEYS[normalized];
  return normalized.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'col';
}

function hasTamilScript(text) {
  return /[\u0B80-\u0BFF]/.test(text);
}

function getRowCells(tableRow) {
  return [...tableRow.querySelectorAll('td')].map((cell) =>
    normalizeCellText(cell.textContent)
  );
}

/** Data row: leading serial number and/or Tamil in the last column. */
function isGlossaryDataRow(cells) {
  if (cells.length < 4) return false;
  const serial = cells[0];
  const lastCell = cells[cells.length - 1];
  return /^\d+$/.test(serial) || hasTamilScript(lastCell);
}

function inferDataColumns(cellCount) {
  if (cellCount >= 5) return TAMIL_VU_DATA_COLUMNS_5.slice(0, cellCount);
  if (cellCount === 4) return ['slNo', 'subject', 'english', 'tamil'];
  return Array.from({ length: cellCount }, (_, index) => `col${index}`);
}

function rowLooksLikeHeader(cells) {
  return (
    cells.some((text) => /^English\s*$/i.test(text)) &&
    cells.some((text) => /^Subject\s*$/i.test(text))
  );
}

function findGlossaryResultsTable(documentRoot) {
  const byClass = documentRoot.querySelector('table[class*="slet_technical"]');
  if (byClass) return byClass;

  for (const table of documentRoot.querySelectorAll('table')) {
    for (const tableRow of table.querySelectorAll('tr')) {
      const cells = getRowCells(tableRow);
      if (isGlossaryDataRow(cells)) return table;
    }
  }

  return documentRoot.querySelector('table');
}

/**
 * Parse the main results table into column keys and row objects.
 * @param {string} glossaryPageHtml
 * @returns {TamilVUGlossaryTable}
 */
function parseTamilVUGlossaryHtml(glossaryPageHtml) {
  if (!glossaryPageHtml || typeof glossaryPageHtml !== 'string') {
    return { columns: [], rows: [] };
  }

  const documentRoot = new DOMParser().parseFromString(glossaryPageHtml, 'text/html');
  const table = findGlossaryResultsTable(documentRoot);
  if (!table) return { columns: [], rows: [] };

  const tableRows = [...table.querySelectorAll('tr')].filter((row) =>
    row.querySelector('td')
  );
  if (!tableRows.length) return { columns: [], rows: [] };

  let columns = inferDataColumns(getRowCells(tableRows[0]).length);
  let startRowIndex = 0;

  for (let rowIndex = 0; rowIndex < Math.min(5, tableRows.length); rowIndex++) {
    const headerCells = [...tableRows[rowIndex].querySelectorAll('th, td')].map((cell) =>
      normalizeCellText(cell.textContent)
    );
    if (rowLooksLikeHeader(headerCells)) {
      columns =
        headerCells.length >= 4
          ? headerCells.map(normalizeColumnKey)
          : inferDataColumns(headerCells.length);
      startRowIndex = rowIndex + 1;
      break;
    }
  }

  if (startRowIndex === 0) {
    const firstCells = getRowCells(tableRows[0]);
    if (isGlossaryDataRow(firstCells)) {
      columns = inferDataColumns(firstCells.length);
      startRowIndex = 0;
    }
  }

  const rows = [];
  for (let rowIndex = startRowIndex; rowIndex < tableRows.length; rowIndex++) {
    const dataCells = getRowCells(tableRows[rowIndex]);
    if (!isGlossaryDataRow(dataCells)) continue;

    /** @type {Record<string, string>} */
    const row = {};
    columns.forEach((columnKey, columnIndex) => {
      row[columnKey] = dataCells[columnIndex] ?? '';
    });
    rows.push(row);
  }

  return { columns, rows };
}

function pickField(row, ...keys) {
  for (const key of keys) {
    if (row[key]) return row[key];
  }
  return '';
}

/**
 * Map structured rows to popup display entries.
 * @param {TamilVUGlossaryTable} glossaryTable
 * @param {'Tamil'|'English'} glossarySearchColumn
 * @returns {TamilVUGlossaryEntry[]}
 */
function glossaryTableToEntries(glossaryTable, glossarySearchColumn) {
  const entries = [];

  for (const row of glossaryTable.rows) {
    const english = pickField(row, 'english', 'col3');
    const tamil = pickField(row, 'tamil', 'col4');
    let subjectArea = pickField(row, 'subject', 'col2').replace(/Volume\s*-\s*\d+/i, '').trim();

    let translationText = '';
    if (glossarySearchColumn === 'Tamil') {
      translationText = tamil || english;
    } else if (hasTamilScript(tamil)) {
      translationText = tamil;
    } else if (hasTamilScript(english)) {
      translationText = english;
    } else {
      translationText =
        tamil ||
        english ||
        Object.values(row).find((value) => hasTamilScript(value)) ||
        '';
    }

    if (
      /^English\s*$/i.test(translationText) &&
      /^Subject\s*$/i.test(subjectArea)
    ) {
      continue;
    }

    if (
      translationText &&
      translationText.length > 2 &&
      translationText !== subjectArea
    ) {
      entries.push({ translationText, subjectArea, row });
    }
  }

  return entries;
}

const TamilVUGlossaryParse = {
  parseTamilVUGlossaryHtml,
  glossaryTableToEntries,
};

if (typeof globalThis !== 'undefined') {
  globalThis.TamilVUGlossaryParse = TamilVUGlossaryParse;
}
