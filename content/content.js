// Obsidian Web Clipper - Content Script

// Prevent multiple injections
if (typeof window.obsidianClipperLoaded === 'undefined') {
window.obsidianClipperLoaded = true;

// ============================================
// PAGE EXTRACTORS
// ============================================

// YouTube extractor
function extractYouTube() {
  const title = document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string, h1.ytd-watch-metadata yt-formatted-string, #title h1')?.textContent?.trim()
    || document.title.replace(' - YouTube', '').trim();

  const channel = document.querySelector('#channel-name yt-formatted-string a, ytd-channel-name yt-formatted-string a, #owner-name a')?.textContent?.trim() || '';

  const descriptionEl = document.querySelector('#description-inline-expander yt-formatted-string, ytd-text-inline-expander yt-formatted-string, #description yt-formatted-string');
  const description = descriptionEl?.textContent?.trim() || '';

  const url = window.location.href;

  let content = `**Channel:** ${channel}\n\n`;
  content += `**URL:** ${url}\n\n`;
  if (description) {
    content += `## Description\n\n${description}`;
  }

  return { title, content };
}

// Twitter/X extractor
function extractTwitter() {
  const tweetText = document.querySelector('[data-testid="tweetText"]')?.textContent?.trim() || '';
  const author = document.querySelector('[data-testid="User-Name"] span')?.textContent?.trim() || '';
  const url = window.location.href;

  const title = `Tweet by ${author}`;
  const content = `> ${tweetText}\n\n— ${author}\n\n**URL:** ${url}`;

  return { title, content };
}

// Spotify extractor
function extractSpotify() {
  const title = document.querySelector('h1')?.textContent?.trim() || document.title.replace(' | Spotify', '').trim();
  const subtitle = document.querySelector('h1 + span, [data-testid="entityTitle"] + span')?.textContent?.trim() || '';
  const url = window.location.href;

  let content = '';
  if (subtitle) {
    content += `**${subtitle}**\n\n`;
  }
  content += `**URL:** ${url}`;

  return { title, content };
}

// Article extractor - gets main content automatically
function extractArticle() {
  const title = document.title;

  // Find main content area
  const selectors = [
    'article', '[role="main"]', 'main',
    '.post-content', '.article-content', '.entry-content',
    '.content', '.post', '.article'
  ];

  let mainEl = null;
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el && el.innerText.length > 500) {
      mainEl = el;
      break;
    }
  }

  if (!mainEl) {
    mainEl = document.body;
  }

  // Get text content, cleaned up (pass title to avoid duplication)
  const content = extractMainContent(mainEl, title);

  return { title, content };
}

// Extract and clean main content from an element
function extractMainContent(container, pageTitle = null) {
  const temp = container.cloneNode(true);

  // Remove unwanted elements
  temp.querySelectorAll('nav, header, footer, aside, .sidebar, .comments, .advertisement, .ad, script, style, .social-share, .related-posts').forEach(el => el.remove());

  // Convert to markdown, passing page title to avoid duplication
  return htmlToMarkdown(temp.innerHTML, pageTitle);
}

// Normalize text for comparison (remove extra spaces, lowercase)
function normalizeText(text) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

// Check if two titles are similar enough to be considered duplicates
function isSimilarTitle(title1, title2) {
  const norm1 = normalizeText(title1);
  const norm2 = normalizeText(title2);

  if (norm1 === norm2) return true;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

  // Check if one is a prefix/suffix of the other (common with site names appended)
  const minLen = Math.min(norm1.length, norm2.length);
  if (minLen > 10) {
    const similarity = norm1.substring(0, minLen) === norm2.substring(0, minLen);
    if (similarity) return true;
  }

  return false;
}

// Simple HTML to Markdown conversion
function htmlToMarkdown(html, pageTitle = null) {
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Remove h1 tags that match the page title (to avoid duplication)
  temp.querySelectorAll('h1').forEach(el => {
    if (!pageTitle || isSimilarTitle(el.textContent, pageTitle)) {
      el.remove();
    } else {
      // Keep H1 but convert to H2 to maintain hierarchy
      el.outerHTML = `## ${el.textContent}\n\n`;
    }
  });

  // Process headings
  temp.querySelectorAll('h2').forEach(el => el.outerHTML = `## ${el.textContent}\n\n`);
  temp.querySelectorAll('h3').forEach(el => el.outerHTML = `### ${el.textContent}\n\n`);
  temp.querySelectorAll('h4,h5,h6').forEach(el => el.outerHTML = `#### ${el.textContent}\n\n`);

  // Process links
  temp.querySelectorAll('a').forEach(el => {
    const href = el.getAttribute('href') || '';
    el.outerHTML = `[${el.textContent}](${href})`;
  });

  // Process bold/strong
  temp.querySelectorAll('strong, b').forEach(el => el.outerHTML = `**${el.textContent}**`);

  // Process italic/em
  temp.querySelectorAll('em, i').forEach(el => el.outerHTML = `*${el.textContent}*`);

  // Process code
  temp.querySelectorAll('code').forEach(el => el.outerHTML = `\`${el.textContent}\``);

  // Process blockquotes
  temp.querySelectorAll('blockquote').forEach(el => {
    const lines = el.textContent.split('\n').map(l => `> ${l}`).join('\n');
    el.outerHTML = lines + '\n\n';
  });

  // Process lists
  temp.querySelectorAll('ul li').forEach(el => el.outerHTML = `- ${el.textContent}\n`);
  temp.querySelectorAll('ol li').forEach((el, i) => el.outerHTML = `${i + 1}. ${el.textContent}\n`);

  // Process paragraphs
  temp.querySelectorAll('p').forEach(el => el.outerHTML = `${el.textContent}\n\n`);

  // Process images
  temp.querySelectorAll('img').forEach(el => {
    const alt = el.getAttribute('alt') || '';
    const src = el.getAttribute('src') || '';
    el.outerHTML = `![${alt}](${src})\n\n`;
  });

  return temp.textContent
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}


// Check if content already starts with a similar title heading
function contentStartsWithTitle(content, title) {
  const lines = content.trim().split('\n');
  if (lines.length === 0) return false;

  const firstLine = lines[0].trim();

  // Check if first line is a heading (# or ##)
  const headingMatch = firstLine.match(/^#{1,2}\s+(.+)$/);
  if (!headingMatch) return false;

  const headingText = headingMatch[1];
  return isSimilarTitle(headingText, title);
}

// Generate markdown with title, avoiding duplication
function generateMarkdownWithTitle(title, content) {
  // If content already starts with a similar title, don't add another
  if (contentStartsWithTitle(content, title)) {
    return content;
  }
  return `# ${title}\n\n${content}`;
}

// ============================================
// AUTO CAPTURE
// ============================================

function autoCapture(pageType, returnContent = false) {
  let data;

  switch (pageType) {
    case 'youtube':
      data = extractYouTube();
      break;
    case 'twitter':
      data = extractTwitter();
      break;
    case 'spotify':
      data = extractSpotify();
      break;
    default:
      data = extractArticle();
  }

  // Clean title for filename
  const safeTitle = data.title
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100);

  // Generate markdown content
  const markdown = generateMarkdownWithTitle(data.title, data.content);

  // Return content to popup instead of saving directly
  if (returnContent) {
    return { filename: safeTitle, content: markdown };
  }

  // Fallback: show notification (shouldn't reach here normally)
  showNotification('Content extracted. Use extension popup to save.', 'info');
}

// Show notification to user
function showNotification(message, type = 'info') {
  const existing = document.getElementById('oc-notification');
  if (existing) existing.remove();

  const notif = document.createElement('div');
  notif.id = 'oc-notification';
  notif.textContent = message;
  notif.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: system-ui, sans-serif;
    font-size: 14px;
    z-index: 999999;
    color: white;
    background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}


// ============================================
// EDIT SELECTION MODE (formerly Remove mode)
// ============================================

class SelectionEditor {
  constructor() {
    this.overlay = null;
    this.highlight = null;
    this.isActive = false;
    this.allElements = [];
    this.selectedElements = [];
    this.boundOnMouseMove = this.onMouseMove.bind(this);
    this.boundOnClick = this.onClick.bind(this);
    this.boundOnKeyDown = this.onKeyDown.bind(this);
    this.boundBlockLinks = this.blockLinks.bind(this);
  }

  blockLinks(e) {
    if (!this.isActive) return;
    const link = e.target.closest('a');
    if (link && !e.target.closest('#obsidian-clipper-overlay')) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }
  }

  addLinkBlockers() {
    document.addEventListener('click', this.boundBlockLinks, true);
    document.addEventListener('mousedown', this.boundBlockLinks, true);
  }

  removeLinkBlockers() {
    document.removeEventListener('click', this.boundBlockLinks, true);
    document.removeEventListener('mousedown', this.boundBlockLinks, true);
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;

    const mainContent = this.findMainContent();
    this.allElements = this.getSelectableElements(mainContent);

    // Start with all selected
    this.selectedElements = [...this.allElements];
    this.allElements.forEach(el => el.classList.add('oc-selected'));

    this.overlay = document.createElement('div');
    this.overlay.id = 'obsidian-clipper-overlay';
    this.overlay.innerHTML = `
      <div class="oc-toolbar">
        <span class="oc-status">Click to exclude elements</span>
        <span class="oc-count">${this.selectedElements.length} items</span>
        <button id="oc-restore">Reset</button>
        <button id="oc-cancel">Cancel</button>
        <button id="oc-capture" class="${this.selectedElements.length > 0 ? 'ready' : ''}">Capture</button>
      </div>
    `;
    document.body.appendChild(this.overlay);

    this.highlight = document.createElement('div');
    this.highlight.id = 'obsidian-clipper-highlight';
    document.body.appendChild(this.highlight);

    this.addLinkBlockers();

    document.addEventListener('mousemove', this.boundOnMouseMove, true);
    document.addEventListener('click', this.boundOnClick, true);
    document.addEventListener('keydown', this.boundOnKeyDown, true);

    document.getElementById('oc-restore').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.resetSelection();
    });
    document.getElementById('oc-cancel').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.cancel();
    });
    document.getElementById('oc-capture').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.capture();
    });

    this.updateCount();
  }

  findMainContent() {
    const selectors = [
      'article', '[role="main"]', 'main',
      '.post-content', '.article-content', '.entry-content',
      '.content', '.post', '.article'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText.length > 500) {
        return el;
      }
    }
    return document.body;
  }

  getSelectableElements(container) {
    const selectableTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
                           'BLOCKQUOTE', 'PRE', 'UL', 'OL',
                           'FIGURE', 'IMG', 'TABLE'];

    const elements = [];
    const seen = new Set();

    const allEls = container.querySelectorAll(selectableTags.join(','));

    allEls.forEach(el => {
      if (el.closest('nav, header, footer, aside, .sidebar, .comments, .advertisement, .ad')) {
        return;
      }

      if (el.tagName !== 'IMG' && el.innerText.trim().length < 10) {
        return;
      }

      let dominated = false;
      for (const seen_el of seen) {
        if (seen_el.contains(el) && seen_el !== el) {
          dominated = true;
          break;
        }
      }

      if (!dominated) {
        for (const seen_el of [...seen]) {
          if (el.contains(seen_el) && el !== seen_el) {
            seen.delete(seen_el);
            elements.splice(elements.indexOf(seen_el), 1);
          }
        }
        seen.add(el);
        elements.push(el);
      }
    });

    return elements;
  }

  stop() {
    this.isActive = false;

    this.allElements.forEach(el => {
      el.classList.remove('oc-selected', 'oc-excluded');
    });
    this.allElements = [];
    this.selectedElements = [];

    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    if (this.highlight) {
      this.highlight.remove();
      this.highlight = null;
    }

    document.removeEventListener('mousemove', this.boundOnMouseMove, true);
    document.removeEventListener('click', this.boundOnClick, true);
    document.removeEventListener('keydown', this.boundOnKeyDown, true);

    this.removeLinkBlockers();
  }

  onMouseMove(e) {
    if (!this.isActive) return;

    const target = this.getSelectableTarget(e.target);

    if (!target || target.closest('#obsidian-clipper-overlay') || target.id === 'obsidian-clipper-highlight') {
      this.highlight.style.display = 'none';
      return;
    }

    const rect = target.getBoundingClientRect();
    this.highlight.style.top = `${rect.top + window.scrollY}px`;
    this.highlight.style.left = `${rect.left + window.scrollX}px`;
    this.highlight.style.width = `${rect.width}px`;
    this.highlight.style.height = `${rect.height}px`;
    this.highlight.style.display = 'block';

    const isSelected = this.selectedElements.includes(target);
    this.highlight.className = isSelected ? 'oc-highlight-exclude' : 'oc-highlight-restore';
  }

  getSelectableTarget(target) {
    let current = target;
    while (current && current !== document.body) {
      if (this.allElements.includes(current)) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  onClick(e) {
    if (!this.isActive) return;
    if (e.target.closest('#obsidian-clipper-overlay')) return;

    const clickedLink = e.target.closest('a');
    if (clickedLink) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }

    const target = this.getSelectableTarget(e.target);

    if (!target || target.id === 'obsidian-clipper-highlight') {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const index = this.selectedElements.indexOf(target);
    if (index > -1) {
      this.selectedElements.splice(index, 1);
      target.classList.remove('oc-selected');
      target.classList.add('oc-excluded');
    } else {
      this.selectedElements.push(target);
      target.classList.remove('oc-excluded');
      target.classList.add('oc-selected');
    }

    this.updateCount();
  }

  updateCount() {
    const count = this.selectedElements.length;
    const countEl = this.overlay.querySelector('.oc-count');
    countEl.textContent = `${count} items`;

    const captureBtn = document.getElementById('oc-capture');
    if (count > 0) {
      captureBtn.classList.add('ready');
    } else {
      captureBtn.classList.remove('ready');
    }
  }

  resetSelection() {
    this.allElements.forEach(el => {
      el.classList.remove('oc-selected', 'oc-excluded');
    });

    this.selectedElements = [...this.allElements];
    this.allElements.forEach(el => el.classList.add('oc-selected'));

    this.updateCount();
  }

  onKeyDown(e) {
    if (!this.isActive) return;

    if (e.key === 'Escape') {
      this.cancel();
    } else if (e.key === 'Enter') {
      this.capture();
    }
  }

  cancel() {
    this.stop();
  }

  async capture() {
    if (this.selectedElements.length === 0) {
      return;
    }

    this.overlay.style.display = 'none';
    this.highlight.style.display = 'none';

    this.allElements.forEach(el => {
      el.classList.remove('oc-selected', 'oc-excluded');
    });

    const sortedElements = this.sortByDOMOrder(this.selectedElements);

    const html = sortedElements.map(el => el.outerHTML).join('\n\n');
    const content = htmlToMarkdown(html, document.title);

    const safeTitle = document.title
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);

    // Generate markdown content
    const markdown = generateMarkdownWithTitle(document.title, content);

    // Send to Obsidian via REST API
    await sendToObsidian(safeTitle, markdown);
    this.stop();
  }

  sortByDOMOrder(elements) {
    return elements.slice().sort((a, b) => {
      const position = a.compareDocumentPosition(b);
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
  }
}


// Initialize
const selectionEditor = new SelectionEditor();

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'autoCapture') {
    const result = autoCapture(message.pageType, message.returnContent);
    if (message.returnContent) {
      sendResponse(result);
    } else {
      sendResponse({ success: true });
    }
  } else if (message.action === 'editSelection') {
    selectionEditor.start();
    sendResponse({ success: true });
  }
  return true;
});

} // End of obsidianClipperLoaded guard
