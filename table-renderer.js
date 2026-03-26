/**
 * table-renderer.js
 * Interactive results table with sorting, filtering, color-coded badges, and keyboard navigation
 */

/**
 * Get containment badge class and label
 * @param {number} containmentPercent - Containment percentage (0-100)
 * @returns {object} {className, label}
 */
export function getContainmentBadge(containmentPercent) {
  if (containmentPercent >= 90) {
    return { className: 'badge-strong', label: 'Strong' };
  } else if (containmentPercent >= 80) {
    return { className: 'badge-likely', label: 'Likely' };
  } else if (containmentPercent >= 70) {
    return { className: 'badge-borderline', label: 'Borderline' };
  }
  return { className: 'badge-weak', label: 'Weak' };
}

/**
 * TableManager: Manages sorting, filtering, and rendering of results table
 * @class
 */
export class TableManager {
  constructor(tableElement, resultsData = []) {
    this.table = tableElement;
    this.thead = this.table.querySelector('thead');
    this.tbody = this.table.querySelector('tbody');
    this.allRows = [];
    this.filteredRows = [];
    this.sortColumn = 'containment_percent'; // Default sort column
    this.sortDirection = 'desc'; // 'asc' or 'desc'
    this.filterText = '';
    this.results = resultsData;
    
    this.setup();
  }

  /**
   * Initialize event listeners on table headers
   */
  setup() {
    // Add click handlers to table headers for sorting
    const headers = this.thead.querySelectorAll('th');
    headers.forEach((header, index) => {
      header.style.cursor = 'pointer';
      header.setAttribute('role', 'button');
      header.setAttribute('tabindex', '0');
      header.setAttribute('aria-sort', 'none');
      
      const columnKey = this.getColumnKeyFromIndex(index);
      if (columnKey) {
        header.dataset.column = columnKey;
      }
      
      // Click handler
      header.addEventListener('click', () => this.handleHeaderClick(header));
      
      // Keyboard handler (Enter or Space)
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.handleHeaderClick(header);
        }
      });
    });
  }

  /**
   * Map column index to data key
   */
  getColumnKeyFromIndex(index) {
    const keys = ['gene_id', 'name', 'organism', 'mechanism', 'containment_percent', 'shared', 'n_kmers', 'length_bp'];
    return keys[index] || null;
  }

  /**
   * Handle header click for sorting
   */
  handleHeaderClick(header) {
    const column = header.dataset.column;
    if (!column) return;

    // Toggle sort direction if clicking same column
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'desc'; // Default to descending for new column
    }

    // Update aria-sort on headers
    this.updateAriaSortAttrs();

    // Re-render with new sort
    this.render();
  }

  /**
   * Update aria-sort attributes on headers
   */
  updateAriaSortAttrs() {
    const headers = this.thead.querySelectorAll('th');
    headers.forEach(header => {
      const column = header.dataset.column;
      if (column === this.sortColumn) {
        header.setAttribute('aria-sort', this.sortDirection === 'asc' ? 'ascending' : 'descending');
      } else {
        header.setAttribute('aria-sort', 'none');
      }
    });
  }

  /**
   * Set filter text and re-render
   */
  setFilter(text) {
    this.filterText = text.toLowerCase();
    this.render();
  }

  /**
   * Filter results by gene substring
   */
  filterByGene(results) {
    if (!this.filterText) return results;
    
    return results.filter(row => {
      const geneId = (row.gene_id || '').toLowerCase();
      const name = (row.name || '').toLowerCase();
      return geneId.includes(this.filterText) || name.includes(this.filterText);
    });
  }

  /**
   * Sort results by column
   */
  sortResults(results) {
    const sorted = [...results];
    
    sorted.sort((a, b) => {
      let aVal = a[this.sortColumn];
      let bVal = b[this.sortColumn];
      
      // Handle numeric columns
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return this.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      // Handle string columns
      aVal = String(aVal || '').toLowerCase();
      bVal = String(bVal || '').toLowerCase();
      
      if (this.sortDirection === 'asc') {
        return aVal.localeCompare(bVal);
      } else {
        return bVal.localeCompare(aVal);
      }
    });
    
    return sorted;
  }

  /**
   * Render table rows
   */
  render() {
    // Filter
    this.filteredRows = this.filterByGene(this.results);
    
    // Sort
    this.filteredRows = this.sortResults(this.filteredRows);
    
    // Clear table body
    this.tbody.innerHTML = '';
    
    // Handle no results
    if (this.filteredRows.length === 0) {
      const row = this.tbody.insertRow();
      row.innerHTML = `<td colspan="8" style="text-align: center; padding: 2rem; color: #999;">
        ${this.filterText ? 'No genes match filter' : 'No AMR genes detected above threshold'}
      </td>`;
      return;
    }
    
    // Render filtered rows
    this.filteredRows.forEach((result, index) => {
      this.renderRow(result, index);
    });
  }

  /**
   * Render a single row
   */
  renderRow(result, rowIndex) {
    const row = this.tbody.insertRow();
    row.setAttribute('role', 'row');
    
    // Get containment badge
    const containmentPercent = result.containment_percent || Math.round(result.containment * 100);
    const badge = getContainmentBadge(containmentPercent);
    
    // Build row HTML
    row.innerHTML = `
      <td role="cell"><code>${escapeHtml(result.gene_id)}</code></td>
      <td role="cell">${escapeHtml(result.name || result.gene_id)}</td>
      <td role="cell">${escapeHtml(result.organism)}</td>
      <td role="cell"><small>${escapeHtml(result.mechanism)}</small></td>
      <td role="cell">
        <div class="containment-cell">
          <span class="badge ${badge.className}" title="${badge.label}">${badge.label}</span>
          <strong>${containmentPercent}%</strong>
        </div>
      </td>
      <td role="cell" class="numeric">${result.shared}</td>
      <td role="cell" class="numeric">${result.n_kmers}</td>
      <td role="cell" class="numeric">${result.length_bp.toLocaleString()}</td>
    `;
    
    // Add row count for screen readers
    if (rowIndex === 0 && this.filteredRows.length > 0) {
      row.setAttribute('aria-label', `Result row 1 of ${this.filteredRows.length}`);
    }
  }

  /**
   * Get row count
   */
  getRowCount() {
    return this.filteredRows.length;
  }

  /**
   * Update results data and re-render
   */
  setResults(results) {
    this.results = results;
    this.filterText = '';
    this.sortColumn = 'containment_percent';
    this.sortDirection = 'desc';
    this.updateAriaSortAttrs();
    this.render();
  }
}

/**
 * Create a results summary string
 */
export function createResultsSummary(filteredCount, totalCount, filterText) {
  if (filteredCount === 0) {
    return filterText ? `No genes match "${filterText}"` : 'No genes detected';
  }
  
  if (filterText) {
    return `${filteredCount} of ${totalCount} gene${totalCount !== 1 ? 's' : ''} match "${filterText}"`;
  }
  
  return `${filteredCount} gene${filteredCount !== 1 ? 's' : ''} detected`;
}

/**
 * Setup table controls (filter input, summary)
 */
export function setupTableControls(containerId, tableManager, onFilterChange) {
  const container = document.querySelector(containerId);
  if (!container) return;
  
  // Create filter row
  const filterRow = document.createElement('div');
  filterRow.className = 'table-controls';
  filterRow.innerHTML = `
    <div class="filter-group">
      <label for="geneFilter">Filter by Gene:</label>
      <input 
        type="text" 
        id="geneFilter" 
        placeholder="Search gene ID or name..."
        class="filter-input"
        aria-label="Filter results by gene ID or name"
      >
      <small class="filter-hint">Search as you type</small>
    </div>
    <div class="results-summary" id="resultsSummary" role="status" aria-live="polite"></div>
  `;
  
  // Insert before table
  const tableWrapper = container.querySelector('.table-wrapper');
  if (tableWrapper) {
    tableWrapper.parentNode.insertBefore(filterRow, tableWrapper);
  }
  
  // Setup filter input listener
  const filterInput = filterRow.querySelector('#geneFilter');
  filterInput.addEventListener('input', (e) => {
    const filterText = e.target.value.trim();
    tableManager.setFilter(filterText);
    updateSummary(tableManager, filterText);
    if (onFilterChange) onFilterChange(tableManager);
  });
  
  // Initialize summary
  updateSummary(tableManager, '');
}

/**
 * Update results summary display
 */
function updateSummary(tableManager, filterText) {
  const summaryEl = document.getElementById('resultsSummary');
  if (!summaryEl) return;
  
  const filteredCount = tableManager.getRowCount();
  const totalCount = tableManager.results.length;
  const summary = createResultsSummary(filteredCount, totalCount, filterText);
  
  summaryEl.textContent = summary;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
