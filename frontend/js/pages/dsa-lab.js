import { CONFIG } from '../config.js';
import { showToast } from '../ui.js';

// =============================================================================
// REAL DSA IMPLEMENTATIONS FOR IN-BROWSER INTERACTIVE LAB
// =============================================================================

/**
 * Genuine FIFO Queue with Head-Index Offset
 */
class LabQueue {
  constructor() {
    this.items = [];
    this.head = 0;
  }

  enqueue(item) {
    this.items.push(item);
  }

  dequeue() {
    if (this.isEmpty()) return null;
    const item = this.items[this.head];
    this.head++;
    // Garbage collection compaction if half the array is dead space
    if (this.head > 16 && this.head >= this.items.length / 2) {
      this.items = this.items.slice(this.head);
      this.head = 0;
    }
    return item;
  }

  peek() {
    if (this.isEmpty()) return null;
    return this.items[this.head];
  }

  isEmpty() {
    return this.size() === 0;
  }

  size() {
    return this.items.length - this.head;
  }

  getElements() {
    return this.items.slice(this.head);
  }

  clear() {
    this.items = [];
    this.head = 0;
  }
}

/**
 * Genuine Hash Table with Separate Chaining
 */
class LabHashTable {
  constructor(size = 8) {
    this.size = size;
    this.buckets = Array.from({ length: size }, () => []);
  }

  hash(key) {
    let hash = 0;
    const PRIME = 31;
    for (let i = 0; i < key.length; i++) {
      hash = (hash * PRIME + key.charCodeAt(i)) >>> 0;
    }
    return hash % this.size;
  }

  set(key, value) {
    const idx = this.hash(key);
    const bucket = this.buckets[idx];
    const existing = bucket.find(node => node.key === key);
    if (existing) {
      existing.value = value;
    } else {
      bucket.push({ key, value });
    }
    return idx;
  }

  get(key) {
    const idx = this.hash(key);
    const bucket = this.buckets[idx];
    const node = bucket.find(n => n.key === key);
    return { node: node || null, bucketIndex: idx };
  }

  delete(key) {
    const idx = this.hash(key);
    const bucket = this.buckets[idx];
    const itemIdx = bucket.findIndex(n => n.key === key);
    if (itemIdx !== -1) {
      bucket.splice(itemIdx, 1);
      return { success: true, bucketIndex: idx };
    }
    return { success: false, bucketIndex: idx };
  }
}

// Global Lab Instances
const queue = new LabQueue();
const hashTable = new LabHashTable(8);
let sortArray = [48, 12, 85, 34, 19, 62, 27, 51];
let isSorting = false;

document.addEventListener('DOMContentLoaded', () => {
  setupNav();
  setupTabs();
  initQueueLab();
  initHashTableLab();
  initMergeSortLab();
});

// =============================================================================
// TAB NAVIGATION
// =============================================================================
function setupTabs() {
  const tabs = document.querySelectorAll('.lab-tab-btn');
  const sections = {
    queue: document.getElementById('queueLab'),
    hashtable: document.getElementById('hashTableLab'),
    mergesort: document.getElementById('mergeSortLab')
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const target = tab.dataset.tab;
      Object.keys(sections).forEach(key => {
        if (sections[key]) {
          sections[key].style.display = (key === target) ? 'block' : 'none';
        }
      });
      logAudit(`Switched active visualizer workbench to: ${target.toUpperCase()}`);
    });
  });
}

// =============================================================================
// 1. QUEUE LAB
// =============================================================================
function initQueueLab() {
  const stage = document.getElementById('queueStage');
  const input = document.getElementById('queueInputName');
  const enqueueBtn = document.getElementById('enqueueBtn');
  const dequeueBtn = document.getElementById('dequeueBtn');
  const peekBtn = document.getElementById('peekQueueBtn');
  const clearBtn = document.getElementById('clearQueueBtn');

  // Seed with 3 sample students
  ['Priya Sharma', 'Alex Mercer', 'Devin Vance'].forEach(name => queue.enqueue(name));
  renderQueue();

  enqueueBtn?.addEventListener('click', () => {
    const name = (input.value || '').trim();
    if (!name) {
      showToast('Please type a student name to enqueue.', 'info');
      return;
    }
    queue.enqueue(name);
    input.value = '';
    renderQueue();
    logAudit(`[QUEUE] Enqueue('${name}') -> Tail of queue. Size: ${queue.size()}, O(1)`);
    showToast(`Enqueued '${name}' at tail of waiting list.`, 'success');
  });

  dequeueBtn?.addEventListener('click', () => {
    if (queue.isEmpty()) {
      showToast('Queue is already empty.', 'info');
      return;
    }
    const dequeued = queue.dequeue();
    renderQueue();
    logAudit(`[QUEUE] Dequeue() -> Promoted '${dequeued}' to Confirmed Seat! Size: ${queue.size()}, O(1)`);
    showToast(`🚀 Dequeued & Promoted: ${dequeued}`, 'info');
  });

  peekBtn?.addEventListener('click', () => {
    if (queue.isEmpty()) {
      showToast('Queue is empty. No head element.', 'info');
      return;
    }
    const head = queue.peek();
    logAudit(`[QUEUE] Peek() -> Head candidate is '${head}'. O(1)`);
    showToast(`Head of queue (Position #1): ${head}`, 'info');
    
    // Highlight head element
    const firstNode = stage?.querySelector('.queue-node');
    if (firstNode) {
      firstNode.style.transform = 'scale(1.1)';
      firstNode.style.boxShadow = '0 0 15px var(--color-green)';
      setTimeout(() => {
        firstNode.style.transform = '';
        firstNode.style.boxShadow = '';
      }, 700);
    }
  });

  clearBtn?.addEventListener('click', () => {
    queue.clear();
    renderQueue();
    logAudit('[QUEUE] Reset queue. Size: 0');
  });
}

function renderQueue() {
  const stage = document.getElementById('queueStage');
  const lenEl = document.getElementById('queueLengthDisplay');
  const headEl = document.getElementById('queueHeadDisplay');

  if (lenEl) lenEl.textContent = queue.size();
  if (headEl) headEl.textContent = queue.head;

  if (!stage) return;

  const elements = queue.getElements();

  if (elements.length === 0) {
    stage.innerHTML = `
      <div style="color: var(--color-ink-muted); font-size: var(--text-sm); margin: auto;">
        Queue is currently empty. Enqueue student applicants above!
      </div>
    `;
    return;
  }

  stage.innerHTML = elements.map((item, idx) => {
    const isHead = idx === 0;
    return `
      <div class="queue-node ${isHead ? 'head-node' : ''}">
        ${isHead ? `<div class="queue-pointer">👉 HEAD (Next Out)</div>` : ''}
        ${idx === elements.length - 1 ? `<div style="position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%); font-size: 10px; font-weight: 800; color: var(--color-ink-muted);">TAIL 👈</div>` : ''}
        <div style="font-size: var(--text-xs); font-family: var(--font-mono); color: var(--color-ink-muted); margin-bottom: 0.25rem;">
          Rank #${idx + 1}
        </div>
        <div style="font-weight: 800; font-size: var(--text-sm); color: var(--color-ink);">
          ${escapeHtml(item)}
        </div>
      </div>
    `;
  }).join('');
}

// =============================================================================
// 2. HASH TABLE LAB
// =============================================================================
function initHashTableLab() {
  const keyInput = document.getElementById('hashKeyInput');
  const valInput = document.getElementById('hashValInput');
  const setBtn = document.getElementById('hashSetBtn');
  const getBtn = document.getElementById('hashGetBtn');
  const delBtn = document.getElementById('hashDeleteBtn');
  const demoCollisionBtn = document.getElementById('hashDemoCollisionBtn');
  const mathDisplay = document.getElementById('hashMathDisplay');

  // Pre-seed some keys
  hashTable.set('hackathon_26:usr_101', 'CONFIRMED');
  hashTable.set('hackathon_26:usr_202', 'WAITLISTED');
  hashTable.set('ai_summit:usr_101', 'CONFIRMED');
  renderBuckets();

  keyInput?.addEventListener('input', (e) => {
    const k = e.target.value.trim();
    if (!k) {
      mathDisplay.textContent = 'Type a key to observe real-time polynomial rolling hash computation: hash = Σ charCode × 31^i (mod 8)';
      return;
    }
    const idx = hashTable.hash(k);
    mathDisplay.innerHTML = `Key: <code>"${k}"</code> &rarr; Polynomial Hash Modulo 8 &rarr; <strong>Bucket Index [${idx}]</strong>`;
  });

  setBtn?.addEventListener('click', () => {
    const key = (keyInput.value || '').trim();
    const val = (valInput.value || 'CONFIRMED').trim();
    if (!key) {
      showToast('Please specify a key.', 'info');
      return;
    }
    const bucketIdx = hashTable.set(key, val);
    renderBuckets();
    highlightBucket(bucketIdx);
    logAudit(`[HASH] Set("${key}", "${val}") mapped to Bucket [${bucketIdx}] via polynomial hash. O(1)`);
    showToast(`Stored in Bucket [${bucketIdx}]!`, 'success');
  });

  getBtn?.addEventListener('click', () => {
    const key = (keyInput.value || '').trim();
    if (!key) {
      showToast('Please specify a key to search.', 'info');
      return;
    }
    const { node, bucketIndex } = hashTable.get(key);
    highlightBucket(bucketIndex);
    if (node) {
      logAudit(`[HASH] Get("${key}") -> Found: "${node.value}" in Bucket [${bucketIndex}]. O(1)`);
      showToast(`Key found in Bucket [${bucketIndex}]: ${node.value}`, 'success');
    } else {
      logAudit(`[HASH] Get("${key}") -> Key not found in Bucket [${bucketIndex}]. O(1)`);
      showToast(`Key not found in table.`, 'info');
    }
  });

  delBtn?.addEventListener('click', () => {
    const key = (keyInput.value || '').trim();
    if (!key) {
      showToast('Please specify a key to delete.', 'info');
      return;
    }
    const res = hashTable.delete(key);
    renderBuckets();
    if (res.success) {
      highlightBucket(res.bucketIndex);
      logAudit(`[HASH] Delete("${key}") -> Removed from chain in Bucket [${res.bucketIndex}]. O(1)`);
      showToast(`Deleted "${key}" from Bucket [${res.bucketIndex}].`, 'info');
    } else {
      showToast(`Key does not exist in table.`, 'error');
    }
  });

  demoCollisionBtn?.addEventListener('click', () => {
    // Generate intentional collision: find two keys that produce the same index
    const targetIdx = 3;
    let found = [];
    let counter = 1;
    while (found.length < 2) {
      const candidate = `team_${counter}`;
      if (hashTable.hash(candidate) === targetIdx) {
        found.push(candidate);
      }
      counter++;
    }

    hashTable.set(found[0], 'Role: Lead Hacker');
    hashTable.set(found[1], 'Role: System Architect');
    renderBuckets();
    highlightBucket(targetIdx);
    logAudit(`[HASH COLLISION] Two distinct keys "${found[0]}" & "${found[1]}" mapped to the SAME Bucket [${targetIdx}]! Handled via Separate Chaining.`);
    showToast(`⚡ Intentional collision demonstrated in Bucket [${targetIdx}]!`, 'info');
  });
}

function renderBuckets() {
  const grid = document.getElementById('bucketGrid');
  if (!grid) return;

  grid.innerHTML = hashTable.buckets.map((bucket, idx) => {
    const isCollided = bucket.length > 1;
    return `
      <div class="bucket-card" id="bucket-${idx}" style="${isCollided ? 'border-color: var(--color-coral);' : ''}">
        <div class="bucket-header">
          <span>BUCKET [${idx}]</span>
          <span>${bucket.length} ${bucket.length === 1 ? 'node' : 'nodes'} ${isCollided ? '⚡ COLLISION' : ''}</span>
        </div>
        ${bucket.length === 0 ? `
          <div style="color: var(--color-ink-muted); font-size: var(--text-xs); font-style: italic;">(empty)</div>
        ` : bucket.map(item => `
          <div class="chain-node">
            <div style="font-weight: 700; color: var(--color-ink);">${escapeHtml(item.key)}</div>
            <div style="color: var(--color-ink-muted);">${escapeHtml(item.value)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
}

function highlightBucket(idx) {
  const card = document.getElementById(`bucket-${idx}`);
  if (card) {
    card.style.transform = 'scale(1.04)';
    card.style.boxShadow = '0 0 15px var(--color-purple)';
    setTimeout(() => {
      card.style.transform = '';
      card.style.boxShadow = '';
    }, 800);
  }
}

// =============================================================================
// 3. MERGE SORT LAB
// =============================================================================
function initMergeSortLab() {
  const container = document.getElementById('barsContainer');
  const genBtn = document.getElementById('generateRandomArrayBtn');
  const startBtn = document.getElementById('startMergeSortBtn');
  const resetBtn = document.getElementById('resetSortBtn');
  const speedInput = document.getElementById('speedRange');

  renderSortBars();

  genBtn?.addEventListener('click', () => {
    if (isSorting) return;
    sortArray = Array.from({ length: 8 }, () => Math.floor(Math.random() * 85) + 10);
    renderSortBars();
    document.getElementById('sortStepStatus').textContent = 'Generated new random numbers. Ready to sort!';
    logAudit(`[SORT] Generated new random numbers: [${sortArray.join(', ')}]`);
  });

  resetBtn?.addEventListener('click', () => {
    if (isSorting) return;
    sortArray = [48, 12, 85, 34, 19, 62, 27, 51];
    renderSortBars();
    document.getElementById('sortStepStatus').textContent = 'Array reset to initial state.';
  });

  startBtn?.addEventListener('click', async () => {
    if (isSorting) return;
    isSorting = true;
    startBtn.disabled = true;
    genBtn.disabled = true;
    resetBtn.disabled = true;

    logAudit(`[SORT] Beginning Step-by-Step Merge Sort O(n log n) on: [${sortArray.join(', ')}]`);
    await runMergeSortAnimation();

    isSorting = false;
    startBtn.disabled = false;
    genBtn.disabled = false;
    resetBtn.disabled = false;
  });
}

function renderSortBars(highlightIndices = [], mergedIndices = []) {
  const container = document.getElementById('barsContainer');
  if (!container) return;

  const maxVal = Math.max(...sortArray, 100);

  container.innerHTML = sortArray.map((val, idx) => {
    const isComparing = highlightIndices.includes(idx);
    const isMerged = mergedIndices.includes(idx);
    const heightPct = Math.round((val / maxVal) * 190);

    return `
      <div class="sort-bar ${isComparing ? 'comparing' : ''} ${isMerged ? 'merged' : ''}" style="height: ${heightPct}px;">
        ${val}
      </div>
    `;
  }).join('');
}

async function runMergeSortAnimation() {
  const statusEl = document.getElementById('sortStepStatus');
  const speed = () => 1100 - parseInt(document.getElementById('speedRange')?.value || 500, 10);

  async function merge(arr, start, mid, end) {
    const left = arr.slice(start, mid + 1);
    const right = arr.slice(mid + 1, end + 1);
    let i = 0, j = 0, k = start;

    statusEl.textContent = `Merging sub-arrays: [${left.join(', ')}] and [${right.join(', ')}]`;
    renderSortBars([start, end]);
    await new Promise(r => setTimeout(r, speed()));

    while (i < left.length && j < right.length) {
      statusEl.textContent = `Comparing left[${left[i]}] <= right[${right[j]}]`;
      renderSortBars([k]);
      await new Promise(r => setTimeout(r, speed()));

      if (left[i] <= right[j]) {
        arr[k] = left[i];
        i++;
      } else {
        arr[k] = right[j];
        j++;
      }
      k++;
      renderSortBars([], Array.from({ length: k - start }, (_, idx) => start + idx));
      await new Promise(r => setTimeout(r, speed()));
    }

    while (i < left.length) {
      arr[k] = left[i];
      i++;
      k++;
      renderSortBars([], Array.from({ length: k - start }, (_, idx) => start + idx));
      await new Promise(r => setTimeout(r, speed()));
    }

    while (j < right.length) {
      arr[k] = right[j];
      j++;
      k++;
      renderSortBars([], Array.from({ length: k - start }, (_, idx) => start + idx));
      await new Promise(r => setTimeout(r, speed()));
    }
  }

  async function mergeSortHelper(arr, start, end) {
    if (start >= end) return;
    const mid = Math.floor((start + end) / 2);

    statusEl.textContent = `Divide: Splitting array range [${start}..${end}] at index ${mid}`;
    renderSortBars([start, mid, end]);
    await new Promise(r => setTimeout(r, speed()));

    await mergeSortHelper(arr, start, mid);
    await mergeSortHelper(arr, mid + 1, end);
    await merge(arr, start, mid, end);
  }

  await mergeSortHelper(sortArray, 0, sortArray.length - 1);
  renderSortBars([], sortArray.map((_, i) => i));
  statusEl.textContent = `✅ Merge Sort Complete! Verified stable O(n log n) sorting. Final: [${sortArray.join(', ')}]`;
  logAudit(`[SORT] Completed Merge Sort! Final sorted array: [${sortArray.join(', ')}]`);
  showToast('Merge Sort completed successfully!', 'success');
}

// =============================================================================
// AUDIT STREAM & UTILS
// =============================================================================
function logAudit(msg) {
  const stream = document.getElementById('terminalLogs');
  if (!stream) return;

  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];
  const p = document.createElement('div');
  p.style.margin = '0.2rem 0';
  p.textContent = `[${timeStr}] ${msg}`;
  stream.appendChild(p);
  stream.scrollTop = stream.scrollHeight;
}

function setupNav() {
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mainNav = document.getElementById('mainNav');
  if (mobileMenuBtn && mainNav) {
    mobileMenuBtn.addEventListener('click', () => mainNav.classList.toggle('nav-open'));
  }

  const token = localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
  const profileRaw = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_PROFILE);
  if (token && profileRaw) {
    try {
      const profile = JSON.parse(profileRaw);
      document.getElementById('navLoginBtn')?.remove();
      document.getElementById('navSignupBtn')?.remove();
      
      const badge = document.getElementById('navUserBadge');
      if (badge) {
        badge.style.display = 'inline-flex';
        document.getElementById('navUserName').textContent = profile.full_name || 'Student';
        document.getElementById('navUserAvatar').textContent = (profile.full_name || 'S')[0].toUpperCase();
      }

      const dashLink = document.getElementById('navDashboardLink');
      if (dashLink) dashLink.style.display = 'inline-block';

      if (profile.role === 'admin') {
        const adminLink = document.getElementById('navAdminLink');
        if (adminLink) adminLink.style.display = 'inline-block';
      }

      document.getElementById('navLogoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_PROFILE);
        showToast('Logged out.', 'info');
        setTimeout(() => window.location.reload(), 300);
      });
    } catch {}
  }
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
