/**
 * Signature Pack Loader
 * Loads, decompresses, validates, and caches AMR gene signatures
 */

let cachedSignatures = null;
let cachedOrganisms = [];
let isLoading = false;

/**
 * Validate signature object structure (supports both formats)
 * @param {any} sig - Signature object to validate
 * @returns {boolean} - True if valid (either sequence or k-mer format)
 */
export function validateSignature(sig) {
  if (!sig || typeof sig !== 'object') return false;
  if (typeof sig.gene_id !== 'string') return false;
  if (typeof sig.length_bp !== 'number' || sig.length_bp <= 0) return false;
  
  // NEW FORMAT: sequence-based
  if (sig.sequence && typeof sig.sequence === 'string') {
    return sig.sequence.length > 0;
  }
  
  // OLD FORMAT: k-mer based
  if (sig.k && sig.n_kmers && Array.isArray(sig.kmers)) {
    if (typeof sig.k !== 'number' || sig.k < 1 || sig.k > 31) return false;
    if (typeof sig.n_kmers !== 'number' || sig.n_kmers < 0) return false;
    if (!sig.kmers.every(k => typeof k === 'string')) return false;
    if (sig.kmers.length !== sig.n_kmers) return false;
    return true;
  }
  
  return false;
}

/**
 * Validate entire signature pack
 * @param {any} data - Parsed JSON data
 * @returns {{valid: boolean, error: string|null}}
 */
export function validatePack(data) {
  if (!Array.isArray(data)) {
    return { valid: false, error: 'Signature pack must be an array' };
  }
  
  if (data.length === 0) {
    return { valid: false, error: 'Signature pack is empty' };
  }
  
  const invalidIndices = [];
  data.forEach((sig, idx) => {
    if (!validateSignature(sig)) {
      invalidIndices.push(idx);
    }
  });
  
  if (invalidIndices.length > 0) {
    return {
      valid: false,
      error: `Invalid signatures at indices: ${invalidIndices.slice(0, 5).join(', ')}${
        invalidIndices.length > 5 ? ` (+${invalidIndices.length - 5} more)` : ''
      } - missing gene_id, length_bp, k, n_kmers, or kmers array`
    };
  }
  
  return { valid: true, error: null };
}

/**
 * Extract unique organisms from signature pack
 * @param {Array} signatures - Array of signature objects
 * @returns {string[]} - Sorted array of unique organism names
 */
export function extractOrganisms(signatures) {
  const organisms = new Set();
  signatures.forEach(sig => {
    if (sig.organism) {
      organisms.add(sig.organism);
    }
  });
  return Array.from(organisms).sort();
}

/**
 * Load and decompress signature pack from gzipped JSON
 * NEW: Tries sequence-based database first, falls back to k-mer format
 * @param {string} url - URL to .gz file (default: /data/amr_signatures_sequences.json.gz)
 * @returns {Promise<Array>} - Array of validated signature objects
 * @throws {Error} - With descriptive message on failure
 */
export async function loadSignatures(url = '/data/amr_signatures_sequences.json.gz') {
  console.log(`[Signature Loader] Loading from ${url}`);
  
  // Check cache
  if (cachedSignatures) {
    console.log(`[Signature Loader] ✓ Using cached signatures (${cachedSignatures.length} genes)`);
    return cachedSignatures;
  }
  
  if (isLoading) {
    throw new Error('Signature pack load already in progress');
  }
  
  isLoading = true;
  
  try {
    // Try new sequence-based database first
    let data = null;
    let dbFormat = 'unknown';
    let dbSize = '?';
    
    // Attempt 1: New sequence-based database (1.2 MB gzipped)
    try {
      console.log(`[Signature Loader] Attempting to load sequence-based database...`);
      const response = await fetch(url);
      
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        dbSize = (buffer.byteLength / 1024 / 1024).toFixed(1);
        console.log(`[Signature Loader] Downloaded ${dbSize} MB (gzipped sequence-based)`);
        
        if (window.pako) {
          console.log(`[Signature Loader] ✓ Pako available - decompressing...`);
          const decompressed = window.pako.ungzip(new Uint8Array(buffer), { to: 'string' });
          data = JSON.parse(decompressed);
          dbFormat = 'sequence-based (NEW)';
        } else {
          throw new Error('Pako not available, trying uncompressed fallback');
        }
      } else if (response.status === 404) {
        console.log(`[Signature Loader] Sequence database not found (404), trying legacy database...`);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      console.log(`[Signature Loader] Sequence DB load failed: ${err.message}, trying legacy...`);
      data = null;
    }
    
    // Attempt 2: Legacy k-mer database (28 MB gzipped)
    if (!data) {
      try {
        console.log(`[Signature Loader] Attempting to load legacy k-mer database...`);
        const legacyUrl = '/data/amr_signatures.json.gz';
        const response = await fetch(legacyUrl);
        
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          dbSize = (buffer.byteLength / 1024 / 1024).toFixed(1);
          console.log(`[Signature Loader] Downloaded ${dbSize} MB (gzipped k-mer based)`);
          
          if (window.pako) {
            console.log(`[Signature Loader] ✓ Pako available - decompressing...`);
            const decompressed = window.pako.ungzip(new Uint8Array(buffer), { to: 'string' });
            data = JSON.parse(decompressed);
            dbFormat = 'k-mer based (LEGACY)';
          } else {
            throw new Error('Pako not available for legacy DB');
          }
        } else {
          throw new Error(`Legacy DB HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (err) {
        console.log(`[Signature Loader] Legacy DB load failed: ${err.message}, trying uncompressed...`);
        data = null;
      }
    }
    
    // Attempt 3: Uncompressed fallback (sequence-based JSON)
    if (!data) {
      console.warn('[Signature Loader] ⚠️  Pako library unavailable - falling back to uncompressed sequence JSON');
      const jsonUrl = '/data/amr_signatures_sequences.json';
      try {
        const response = await fetch(jsonUrl);
        
        if (response.ok) {
          console.log('[Signature Loader] Loading uncompressed JSON (12 MB - this will take 15-30 seconds)...');
          data = await response.json();
          dbFormat = 'sequence-based (UNCOMPRESSED FALLBACK)';
        } else {
          throw new Error(`Sequence DB uncompressed HTTP ${response.status}`);
        }
      } catch (err) {
        console.log(`[Signature Loader] Sequence uncompressed fallback failed: ${err.message}, trying legacy uncompressed...`);
        data = null;
      }
    }
    
    // Attempt 4: Legacy uncompressed fallback (277 MB - very slow)
    if (!data) {
      console.warn('[Signature Loader] ⚠️  All gzipped databases unavailable - falling back to legacy uncompressed JSON');
      const jsonUrl = '/data/amr_signatures.json';
      const response = await fetch(jsonUrl);
      
      if (!response.ok) {
        throw new Error(`Uncompressed DB HTTP ${response.status}: Could not load any database`);
      }
      
      console.log('[Signature Loader] ⚠️  Loading legacy uncompressed JSON (277 MB - this will take 30-60 seconds)...');
      data = await response.json();
      dbFormat = 'uncompressed (SLOW)';
      dbSize = '277';
    }
    
    // Validate pack
    console.log(`[Signature Loader] Validating ${dbFormat} signature pack...`);
    const validation = validatePack(data);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    // Cache and extract organisms
    cachedSignatures = data;
    cachedOrganisms = extractOrganisms(data);
    console.log(`[Signature Loader] ✓ Loaded ${data.length} signatures from ${cachedOrganisms.length} organism(s)`);
    console.log(`[Signature Loader] Organisms: ${cachedOrganisms.join(', ')}`);
    
    // Cache
    cachedSignatures = data;
    isLoading = false;
    
    return cachedSignatures;
    
  } catch (err) {
    isLoading = false;
    console.error(`[Signature Loader] ✗ Error: ${err.message}`);
    throw err;
  }
}

/**
 * Get loading state
 * @returns {boolean}
 */
export function isSignaturesLoading() {
  return isLoading;
}

/**
 * Get cached signatures
 * @returns {Array|null}
 */
export function getCachedSignatures() {
  return cachedSignatures;
}

/**
 * Get cached organisms
 * @returns {string[]}
 */
export function getCachedOrganisms() {
  return cachedOrganisms;
}

/**
 * Filter signatures by organism(s)
 * @param {string|string[]} organisms - Single organism or array of organisms
 * @returns {Array} - Filtered signatures
 * @throws {Error} - If signatures not loaded
 */
export function filterByOrganism(organisms) {
  if (!cachedSignatures) {
    throw new Error('Signatures not loaded. Call loadSignatures() first.');
  }
  
  const orgSet = new Set(Array.isArray(organisms) ? organisms : [organisms]);
  return cachedSignatures.filter(sig => orgSet.has(sig.organism));
}

/**
 * Search signatures by gene ID (substring match, case-insensitive)
 * @param {string} query - Search query
 * @returns {Array} - Matching signatures
 * @throws {Error} - If signatures not loaded
 */
export function searchByGeneId(query) {
  if (!cachedSignatures) {
    throw new Error('Signatures not loaded. Call loadSignatures() first.');
  }
  
  const q = query.toLowerCase();
  return cachedSignatures.filter(sig => sig.gene_id.toLowerCase().includes(q));
}

/**
 * Clear cache (for testing / reset)
 */
export function clearCache() {
  cachedSignatures = null;
  cachedOrganisms = [];
  isLoading = false;
  console.log('[Signature Loader] Cache cleared');
}

/**
 * Get summary stats of loaded signatures
 * @returns {object|null} - Summary stats or null if not loaded
 */
export function getSignatureSummary() {
  if (!cachedSignatures) return null;
  
  const totalKmers = cachedSignatures.reduce((sum, sig) => sum + sig.n_kmers, 0);
  const avgLength = cachedSignatures.reduce((sum, sig) => sum + sig.length_bp, 0) / cachedSignatures.length;
  const kSizes = new Set(cachedSignatures.map(sig => sig.k));
  
  return {
    geneCount: cachedSignatures.length,
    totalKmers,
    avgGeneLength: avgLength.toFixed(0),
    kSizes: Array.from(kSizes).sort((a, b) => a - b),
    organisms: cachedOrganisms
  };
}
