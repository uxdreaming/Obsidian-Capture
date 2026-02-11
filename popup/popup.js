// Obsidian Web Clipper - Popup

document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab.url || '';

  // Check if vault is configured
  const hasVault = await checkVaultConfigured();

  if (hasVault) {
    showMainView(tab, url);
  } else {
    showSetupView();
  }
});

function showSetupView() {
  document.getElementById('setupView').style.display = 'block';
  document.getElementById('mainView').style.display = 'none';

  document.getElementById('selectVaultBtn').addEventListener('click', async () => {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await storeDirectoryHandle(dirHandle);

      // Refresh to show main view
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      showMainView(tab, tab.url || '');
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error selecting folder:', err);
      }
    }
  });
}

function showMainView(tab, url) {
  document.getElementById('setupView').style.display = 'none';
  document.getElementById('mainView').style.display = 'block';

  // Detect page type and show hint
  const pageTypeEl = document.getElementById('pageType');
  let pageType = 'article';

  if (url.includes('youtube.com/watch')) {
    pageType = 'youtube';
    pageTypeEl.textContent = 'YouTube video detected';
  } else if (url.includes('spotify.com')) {
    pageType = 'spotify';
    pageTypeEl.textContent = 'Spotify detected';
  } else if (url.includes('twitter.com') || url.includes('x.com')) {
    pageType = 'twitter';
    pageTypeEl.textContent = 'Twitter/X detected';
  } else {
    pageTypeEl.textContent = '';
  }

  // Capture button
  document.getElementById('captureBtn').addEventListener('click', async () => {
    const captureBtn = document.getElementById('captureBtn');
    captureBtn.textContent = 'Capturing...';
    captureBtn.disabled = true;

    try {
      const result = await injectAndExtract(tab.id, 'autoCapture', pageType);
      if (result && result.content) {
        await saveToVault(result.filename, result.content);
      }
    } catch (err) {
      console.error('Capture error:', err);
    }
    window.close();
  });

  // Edit button
  document.getElementById('editBtn').addEventListener('click', async () => {
    await injectAndStart(tab.id, 'editSelection');
    window.close();
  });
}

async function injectAndStart(tabId, action, pageType = null) {
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ['content/content.css']
  });

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/content.js']
  });

  await new Promise(r => setTimeout(r, 100));
  await chrome.tabs.sendMessage(tabId, { action, pageType });
}

async function injectAndExtract(tabId, action, pageType = null) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/content.js']
  });

  await new Promise(r => setTimeout(r, 100));
  return await chrome.tabs.sendMessage(tabId, { action, pageType, returnContent: true });
}

async function saveToVault(filename, content) {
  try {
    const dirHandle = await getStoredDirectoryHandle();
    if (!dirHandle) {
      alert('Vault folder not configured');
      return false;
    }

    // Verify permission
    let permission = await dirHandle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      permission = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        alert('Permission denied to write files');
        return false;
      }
    }

    // Create the file directly in vault root
    const safeFilename = `${filename}.md`;
    const fileHandle = await dirHandle.getFileHandle(safeFilename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    return true;
  } catch (err) {
    console.error('Save error:', err);
    alert('Error saving file: ' + err.message);
    return false;
  }
}

async function getStoredDirectoryHandle() {
  try {
    const db = await openDB();
    const tx = db.transaction('handles', 'readonly');
    const store = tx.objectStore('handles');
    const request = store.get('vaultDir');
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// IndexedDB functions
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ObsidianClipperDB', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('handles')) {
        db.createObjectStore('handles');
      }
    };
  });
}

async function checkVaultConfigured() {
  try {
    const db = await openDB();
    const tx = db.transaction('handles', 'readonly');
    const store = tx.objectStore('handles');
    const request = store.get('vaultDir');
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

async function storeDirectoryHandle(handle) {
  const db = await openDB();
  const tx = db.transaction('handles', 'readwrite');
  const store = tx.objectStore('handles');
  store.put(handle, 'vaultDir');
}
