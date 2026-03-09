// Obsidian Web Clipper - Background Service Worker

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Obsidian Web Clipper installed');
  } else if (details.reason === 'update') {
    console.log('Obsidian Web Clipper updated');
  }
});

// Handle saveToVault from content script (Edit Selection mode)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'saveToVault') {
    handleSaveToVault(message.filename, message.content, sender.tab?.id)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async
  }
});

async function handleSaveToVault(filename, content, tabId) {
  try {
    const dirHandle = await getStoredDirectoryHandle();
    if (!dirHandle) {
      // No vault configured - open popup to configure
      await openSavePopup(filename, content);
      return;
    }

    const permission = await dirHandle.queryPermission({ mode: 'readwrite' });
    if (permission === 'granted') {
      await writeFile(dirHandle, filename, content);
    } else {
      // Permission not granted without user gesture - open popup to handle
      await openSavePopup(filename, content);
    }
  } catch (err) {
    console.error('Service worker save error:', err);
    // Fallback: open popup
    await openSavePopup(filename, content);
  }
}

async function writeFile(dirHandle, filename, content) {
  const safeFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
  const fileHandle = await dirHandle.getFileHandle(safeFilename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

async function openSavePopup(filename, content) {
  // Store pending save in chrome.storage.session so the popup can pick it up
  await chrome.storage.session.set({ pendingSave: { filename, content } });
  // Open the popup (extension action popup)
  await chrome.action.openPopup();
}

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
