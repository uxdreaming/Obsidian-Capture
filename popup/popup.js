// Obsidian Web Clipper - Popup

document.addEventListener('DOMContentLoaded', async () => {
  // Check for pending save from Edit Selection mode
  const { pendingSave } = await chrome.storage.session.get('pendingSave');
  if (pendingSave) {
    await chrome.storage.session.remove('pendingSave');
    const saved = await saveToVault(pendingSave.filename, pendingSave.content);
    if (saved) {
      document.body.innerHTML = '<div style="padding:16px;font-family:system-ui;font-size:14px;color:#4caf50">✓ Saved to vault</div>';
      setTimeout(() => window.close(), 1200);
      return;
    }
  }

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

  const siteMap = [
    { match: ['youtube.com/watch'],                  type: 'youtube',  label: 'YouTube video' },
    { match: ['spotify.com'],                        type: 'spotify',  label: 'Spotify' },
    { match: ['twitter.com', 'x.com'],               type: 'twitter',  label: 'Twitter / X' },
    { match: ['linkedin.com/in/', 'linkedin.com/posts/', 'linkedin.com/pulse/',
               'linkedin.com/feed/', 'linkedin.com/jobs/', 'linkedin.com/company/'],
                                                     type: 'linkedin', label: 'LinkedIn' },
    { match: ['github.com'],                         type: 'github',   label: 'GitHub' },
    { match: ['behance.net'],                        type: 'behance',  label: 'Behance' },
    { match: ['facebook.com'],                       type: 'facebook', label: 'Facebook' },
    { match: ['medium.com', '.medium.com'],          type: 'medium',   label: 'Medium' },
    { match: ['dribbble.com'],                       type: 'dribbble', label: 'Dribbble' },
  ];

  for (const site of siteMap) {
    if (site.match.some(m => url.includes(m))) {
      pageType = site.type;
      pageTypeEl.textContent = `${site.label} detected`;
      break;
    }
  }
  if (pageType === 'article') pageTypeEl.textContent = '';

  // Capture button
  document.getElementById('captureBtn').addEventListener('click', async () => {
    const captureBtn = document.getElementById('captureBtn');
    captureBtn.disabled = true;

    try {
      let result;
      if (pageType === 'youtube') {
        captureBtn.textContent = 'Extracting...';
        const raw = await injectAndExtract(tab.id, 'autoCapture', 'youtube');
        if (raw?.isYouTube) {
          captureBtn.textContent = 'Summarizing...';
          result = await captureYouTube(raw);
        }
      } else {
        captureBtn.textContent = 'Capturing...';
        result = await injectAndExtract(tab.id, 'autoCapture', pageType);
      }

      if (result?.content) {
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
    files: ['lib/turndown.min.js', 'content/content.js']
  });

  await new Promise(r => setTimeout(r, 100));
  await chrome.tabs.sendMessage(tabId, { action, pageType });
}

async function injectAndExtract(tabId, action, pageType = null) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['lib/turndown.min.js', 'content/content.js']
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

// ── YouTube capture ───────────────────────────────────────────────────────────

async function captureYouTube(data) {
  // Intentar sync primero, luego local (por si el usuario no tiene Chrome sync activo)
  let { groqApiKey } = await chrome.storage.sync.get('groqApiKey');
  if (!groqApiKey) {
    const local = await chrome.storage.local.get('groqApiKey');
    groqApiKey = local.groqApiKey;
  }

  console.log('[OC] groqApiKey present:', !!groqApiKey);
  console.log('[OC] transcript length:', data.transcript?.length ?? 'null');
  console.log('[OC] description length:', data.description?.length ?? 'empty');

  let summary = null;
  if (groqApiKey) {
    const input = data.transcript || data.description;
    console.log('[OC] input for summary:', input ? `${input.length} chars` : 'EMPTY — skipping');
    if (input) summary = await getGroqSummary(input, data.title, groqApiKey);
  } else {
    console.warn('[OC] No Groq API key found — skipping summary');
  }

  return { filename: data.filename, content: buildYouTubeNote(data, summary) };
}

async function getGroqSummary(text, title, apiKey) {
  console.log('[OC] Calling Groq, input length:', text?.length);
  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: `You are a knowledge extraction assistant for a personal knowledge base (Obsidian PKM).
Given a YouTube video title and its content, extract structured knowledge in this exact markdown format:

## 💡 De qué trata
One or two sentences describing the core topic.

## 🔑 Conceptos clave
- concept 1
- concept 2
- concept 3

## 🔗 Conecta con
- [[Topic or idea this video relates to]]
- [[Another connected concept]]
- [[A field, discipline or tool mentioned]]

## ✨ Takeaways
- Specific actionable or memorable insight
- Another insight

Rules:
- Write in the same language as the video content
- For "Conecta con", use [[double brackets]] exactly — these become Obsidian links
- Be specific and knowledge-focused, not generic
- No extra headers or explanations outside this structure`,
          },
          {
            role: 'user',
            content: `Title: "${title}"\n\nContent:\n${text.substring(0, 6000)}`,
          },
        ],
      }),
    });
    const json = await resp.json();
    const result = json.choices?.[0]?.message?.content?.trim() || null;
    console.log('[OC] Groq result:', result ? 'OK' : 'empty/failed', json.error || '');
    return result;
  } catch (err) {
    console.error('[OC] Groq error:', err);
    return null;
  }
}

function buildYouTubeNote(data, summary) {
  const date = new Date().toISOString().split('T')[0];

  const channelLink = data.channelUrl
    ? `[${data.channel}](${data.channelUrl})`
    : data.channel || '';

  let content = `#Capture\n\n`;
  content += `---\n`;
  content += `title: "${data.title.replace(/"/g, '\\"')}"\n`;
  content += `source: ${data.url}\n`;
  content += `date: ${date}\n`;
  content += `type: youtube\n`;
  content += `tags: [youtube, video]\n`;
  content += `---\n\n`;

  content += `# ${data.title}\n\n`;

  if (data.thumbnail) content += `![thumbnail](${data.thumbnail})\n\n`;

  const header = [
    channelLink && `📺 ${channelLink}`,
    `[▶ Watch on YouTube](${data.url})`,
  ].filter(Boolean).join('  ·  ');
  content += `${header}\n\n---\n\n`;

  if (summary) {
    content += `${summary}\n\n---\n\n`;
  } else {
    content += `> ⚠️ AI summary not available — check Groq API key in extension settings.\n\n---\n\n`;
  }

  if (data.description) {
    content += `## 📝 Description\n\n${data.description}\n\n---\n\n`;
  }

  content += `## Notes\n`;
  return content;
}

async function storeDirectoryHandle(handle) {
  const db = await openDB();
  const tx = db.transaction('handles', 'readwrite');
  const store = tx.objectStore('handles');
  store.put(handle, 'vaultDir');
}
