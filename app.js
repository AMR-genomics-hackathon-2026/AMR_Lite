/**
 * AMR Lite: k-mer containment based AMR gene detection
 * Privacy-preserving, browser-only, genotype-only demo
 * 
 * ES Module with WebR integration and robust FASTA parsing
 */

// VERSION IDENTIFIER - Using new sequence-based database
console.log('%c=== AMR Lite (Sequence-based database, variable k-values) ===', 'color: blue; font-weight: bold;');

import { initializeWebR, getWebR, isWebRReady, logWebRStatus } from './webr-init.js';
import { parseFasta, calculateStats, formatStats } from './fasta-parser.js';
import { countKmersWithR } from './kmer-counter.js';
import {
  loadSignatures as loadSignaturesPack,
  getCachedSignatures,
  getCachedOrganisms,
  filterByOrganism,
  getSignatureSummary,
} from './signature-loader.js';
import {
  buildKmerSet,
  scoreAllSignatures,
  scoreAndGetTopHits,
  getScoringStats,
  createDebouncedScorer,
} from './containment-matcher.js';
import { TableManager, setupTableControls } from './table-renderer.js';

const State = {
  fastaData: null,
  fastaSequences: null, // Array of {header, seq}
  fastaStats: null,     // {contigs, totalBp, n50, minLen, maxLen, avgLen}
  signatures: null,
  currentResults: null,
  analysisTime: null,
  isLoading: false,
  webRReady: false,
  tableManager: null, // TableManager instance for results table
};

const UIElements = {
  fastaInput: null,
  fileName: null,
  fileSize: null,
  sampleLink: null,
  kmerSize: null,
  minShared: null,
  threshold: null,
  signatureFilter: null,
  analyzeBtn: null,
  downloadCsvBtn: null,
  downloadJsonBtn: null,
  resetBtn: null,
  statusBox: null,
  statusLog: null,
  summarySection: null,
  contigCount: null,
  totalBp: null,
  amrCount: null,
  analysisTimeEl: null,
  resultsSection: null,
  resultsBody: null,
  qcSection: null,
  kmerChart: null,
  containmentChart: null,
  toastContainer: null,
};

/**
 * Toast Notification System
 */
function showToast(message, type = 'info', duration = 5000, retry = null) {
  const container = UIElements.toastContainer;
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const iconMap = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };
  
  let content = `<span class="toast-icon">${iconMap[type] || 'ℹ'}</span>`;
  content += `<span class="toast-content">${message}`;
  if (retry) {
    content += ` <a href="#" onclick="event.preventDefault(); ${retry}">Retry</a>`;
  }
  content += `</span>`;
  content += `<button class="toast-close" aria-label="Close notification" onclick="this.parentElement.remove()">✕</button>`;
  
  toast.innerHTML = content;
  container.appendChild(toast);
  
  if (duration > 0) {
    setTimeout(() => {
      toast.classList.add('remove');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

/**
 * Initialize UI elements from DOM
 */
function initializeUIElements() {
  try {
    UIElements.fastaInput = document.getElementById('fastaInput');
    UIElements.fileName = document.getElementById('fileName');
    UIElements.fileSize = document.querySelector('.file-size');
    UIElements.sampleLink = document.getElementById('sampleLink');
    UIElements.kmerSize = document.getElementById('kmerSize');
    UIElements.minShared = document.getElementById('minShared');
    UIElements.threshold = document.getElementById('threshold');
    UIElements.signatureFilter = document.getElementById('signatureFilter');
    UIElements.analyzeBtn = document.getElementById('analyzeBtn');
    UIElements.downloadCsvBtn = document.getElementById('downloadCsvBtn');
    UIElements.downloadJsonBtn = document.getElementById('downloadJsonBtn');
    UIElements.resetBtn = document.getElementById('resetBtn');
    UIElements.statusBox = document.getElementById('statusBox');
    UIElements.statusLog = document.getElementById('statusLog');
    UIElements.summarySection = document.getElementById('summarySection');
    UIElements.contigCount = document.getElementById('contigCount');
    UIElements.totalBp = document.getElementById('totalBp');
    UIElements.amrCount = document.getElementById('amrCount');
    UIElements.analysisTimeEl = document.getElementById('analysisTime');
    UIElements.resultsSection = document.getElementById('resultsSection');
    UIElements.resultsBody = document.getElementById('resultsBody');
    UIElements.qcSection = document.getElementById('qcSection');
    UIElements.kmerChart = document.getElementById('kmerChart');
    UIElements.containmentChart = document.getElementById('containmentChart');
    UIElements.toastContainer = document.getElementById('toastContainer');
    
    // Check for missing elements
    const missing = Object.entries(UIElements).filter(
      ([key, el]) => el === null && !key.includes('Chart')
    );
    
    if (missing.length > 0) {
      console.warn(`Missing UI elements: ${missing.map(m => m[0]).join(', ')}`);
    }
    
    console.log('✓ UI elements initialized', UIElements);
    return true;
  } catch (err) {
    console.error('Failed to initialize UI elements:', err);
    return false;
  }
}

/**
 * Initialize the app: load signatures and set up event listeners
 */
async function initApp() {
  console.log('=== AMR Lite Initialization Started ===');
  console.log('Initializing UI elements...');
  
  // Initialize UI elements first
  if (!initializeUIElements()) {
    console.error('Failed to initialize UI elements');
    return;
  }
  
  logStatus('Initializing application...', 'info');
  
  try {
    // Initialize WebR first
    logStatus('Initializing WebR for k-mer analysis...', 'info');
    await initializeWebR();
    State.webRReady = true;
    logStatus('WebR initialized successfully', 'success');
  } catch (err) {
    console.error('WebR initialization failed:', err);
    logStatus(`WebR init error: ${err.message}. Falling back to JS-only mode.`, 'warning');
    // Continue with JS-only mode; don't fail the whole app
    State.webRReady = false;
  }

  try {
    await loadSignatures();
    setupEventListeners();
    if (State.webRReady) {
      logStatus('App fully initialized with WebR', 'success');
      setStatus('✓ Ready. Load a FASTA file to begin.', 'success');
    } else {
      logStatus('App initialized (WebR not available)', 'warning');
      setStatus('Ready (WebR unavailable - using JavaScript-only k-mer analysis)', 'warning');
    }
    console.log('=== AMR Lite Initialization Complete ===');
  } catch (err) {
    console.error('Init failed:', err);
    logStatus(`Initialization error: ${err.message}`, 'error');
    setStatus(`Error: ${err.message}`, 'error');
  }
}

/**
 * Load and decompress AMR signatures (NEW sequence-based database)
 * Falls back to legacy k-mer database if needed
 */
async function loadSignatures() {
  logStatus('Loading AMR signature pack...', 'info');
  try {
    // Load new sequence-based database (1.2 MB gzipped, supports variable k-values)
    // Falls back automatically to legacy k-mer database if not found
    State.signatures = await loadSignaturesPack('./data/amr_signatures_sequences.json.gz');
    const summary = getSignatureSummary();
    logStatus(`✓ Loaded ${summary.geneCount} gene signatures from ${summary.organisms.length} organism(s)`, 'success');
    
    // Populate filter dropdown
    populateSignatureFilter();
    
    // Show summary
    console.log('Signature pack summary:', summary);
  } catch (err) {
    console.error('Failed to load signatures:', err);
    logStatus(`Failed to load signatures: ${err.message}`, 'error');
    
    // Show toast with retry option
    const retryFn = `() => { State.signatures = null; window.loadSignatures(); }`;
    showToast(
      `Signature pack error: ${err.message}`,
      'error',
      0, // Don't auto-dismiss
      retryFn
    );
    
    // Fallback: use fallback signatures (plain JSON)
    await loadSignaturesFallback();
  }
}

/**
 * Fallback: Load plain JSON signatures if gzipped version fails
 */
async function loadSignaturesFallback() {
  try {
    logStatus('Attempting fallback: loading plain JSON signatures...', 'info');
    const response = await fetch('./data/amr_signatures.json');
    if (!response.ok) throw new Error(response.statusText);
    
    const data = await response.json();
    
    // Convert old format to new format if needed
    if (Array.isArray(data)) {
      State.signatures = data;
    } else {
      // Old object format - skip, use mock instead
      throw new Error('Unexpected signature format');
    }
    
    logStatus('✓ Loaded signatures from plain JSON (fallback)', 'success');
    populateSignatureFilter();
  } catch (err) {
    console.error('Fallback load failed:', err);
    logStatus('Using mock signatures for demonstration', 'warning');
    State.signatures = createMockSignatures();
    populateSignatureFilter();
  }
}

/**
 * Populate the signature filter dropdown with organisms
 */
function populateSignatureFilter() {
  if (!UIElements.signatureFilter) return;
  
  const organisms = getCachedOrganisms();
  
  // Clear existing options (except first "All")
  while (UIElements.signatureFilter.options.length > 1) {
    UIElements.signatureFilter.remove(1);
  }
  
  // Add organism options
  organisms.forEach(org => {
    const option = document.createElement('option');
    option.value = org;
    option.textContent = org;
    UIElements.signatureFilter.appendChild(option);
  });
  
  console.log(`Filter dropdown populated with ${organisms.length} organisms`);
}

/**
 * Create mock AMR signatures for demo purposes
 */
function createMockSignatures() {
  return [
    {
      gene_id: 'blaNDM-1',
      name: 'NDM-1 Beta-Lactamase',
      organism: 'Enterobacteriaceae',
      length_bp: 813,
      k: 21,
      n_kmers: 150,
      kmers: generateMockKmers('blaNDM-1', 150),
      mechanism: 'Beta-lactamase (carbapenem resistance)',
      phenotype_note: 'Genotype only; phenotype prediction not supported',
    },
    {
      gene_id: 'oqxAB',
      name: 'OqxAB Efflux Pump',
      organism: 'Escherichia/Shigella',
      length_bp: 1587,
      k: 21,
      n_kmers: 120,
      kmers: generateMockKmers('oqxAB', 120),
      mechanism: 'Efflux pump (fluoroquinolone resistance)',
      phenotype_note: 'Genotype only; phenotype prediction not supported',
    },
    {
      gene_id: 'acrAB',
      name: 'AcrAB Efflux System',
      organism: 'Escherichia/Shigella',
      length_bp: 2847,
      k: 21,
      n_kmers: 200,
      kmers: generateMockKmers('acrAB', 200),
      mechanism: 'Multidrug efflux pump',
      phenotype_note: 'Genotype only; phenotype prediction not supported',
    },
  ];
}

/**
 * Generate mock k-mers for a gene (for demo)
 */
function generateMockKmers(geneId, count) {
  const kmers = [];
  const bases = 'ACGT';
  for (let i = 0; i < count; i++) {
    let kmer = '';
    for (let j = 0; j < 21; j++) {
      kmer += bases[Math.floor(Math.random() * 4)];
    }
    kmers.push(kmer);
  }
  return kmers;
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  try {
    if (UIElements.fastaInput) {
      UIElements.fastaInput.addEventListener('change', handleFileSelect);
      console.log('✓ File input listener attached');
    } else {
      console.warn('fastaInput not found');
    }
    
    if (UIElements.sampleLink) {
      UIElements.sampleLink.addEventListener('click', handleSampleDownload);
    }
    
    if (UIElements.signatureFilter) {
      UIElements.signatureFilter.addEventListener('change', handleSignatureFilter);
      console.log('✓ Signature filter listener attached');
    }
    
    if (UIElements.analyzeBtn) {
      UIElements.analyzeBtn.addEventListener('click', handleAnalyze);
    }
    if (UIElements.downloadCsvBtn) {
      UIElements.downloadCsvBtn.addEventListener('click', downloadCsv);
    }
    if (UIElements.downloadJsonBtn) {
      UIElements.downloadJsonBtn.addEventListener('click', downloadJson);
    }
    if (UIElements.resetBtn) {
      UIElements.resetBtn.addEventListener('click', handleReset);
    }
    console.log('✓ All event listeners attached');
  } catch (err) {
    console.error('Error setting up event listeners:', err);
    logStatus(`Failed to set up event listeners: ${err.message}`, 'error');
  }
}

/**
 * Handle signature filter dropdown change
 */
function handleSignatureFilter(e) {
  const organism = e.target.value;
  console.log(`Signature filter changed to: "${organism}"`);
  
  if (organism === '') {
    // Show all signatures
    logStatus('Showing all organisms', 'info');
  } else {
    // Filter to specific organism
    const filtered = filterByOrganism(organism);
    logStatus(`Filtered to ${organism}: ${filtered.length} signature(s)`, 'info');
  }
  
  // Re-run analysis if already done so results update with filtered sigs
  if (State.currentResults) {
    logStatus('Re-analyzing with updated signature filter...', 'info');
    // Mark signatures for next analysis
  }
}

/**
 * Handle file selection via input
 */
function handleFileSelect(e) {
  console.log('File input change event triggered', e);
  const file = e.target.files[0];
  if (file) {
    console.log('File selected:', file.name, file.size, file.type);
    loadFastaFile(file);
  } else {
    console.log('No file selected');
  }
}

/**
 * Handle sample FASTA download
 */
async function handleSampleDownload(e) {
  e.preventDefault();
  try {
    logStatus('Fetching sample genome...', 'info');
    const response = await fetch('./data/sample_genes.fasta');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const sampleFasta = await response.text();
    const blob = new Blob([sampleFasta], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample_AMR_test_genome.fasta';
    link.click();
    URL.revokeObjectURL(url);
    
    logStatus('✓ Sample FASTA downloaded (realistic AMR test genome)', 'success');
  } catch (err) {
    console.error('Failed to download sample:', err);
    logStatus(`Failed to download sample: ${err.message}`, 'error');
    // Fallback to inline data
    const fallbackFasta = `>test_fallback organism="Klebsiella_pneumoniae"
ACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGT`;
    const blob = new Blob([fallbackFasta], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample.fasta';
    link.click();
    URL.revokeObjectURL(url);
  }
}

/**
 * Load FASTA file using robust parser
 */
async function loadFastaFile(file) {
  console.log('loadFastaFile called with:', file);
  logStatus(`Loading ${file.name}...`, 'info');
  
  try {
    logStatus(`Parsing FASTA file (${formatBytes(file.size)})...`, 'info');
    console.log('Calling parseFasta...');
    
    // Parse FASTA
    State.fastaSequences = await parseFasta(file);
    console.log('Parse successful, sequences:', State.fastaSequences.length);
    
    State.fastaStats = calculateStats(State.fastaSequences);
    console.log('Stats calculated:', State.fastaStats);
    
    // Combine all sequences into single string for k-mer analysis
    State.fastaData = State.fastaSequences.map(s => s.seq).join('');
    console.log('Combined data length:', State.fastaData.length);
    
    if (UIElements.fileName) UIElements.fileName.textContent = file.name;
    if (UIElements.fileSize) UIElements.fileSize.textContent = `(${formatBytes(file.size)})`;
    if (UIElements.fastaInput) UIElements.fastaInput.value = '';
    
    const statsStr = formatStats(State.fastaStats);
    logStatus(`Loaded: ${file.name} - ${statsStr}`, 'success');
    setStatus(`✓ Loaded: ${statsStr}`, 'success');
    if (UIElements.analyzeBtn) UIElements.analyzeBtn.disabled = false;
  } catch (err) {
    console.error('Error loading file:', err);
    console.error('Stack:', err.stack);
    logStatus(`Error loading file: ${err.message}`, 'error');
    setStatus(`Error: ${err.message}`, 'error');
    State.fastaSequences = null;
    State.fastaStats = null;
    State.fastaData = null;
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Extract k-mers from sequence (sliding window)
 */
function extractKmers(sequence, kSize) {
  const kmers = {};
  for (let i = 0; i <= sequence.length - kSize; i++) {
    const kmer = sequence.substring(i, i + kSize);
    // Only count canonical k-mers (no ambiguous bases)
    if (/^[ACGT]+$/.test(kmer)) {
      kmers[kmer] = (kmers[kmer] || 0) + 1;
    }
  }
  return kmers;
}

/**
 * Calculate k-mer containment and shared count
 */
function calculateContainment(queryKmers, referenceKmers) {
  let matches = 0;
  for (const kmer of Object.keys(referenceKmers)) {
    if (kmer in queryKmers) {
      matches++;
    }
  }
  const total = Object.keys(referenceKmers).length;
  return {
    containment: total > 0 ? (matches / total) * 100 : 0,
    shared: matches,
    totalGeneKmers: total,
  };
}

/**
 * Run analysis with k-mer containment matching
 */
async function handleAnalyze() {
  if (!State.fastaSequences || State.fastaSequences.length === 0) {
    setStatus('Please load a FASTA file first', 'error');
    logStatus('Analyze clicked without FASTA file loaded', 'error');
    return;
  }
  
  if (!State.signatures || State.signatures.length === 0) {
    setStatus('Signature database not loaded', 'error');
    logStatus('Analyze clicked but signatures not loaded', 'error');
    return;
  }
  
  UIElements.analyzeBtn.disabled = true;
  logStatus('Analysis started...', 'info');
  setStatus('Analyzing...', 'info');
  
  const startTime = Date.now();
  
  try {
    const kSize = parseInt(UIElements.kmerSize.value) || 21;
    const minShared = parseInt(UIElements.minShared.value) || 50;
    const thresholdPercent = parseInt(UIElements.threshold.value) || 90;
    const minContainment = thresholdPercent / 100;
    
    console.log(`[Analysis] K-mer=${kSize}, minShared=${minShared}, minContainment=${(minContainment*100).toFixed(0)}%`);
    logStatus(`Parameters: K-mer=${kSize}bp, Min Shared=${minShared}, Containment ≥${thresholdPercent}%`, 'info');
    
    const contigCount = State.fastaStats.contigs;
    const totalBp = State.fastaStats.totalBp;
    logStatus(`Genome: ${contigCount} contig(s), ${totalBp.toLocaleString()} bp total, N50=${State.fastaStats.n50}`, 'info');
    
    // Get k-mers from query genome
    let queryKmers = null;
    let kmerSource = 'JS';
    
    // Try R-based k-mer counting if WebR available
    if (State.webRReady) {
      try {
        logStatus('Counting k-mers with R (kmer package)...', 'info');
        const rKmerCounts = await countKmersWithR(State.fastaSequences, kSize, true);
        console.log(`[Analysis] R-based k-mer count: ${rKmerCounts.length} unique k-mers`);
        queryKmers = buildKmerSet(rKmerCounts);
        kmerSource = 'R (kmer::kcount)';
      } catch (rErr) {
        console.warn('[Analysis] R-based k-mer counting failed, falling back to JS:', rErr.message);
        logStatus(`R k-mer counting failed (${rErr.message}), falling back to JavaScript`, 'warning');
        kmerSource = 'JS (fallback)';
      }
    }
    
    // Fall back to JS-based extraction
    if (!queryKmers) {
      logStatus(`Extracting ${kSize}-mers from genome (JavaScript)...`, 'info');
      // Combine all sequences
      const combinedSeq = State.fastaSequences.map(s => s.seq).join('');
      const jsKmers = extractKmers(combinedSeq, kSize);
      queryKmers = new Set(Object.keys(jsKmers));
    }
    
    const uniqueKmers = queryKmers.size;
    logStatus(`✓ Extracted ${uniqueKmers.toLocaleString()} unique ${kSize}-mers (from ${kmerSource})`, 'success');
    
    // Get signatures (apply organism filter if set)
    let sigsToScore = State.signatures;
    const selectedOrganism = UIElements.signatureFilter?.value;
    if (selectedOrganism) {
      sigsToScore = filterByOrganism(selectedOrganism);
      logStatus(`Applied organism filter: ${selectedOrganism} (${sigsToScore.length} signatures)`, 'info');
    } else {
      logStatus(`Comparing against ${sigsToScore.length} AMR gene signatures...`, 'info');
    }
    
    // Containment matching with debouncing
    logStatus('Running containment matching (debounced for UI responsiveness)...', 'info');
    
    const scoringOptions = { minShared, minContainment, k: kSize };
    const topN = 100;
    
    // Use debounced scorer
    const results = await new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const scored = scoreAndGetTopHits(sigsToScore, queryKmers, topN, scoringOptions);
          const stats = getScoringStats(scored);
          resolve({ results: scored, stats });
        } catch (err) {
          reject(err);
        }
      }, 50); // Small debounce delay
    });
    
    const { results: hitResults, stats } = results;
    State.currentResults = hitResults;
    
    const endTime = Date.now();
    State.analysisTime = ((endTime - startTime) / 1000).toFixed(2);
    
    logStatus(
      `✓ Analysis complete in ${State.analysisTime}s: ` +
      `${hitResults.length} hit(s), ` +
      `containment range: ${(stats.minContainment * 100).toFixed(1)}-${(stats.maxContainment * 100).toFixed(1)}%, ` +
      `median: ${(stats.medianContainment * 100).toFixed(1)}%`,
      'success'
    );
    
    setStatus(
      hitResults.length > 0
        ? `✓ Complete: ${hitResults.length} putative AMR gene(s) detected (${topN > hitResults.length ? 'all' : 'top ' + topN})`
        : `No hits above thresholds (${minShared} k-mers, ${thresholdPercent}% containment)`,
      hitResults.length > 0 ? 'success' : 'warning'
    );
    
    // Display results
    displayResults(hitResults, contigCount, totalBp, stats);
    
    // Enable download buttons
    if (hitResults.length > 0) {
      UIElements.downloadCsvBtn.disabled = false;
      UIElements.downloadJsonBtn.disabled = false;
    }
  } catch (err) {
    console.error('[Analysis] Error:', err);
    console.error('[Analysis] Stack:', err.stack);
    logStatus(`Analysis error: ${err.message}`, 'error');
    setStatus(`Error: ${err.message}`, 'error');
    showToast(`Analysis error: ${err.message}`, 'error', 0);
  } finally {
    UIElements.analyzeBtn.disabled = false;
  }
}

/**
 * Display results in table and summary
 */
function displayResults(results, contigCount, totalBp, stats) {
  // Show summary panel
  UIElements.summarySection.style.display = 'block';
  UIElements.contigCount.textContent = contigCount.toLocaleString();
  UIElements.totalBp.textContent = totalBp.toLocaleString();
  UIElements.amrCount.textContent = results.length;
  UIElements.analysisTimeEl.textContent = `${State.analysisTime}s`;
  
  // Clear previous additional items
  const summaryGrid = document.querySelector('.summary-grid');
  if (summaryGrid) {
    summaryGrid.querySelectorAll('.n50-item, .avg-item, .stats-item').forEach(el => el.remove());
    
    // Add N50 item
    if (State.fastaStats) {
      const n50Item = document.createElement('div');
      n50Item.className = 'summary-item n50-item';
      n50Item.innerHTML = `
        <span class="summary-label">N50:</span>
        <span class="summary-value">${State.fastaStats.n50.toLocaleString()} bp</span>
      `;
      summaryGrid.appendChild(n50Item);
      
      // Add avg length item
      const avgItem = document.createElement('div');
      avgItem.className = 'summary-item avg-item';
      avgItem.innerHTML = `
        <span class="summary-label">Avg Length:</span>
        <span class="summary-value">${State.fastaStats.avgLen.toLocaleString()} bp</span>
      `;
      summaryGrid.appendChild(avgItem);
    }
    
    // Add stats if available
    if (stats) {
      const statsItem = document.createElement('div');
      statsItem.className = 'summary-item stats-item';
      statsItem.innerHTML = `
        <span class="summary-label">Containment (Median):</span>
        <span class="summary-value">${(stats.medianContainment * 100).toFixed(1)}%</span>
      `;
      summaryGrid.appendChild(statsItem);
    }
  }
  
  // Show results table
  UIElements.resultsSection.style.display = 'block';
  
  if (results.length === 0) {
    UIElements.resultsBody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #999;">No AMR genes detected above threshold</td></tr>`;
    return;
  }
  
  // Initialize or update TableManager
  const resultsTable = document.getElementById('resultsTable');
  if (!State.tableManager) {
    State.tableManager = new TableManager(resultsTable, results);
    
    // Setup filter controls if not already present
    const tableContainer = document.getElementById('tableContainer');
    if (tableContainer && !tableContainer.querySelector('.table-controls')) {
      setupTableControls('#tableContainer', State.tableManager);
    }
  } else {
    // Update with new results
    State.tableManager.setResults(results);
  }
  
  // Show QC section
  UIElements.qcSection.style.display = 'block';
  drawQcCharts(results);
}

/**
 * Draw QC charts
 */
function drawQcCharts(results) {
  // Containment distribution chart (convert to percentage)
  if (UIElements.containmentChart && results.length > 0) {
    const containmentPercentages = results.map(r => (r.containment_percent !== undefined) ? r.containment_percent : Math.round(r.containment * 100));
    drawHistogram(UIElements.containmentChart, containmentPercentages, 'Containment (%)');
  }
  
  // K-mer chart (shared k-mers distribution)
  if (UIElements.kmerChart && results.length > 0) {
    const sharedKmerCounts = results.map(r => r.shared);
    drawHistogram(UIElements.kmerChart, sharedKmerCounts, 'Shared K-mers');
  }
}

/**
 * Draw simple histogram on canvas
 */
function drawHistogram(canvas, data, label) {
  if (!canvas || !canvas.getContext) return;
  
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const maxValue = Math.max(...data, 1);
  const barWidth = width / (data.length || 1);
  const padding = 40;
  
  // Clear canvas
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  
  // Draw axes
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, height - padding);
  ctx.lineTo(width - 20, height - padding);
  ctx.moveTo(padding, height - padding);
  ctx.lineTo(padding, 20);
  ctx.stroke();
  
  // Draw bars
  ctx.fillStyle = '#0066cc';
  for (let i = 0; i < data.length; i++) {
    const barHeight = (data[i] / maxValue) * (height - 2 * padding);
    const x = padding + i * barWidth + 5;
    const y = height - padding - barHeight;
    ctx.fillRect(x, y, barWidth - 10, barHeight);
  }
  
  // Labels
  ctx.fillStyle = '#333';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, width / 2, height - 5);
}

/**
 * Download results as CSV
 */
/**
 * Download results as CSV
 */
function downloadCsv() {
  if (!State.currentResults || State.currentResults.length === 0) {
    alert('No results to download');
    return;
  }
  
  let csv = 'Gene ID,Gene Name,Organism,Mechanism,Containment (%),Shared K-mers,Gene K-mers,Length (bp)\n';
  
  for (const result of State.currentResults) {
    const containmentPercent = (result.containment_percent !== undefined)
      ? result.containment_percent
      : Math.round(result.containment * 100);
    
    csv += `"${result.gene_id}","${result.name}","${result.organism}","${result.mechanism}",${containmentPercent},${result.shared},${result.n_kmers},${result.length_bp}\n`;
  }
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'amr_results.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  logStatus('Results downloaded as CSV', 'info');
}

/**
 * Download results as JSON
 */
function downloadJson() {
  if (!State.currentResults || State.currentResults.length === 0) {
    alert('No results to download');
    return;
  }
  
  const data = {
    timestamp: new Date().toISOString(),
    analysisTime: State.analysisTime,
    fastaStats: State.fastaStats,
    results: State.currentResults,
    disclaimer: 'Genotype-only; phenotype prediction not supported. For clinical guidance, consult AMRFinderPlus, ResFinder, or CARD.',
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'amr_results.json');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  logStatus('Results downloaded as JSON', 'info');
}

/**
 * Reset all data and UI
 */
function handleReset() {
  State.fastaData = null;
  State.fastaSequences = null;
  State.fastaStats = null;
  State.currentResults = null;
  State.tableManager = null;
  
  UIElements.fastaInput.value = '';
  UIElements.fileName.textContent = 'No file selected';
  UIElements.fileSize.textContent = '';
  UIElements.kmerSize.value = '21';
  UIElements.threshold.value = '70'; // Default to 70%
  UIElements.statusBox.textContent = '';
  UIElements.statusLog.innerHTML = '';
  UIElements.resultsBody.innerHTML = '';
  UIElements.summarySection.style.display = 'none';
  UIElements.resultsSection.style.display = 'none';
  UIElements.qcSection.style.display = 'none';
  
  // Clear filter controls if present
  const filterControls = document.querySelector('.table-controls');
  if (filterControls) {
    filterControls.remove();
  }
  
  UIElements.analyzeBtn.disabled = false;
  UIElements.downloadCsvBtn.disabled = true;
  UIElements.downloadJsonBtn.disabled = true;
  
  logStatus('Application reset', 'info');
  setStatus('Ready. Load a FASTA file to begin.', 'success');
}

/**
 * Set main status message
 */
function setStatus(message, type = 'info') {
  if (!UIElements.statusBox) {
    console.warn('statusBox element not found');
    return;
  }
  UIElements.statusBox.textContent = message;
  UIElements.statusBox.className = `status-box status-${type}`;
}

/**
 * Log status message with timestamp
 */
function logStatus(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = `[${timestamp}] ${message}`;
  
  console.log(`[${type.toUpperCase()}] ${logEntry}`);
  
  if (!UIElements.statusLog) {
    console.warn('statusLog element not found');
    return;
  }
  
  const entry = document.createElement('div');
  entry.className = 'status-log-entry';
  entry.innerHTML = `<span class="status-log-time">[${timestamp}]</span> <span>${message}</span>`;
  UIElements.statusLog.appendChild(entry);
  UIElements.statusLog.scrollTop = UIElements.statusLog.scrollHeight;
}

// Initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', initApp);

