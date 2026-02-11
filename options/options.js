// Obsidian Web Clipper - Options Page

document.addEventListener('DOMContentLoaded', async () => {
  // Change vault folder
  document.getElementById('resetVault').addEventListener('click', async () => {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await storeDirectoryHandle(dirHandle);

      const btn = document.getElementById('resetVault');
      btn.textContent = 'Vault changed!';
      setTimeout(() => {
        btn.textContent = 'Change Vault Folder';
      }, 1500);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error selecting folder:', err);
      }
    }
  });
});

async function storeDirectoryHandle(handle) {
  const db = await openDB();
  const tx = db.transaction('handles', 'readwrite');
  const store = tx.objectStore('handles');
  store.put(handle, 'vaultDir');
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
