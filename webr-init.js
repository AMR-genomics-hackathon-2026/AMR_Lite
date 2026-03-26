/**
 * WebR Initialization Module
 * Imports WebR from CDN, initializes it, runs smoke test, and logs progress
 */

let webRInstance = null;
let webRReady = false;
let webRError = null;

/**
 * Log status message with timestamp to UI and console
 * @param {string} message - Message to log
 * @param {string} type - Type: 'info' | 'success' | 'warning' | 'error'
 */
function logWebRStatus(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = `[${timestamp}] ${message}`;
  
  console.log(`[WebR ${type.toUpperCase()}] ${logEntry}`);
  
  // Also log to status element if available
  const statusLog = document.getElementById('statusLog');
  if (statusLog) {
    const entry = document.createElement('div');
    entry.className = 'status-log-entry';
    entry.innerHTML = `<span class="status-log-time">[${timestamp}]</span> <span style="color: ${getColorForType(type)};">WebR: ${message}</span>`;
    statusLog.appendChild(entry);
    statusLog.scrollTop = statusLog.scrollHeight;
  }
}

/**
 * Get color for log entry type
 */
function getColorForType(type) {
  const colors = {
    info: '#0066cc',
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545',
  };
  return colors[type] || '#212529';
}

/**
 * Initialize WebR from CDN
 */
export async function initializeWebR() {
  logWebRStatus('Starting WebR initialization...', 'info');
  
  try {
    // Dynamically import WebR from CDN
    logWebRStatus('Loading WebR from CDN...', 'info');
    const { WebR } = await import('https://webr.r-wasm.org/latest/webr.mjs');
    
    logWebRStatus('Instantiating WebR engine...', 'info');
    webRInstance = new WebR();
    
    logWebRStatus('Initializing WebR (this may take 10-30 seconds on first load)...', 'info');
    await webRInstance.init();
    
    logWebRStatus('WebR initialized successfully', 'success');
    webRReady = true;
    
    // Run smoke test
    await runWebRSmokeTest();
    
    return webRInstance;
  } catch (err) {
    const errorMsg = `WebR initialization failed: ${err.message}`;
    logWebRStatus(errorMsg, 'error');
    webRError = err;
    webRReady = false;
    
    // Disable Analyse button
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) {
      analyzeBtn.disabled = true;
      analyzeBtn.title = 'WebR initialization failed. Please refresh the page.';
    }
    
    // Show error in status box
    const statusBox = document.getElementById('statusBox');
    if (statusBox) {
      statusBox.textContent = `⚠️ WebR Error: ${err.message}`;
      statusBox.className = 'status-box status-error';
    }
    
    throw err;
  }
}

/**
 * Run WebR smoke test
 */
async function runWebRSmokeTest() {
  try {
    logWebRStatus('Running WebR smoke test...', 'info');
    
    // Evaluate R code: generate 100 random normal values and get summary
    const result = await webRInstance.evalR('summary(stats::rnorm(100))');
    const output = await result.toString();
    
    logWebRStatus(`Smoke test passed. Output: ${output.substring(0, 50)}...`, 'success');
    console.log('WebR Smoke Test Output:');
    console.log(output);
    
    return output;
  } catch (err) {
    logWebRStatus(`Smoke test failed: ${err.message}`, 'warning');
    console.error('WebR Smoke Test Error:', err);
    // Don't throw; smoke test failure is not critical
  }
}

/**
 * Get WebR instance (checks if ready)
 */
export function getWebR() {
  if (!webRReady) {
    throw new Error('WebR is not initialized. Wait for initialization to complete.');
  }
  return webRInstance;
}

/**
 * Check if WebR is ready
 */
export function isWebRReady() {
  return webRReady;
}

/**
 * Get WebR error if initialization failed
 */
export function getWebRError() {
  return webRError;
}

/**
 * Export status logging function for app.js
 */
export { logWebRStatus };
