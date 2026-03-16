// Obsidian Web Clipper - Content Script

// Prevent multiple injections
if (typeof window.obsidianClipperLoaded === 'undefined') {
window.obsidianClipperLoaded = true;

// ============================================
// TURNDOWN HELPER
// ============================================

function htmlToMarkdown(html, pageTitle = null) {
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Remove unwanted elements
  temp.querySelectorAll('nav, header, footer, aside, .sidebar, .comments, .advertisement, .ad, script, style, .social-share, .related-posts').forEach(el => el.remove());

  if (typeof TurndownService !== 'undefined') {
    const td = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      hr: '---'
    });
    // Keep code blocks clean
    td.addRule('codeBlocks', {
      filter: ['pre'],
      replacement: function(content, node) {
        const lang = node.querySelector('code')?.className?.replace('language-', '') || '';
        const code = node.querySelector('code')?.textContent || node.textContent;
        return `\n\`\`\`${lang}\n${code.trim()}\n\`\`\`\n\n`;
      }
    });
    try {
      const md = td.turndown(temp.innerHTML);
      return md.replace(/\n{3,}/g, '\n\n').trim();
    } catch (e) {
      // fall through to manual conversion
    }
  }

  // Fallback: manual conversion
  if (pageTitle) {
    temp.querySelectorAll('h1').forEach(el => {
      if (isSimilarTitle(el.textContent, pageTitle)) {
        el.remove();
      } else {
        el.outerHTML = `\n\n## ${el.textContent}\n\n`;
      }
    });
  }
  temp.querySelectorAll('h2').forEach(el => el.outerHTML = `\n\n## ${el.textContent}\n\n`);
  temp.querySelectorAll('h3').forEach(el => el.outerHTML = `\n\n### ${el.textContent}\n\n`);
  temp.querySelectorAll('h4,h5,h6').forEach(el => el.outerHTML = `\n\n#### ${el.textContent}\n\n`);
  temp.querySelectorAll('a').forEach(el => {
    const href = el.getAttribute('href') || '';
    el.outerHTML = `[${el.textContent}](${href})`;
  });
  temp.querySelectorAll('strong, b').forEach(el => el.outerHTML = `**${el.textContent}**`);
  temp.querySelectorAll('em, i').forEach(el => el.outerHTML = `*${el.textContent}*`);
  temp.querySelectorAll('code').forEach(el => el.outerHTML = `\`${el.textContent}\``);
  temp.querySelectorAll('blockquote').forEach(el => {
    el.outerHTML = el.textContent.split('\n').map(l => `> ${l}`).join('\n') + '\n\n';
  });
  temp.querySelectorAll('ul li').forEach(el => el.outerHTML = `- ${el.textContent}\n`);
  temp.querySelectorAll('ol li').forEach((el, i) => el.outerHTML = `${i + 1}. ${el.textContent}\n`);
  temp.querySelectorAll('p').forEach(el => el.outerHTML = `${el.textContent}\n\n`);
  temp.querySelectorAll('img').forEach(el => {
    const alt = el.getAttribute('alt') || '';
    const src = el.getAttribute('src') || '';
    el.outerHTML = `![${alt}](${src})\n\n`;
  });

  return temp.textContent.replace(/\n{3,}/g, '\n\n').trim();
}

// ============================================
// UTILITIES
// ============================================

function normalizeText(text) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function isSimilarTitle(title1, title2) {
  const norm1 = normalizeText(title1);
  const norm2 = normalizeText(title2);
  if (norm1 === norm2) return true;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
  const minLen = Math.min(norm1.length, norm2.length);
  if (minLen > 10 && norm1.substring(0, minLen) === norm2.substring(0, minLen)) return true;
  return false;
}

function contentStartsWithTitle(content, title) {
  const lines = content.trim().split('\n');
  if (lines.length === 0) return false;
  const firstLine = lines[0].trim();
  const headingMatch = firstLine.match(/^#{1,2}\s+(.+)$/);
  if (!headingMatch) return false;
  return isSimilarTitle(headingMatch[1], title);
}

function generateMarkdownWithTitle(title, content) {
  if (contentStartsWithTitle(content, title)) return content;
  return `# ${title}\n\n${content}`;
}

function innerTextClean(el) {
  return el?.innerText?.trim() || el?.textContent?.trim() || '';
}

// ============================================
// POST TEXT FORMATTER
// ============================================

function formatPostText(text) {
  if (!text) return '';

  // Split into raw lines
  const rawLines = text.split('\n');
  const blocks = [];
  let currentParagraph = [];

  const isListItem = l => /^[\d]+[.)]\s/.test(l) || /^[-•*▸▶➡️✅❌✔️🔹🔸👉👉🎯💡🚀⚡🔑]\s/.test(l) || /^\p{Emoji}/u.test(l.trim());

  const flush = () => {
    if (currentParagraph.length > 0) {
      blocks.push(currentParagraph.join(' '));
      currentParagraph = [];
    }
  };

  for (const raw of rawLines) {
    const line = raw.trim();

    if (!line) {
      // Empty line = paragraph break
      flush();
      continue;
    }

    if (isListItem(line)) {
      // List items always get their own block
      flush();
      blocks.push(line);
      continue;
    }

    // Short lines (under 60 chars) likely intentional line breaks — own block
    if (line.length < 60 && currentParagraph.length > 0) {
      flush();
      blocks.push(line);
      continue;
    }

    currentParagraph.push(line);
  }
  flush();

  // Render blocks: list items as `- item`, rest as paragraphs separated by blank lines
  return blocks.map(block => {
    const trimmed = block.trim();
    // Already looks like a numbered list item
    if (/^[\d]+[.)]\s/.test(trimmed)) return trimmed;
    // Bullet/emoji list item — normalize to markdown list
    if (/^[-•*]\s/.test(trimmed)) return trimmed.replace(/^[-•*]\s/, '- ');
    // Emoji-led line — keep as-is (they're emphatic standalone lines)
    return trimmed;
  }).join('\n\n');
}

// ============================================
// LINKEDIN EXTRACTORS
// ============================================

function extractLinkedIn() {
  const url = window.location.href;
  if (url.includes('/in/')) return extractLinkedInProfile();
  if (url.includes('/jobs/view') || url.includes('/jobs/search')) return extractLinkedInJob();
  if (url.includes('/posts/') || url.includes('/pulse/') || url.includes('/feed/update/')) return extractLinkedInPost();
  if (url.includes('/company/')) return extractLinkedInCompany();
  return extractLinkedInPost(); // fallback for feed
}

function extractLinkedInProfile() {
  const name = document.querySelector('h1')?.textContent?.trim() || document.title.replace(' | LinkedIn', '').trim();

  const headline = document.querySelector('.text-body-medium.break-words, .pv-text-details__left-panel .text-body-medium')?.textContent?.trim() || '';
  const location = document.querySelector('.text-body-small.inline.t-black--light.break-words, .pv-text-details__left-panel .pb2')?.textContent?.trim() || '';

  // About section
  let aboutText = '';
  const aboutSection = document.getElementById('about');
  if (aboutSection) {
    const aboutContainer = aboutSection.closest('section');
    aboutText = aboutContainer?.querySelector('.pv-shared-text-with-see-more span[aria-hidden="true"]')?.textContent?.trim()
      || aboutContainer?.querySelector('.pvs-list__container .visually-hidden')?.textContent?.trim()
      || aboutContainer?.querySelector('span[aria-hidden="true"]')?.textContent?.trim()
      || '';
  }

  // Experience section
  const experiences = [];
  const expSection = document.getElementById('experience');
  if (expSection) {
    const expContainer = expSection.closest('section');
    expContainer?.querySelectorAll('li.artdeco-list__item').forEach(item => {
      const titleEl = item.querySelector('.t-bold span[aria-hidden="true"]');
      const companyEl = item.querySelector('.t-14.t-normal span[aria-hidden="true"]');
      const dateEl = item.querySelector('.t-14.t-normal.t-black--light span[aria-hidden="true"]');
      if (titleEl) {
        let exp = `- **${titleEl.textContent.trim()}**`;
        if (companyEl) exp += ` · ${companyEl.textContent.trim()}`;
        if (dateEl) exp += ` *(${dateEl.textContent.trim()})*`;
        experiences.push(exp);
      }
    });
  }

  // Education section
  const educations = [];
  const eduSection = document.getElementById('education');
  if (eduSection) {
    const eduContainer = eduSection.closest('section');
    eduContainer?.querySelectorAll('li.artdeco-list__item').forEach(item => {
      const schoolEl = item.querySelector('.t-bold span[aria-hidden="true"]');
      const degreeEl = item.querySelector('.t-14.t-normal span[aria-hidden="true"]');
      if (schoolEl) {
        let edu = `- **${schoolEl.textContent.trim()}**`;
        if (degreeEl) edu += ` · ${degreeEl.textContent.trim()}`;
        educations.push(edu);
      }
    });
  }

  let content = '';
  if (headline) content += `**${headline}**\n\n`;
  if (location) content += `📍 ${location}\n\n`;
  content += `**URL:** ${window.location.href}\n\n`;
  if (aboutText) content += `## About\n\n${aboutText}\n\n`;
  if (experiences.length > 0) content += `## Experience\n\n${experiences.join('\n')}\n\n`;
  if (educations.length > 0) content += `## Education\n\n${educations.join('\n')}\n\n`;

  return { title: name, content: content.trim() };
}

function findMostVisiblePost() {
  // Find the post with the most visible area in the viewport (works on feed and single post)
  const candidates = Array.from(document.querySelectorAll(
    '.feed-shared-update-v2, .occludable-update, [data-urn].fie-impression-container'
  ));

  if (candidates.length === 0) {
    return document.querySelector('[data-urn]') || document.body;
  }

  let bestPost = candidates[0];
  let bestVisible = 0;
  for (const post of candidates) {
    const rect = post.getBoundingClientRect();
    const visible = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
    if (visible > bestVisible) { bestVisible = visible; bestPost = post; }
  }
  return bestPost;
}

function extractLinkedInPost() {
  // Use the most visible post in viewport — works from feed AND from a single post URL
  const postContainer = findMostVisiblePost();

  // Author name only
  let author = '';
  const authorSelectors = [
    '.update-components-actor__name span[aria-hidden="true"]',
    '.update-components-actor__meta .update-components-actor__name span[aria-hidden="true"]',
    '[data-anonymize="person-name"]',
    '.update-components-actor__name span:not(.visually-hidden)',
    '.feed-shared-actor__name span[aria-hidden="true"]',
    '.feed-shared-actor__name',
    '.update-components-actor__name',
    '.update-components-actor__meta a[aria-label] span',
  ];
  for (const sel of authorSelectors) {
    const text = postContainer.querySelector(sel)?.textContent?.trim();
    if (text && text.length > 1) { author = text; break; }
  }
  // Last resort: first link inside the actor/header area
  if (!author) {
    const actorLink = postContainer.querySelector(
      '.update-components-actor a[href*="/in/"], .feed-shared-actor a[href*="/in/"]'
    );
    author = actorLink?.textContent?.trim() || '';
  }

  // Author description (what they do / experience)
  const authorDesc = postContainer.querySelector(
    '.update-components-actor__description span[aria-hidden="true"], .feed-shared-actor__description'
  )?.textContent?.trim() || '';

  // Post text — LinkedIn has changed DOM several times; try all known patterns
  const postSelectors = [
    '.update-components-text__text-view',           // current LinkedIn (2024-2025)
    '.update-components-text .break-words',
    '.update-components-text span[dir="ltr"]',
    '.feed-shared-text .break-words',
    '.feed-shared-text span[dir="ltr"]',
    '.feed-shared-text',
    '.update-components-text',
    '.feed-shared-update-v2__description .break-words',
    '.attributed-text-segment-list__content',
  ];
  let postText = '';
  for (const sel of postSelectors) {
    const el = postContainer.querySelector(sel);
    const text = el?.innerText?.trim();
    if (text && text.length > 5) { postText = text; break; }
  }
  // Last resort: any span[dir="ltr"] inside the post container that has real content
  if (!postText) {
    postContainer.querySelectorAll('span[dir="ltr"]').forEach(el => {
      if (!postText && el.innerText?.trim().length > 20) postText = el.innerText.trim();
    });
  }

  // Images — scoped to this post only
  const imageSelectors = [
    '.update-components-image__image',
    '.update-components-image img',
    '.feed-shared-image__container img',
    '.feed-shared-image img',
    '.update-components-carousel img',
    '.feed-shared-carousel img',
    '.update-components-linkedin-video__thumbnail',
    '.feed-shared-article__image img',
    '.update-components-article__image img',
  ];
  const seenSrcs = new Set();
  const images = [];
  for (const sel of imageSelectors) {
    postContainer.querySelectorAll(sel).forEach(img => {
      const src = img.dataset.delayedUrl || img.dataset.src || img.src || '';
      if (!src || src.startsWith('data:') || seenSrcs.has(src)) return;
      if (img.naturalWidth > 0 && img.naturalWidth < 80) return;
      seenSrcs.add(src);
      images.push(`![${img.alt?.trim() || ''}](${src})`);
    });
  }

  // Long-form article (Pulse)
  const articleTitle = document.querySelector('h1.reader-article-header__title, .article-title')?.textContent?.trim() || '';
  const articleBody = document.querySelector('.reader-article-content, .article-body');

  // Title = first meaningful line of the post (used as filename and heading)
  let title = articleTitle;
  if (!title && postText) {
    const firstLine = postText.split('\n').find(l => l.trim().length > 5) || postText;
    title = firstLine.trim().substring(0, 80) + (firstLine.trim().length > 80 ? '…' : '');
  }
  if (!title) title = author ? `Post by ${author}` : 'LinkedIn Post';

  // No heading in content — Obsidian uses the filename as title, heading would duplicate it
  let content = '';
  if (author) content += `**Author:** ${author}\n`;
  if (authorDesc) content += `**Desc:** ${authorDesc}\n`;
  content += `**URL:** ${window.location.href}\n\n---\n\n`;
  if (articleBody) {
    content += htmlToMarkdown(articleBody.innerHTML);
  } else if (postText) {
    // Skip the first line (already used as filename/title), format the rest
    const lines = postText.split('\n').filter(l => l.trim());
    const body = lines.length > 1 ? lines.slice(1).join('\n') : postText;
    content += formatPostText(body);
  }
  if (images.length > 0) {
    content += '\n\n' + images.join('\n\n');
  }

  return { title, content: content.trim() };
}

function extractLinkedInJob() {
  const jobTitle = document.querySelector(
    '.jobs-unified-top-card__job-title h1, .jobs-unified-top-card__job-title, h1.job-title, h1'
  )?.textContent?.trim() || 'Job Listing';

  const company = document.querySelector(
    '.jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name, .topcard__org-name-link'
  )?.textContent?.trim() || '';

  const location = document.querySelector(
    '.jobs-unified-top-card__bullet, .jobs-unified-top-card__workplace-type, .topcard__flavor--bullet'
  )?.textContent?.trim() || '';

  const description = document.querySelector(
    '.jobs-description__content .jobs-description-content__text, .jobs-description__content, .description__text'
  )?.innerText?.trim() || '';

  const title = company ? `${jobTitle} at ${company}` : jobTitle;
  let content = '';
  if (company) content += `**Company:** ${company}\n`;
  if (location) content += `**Location:** ${location}\n`;
  content += `**URL:** ${window.location.href}\n\n---\n\n`;
  if (description) content += description;

  return { title, content: content.trim() };
}

function extractLinkedInCompany() {
  const name = document.querySelector('h1')?.textContent?.trim() || document.title.replace(' | LinkedIn', '').trim();
  const tagline = document.querySelector('.org-top-card-summary__tagline, .top-card-layout__headline')?.textContent?.trim() || '';
  const about = document.querySelector(
    '.org-about-us-organization-description__text, [data-test-id="about-us__description"], .org-about-module__description'
  )?.textContent?.trim() || '';

  let content = '';
  if (tagline) content += `*${tagline}*\n\n`;
  content += `**URL:** ${window.location.href}\n\n`;
  if (about) content += `## About\n\n${about}`;

  return { title: name, content: content.trim() };
}

// ============================================
// TWITTER/X EXTRACTOR (threads + single)
// ============================================

function extractTwitter() {
  const url = window.location.href;
  const tweets = Array.from(document.querySelectorAll('[data-testid="tweet"]'));

  if (tweets.length === 0) {
    const tweetText = document.querySelector('[data-testid="tweetText"]')?.textContent?.trim() || '';
    const author = document.querySelector('[data-testid="User-Name"] span')?.textContent?.trim() || '';
    return {
      title: `Tweet by ${author}`,
      content: `> ${tweetText}\n\n— ${author}\n\n**URL:** ${url}`
    };
  }

  // Get primary author from first tweet
  const firstAuthorEl = tweets[0].querySelector('[data-testid="User-Name"]');
  const author = firstAuthorEl?.querySelector('span')?.textContent?.trim() || '';
  const handle = firstAuthorEl?.querySelectorAll('span')?.[2]?.textContent?.trim() || '';

  const tweetParts = [];
  tweets.forEach((tweet, i) => {
    const textEl = tweet.querySelector('[data-testid="tweetText"]');
    if (!textEl) return;

    const text = textEl.innerText?.trim() || '';
    const tweetAuthor = tweet.querySelector('[data-testid="User-Name"] span')?.textContent?.trim() || author;

    // Images
    const images = Array.from(tweet.querySelectorAll('[data-testid="tweetPhoto"] img'))
      .map(img => `![](${img.src})`);

    // Videos
    const hasVideo = tweet.querySelector('[data-testid="videoComponent"]');

    let part = '';
    if (i > 0 && tweetAuthor !== author) {
      part += `**${tweetAuthor}:**\n`;
    }
    if (text) part += text;
    if (images.length > 0) part += '\n' + images.join('\n');
    if (hasVideo && !text) part += '*[video]*';

    if (part) tweetParts.push(part);
  });

  const isThread = tweetParts.length > 1;
  const title = isThread ? `Thread by ${author}` : `Tweet by ${author}`;
  let content = `**${author}** ${handle}\n\n`;
  content += tweetParts.map(t => t.split('\n').map(l => `> ${l}`).join('\n')).join('\n\n');
  content += `\n\n**URL:** ${url}`;

  return { title, content };
}

// ============================================
// GITHUB EXTRACTOR
// ============================================

function extractGitHub() {
  const url = window.location.href;

  // Issues / PRs
  if (url.match(/\/issues\/\d+/) || url.match(/\/pull\/\d+/)) {
    return extractGitHubIssue();
  }

  // Repo root or subdirectory
  const repoMatch = url.match(/github\.com\/([^/]+)\/([^/?(#]+)/);
  if (repoMatch) {
    return extractGitHubRepo(repoMatch[1], repoMatch[2]);
  }

  return extractArticle();
}

function extractGitHubRepo(owner, repo) {
  const description = document.querySelector('p[itemprop="about"], .f4.my-3, .repository-description')?.textContent?.trim() || '';

  const stars = document.querySelector('#repo-stars-counter-star, [href$="/stargazers"] strong, .Counter[title]')?.textContent?.trim()
    || document.querySelector('#repo-stars-counter-star')?.getAttribute('title') || '';
  const forks = document.querySelector('#repo-network-counter, [href$="/forks"] strong')?.textContent?.trim() || '';
  const language = document.querySelector('[itemprop="programmingLanguage"], .repository-language-stats-graph .color-fg-default, .d-inline span')?.textContent?.trim() || '';
  const license = document.querySelector('[data-analytics-event*="license"] span, .octicon-law + span')?.textContent?.trim() || '';

  const topics = Array.from(document.querySelectorAll('.topic-tag, [data-octo-click="topic_click"] a'))
    .map(el => el.textContent.trim().replace(/\s+/g, '')).filter(t => t);

  // README
  const readmeEl = document.querySelector('#readme .markdown-body, article.markdown-body');
  const readmeContent = readmeEl ? htmlToMarkdown(readmeEl.innerHTML) : '';

  const title = `${owner}/${repo}`;
  let content = '';
  if (description) content += `> ${description}\n\n`;

  const meta = [];
  if (stars) meta.push(`⭐ ${stars}`);
  if (forks) meta.push(`🍴 ${forks}`);
  if (language) meta.push(`💻 ${language}`);
  if (license) meta.push(`📄 ${license}`);
  if (meta.length) content += meta.join(' · ') + '\n\n';

  if (topics.length > 0) {
    content += topics.map(t => `#${t}`).join(' ') + '\n\n';
  }

  content += `**URL:** ${window.location.href}\n\n`;

  if (readmeContent) {
    content += '---\n\n## README\n\n' + readmeContent;
  }

  return { title, content: content.trim() };
}

function extractGitHubIssue() {
  const title = document.querySelector('h1 .js-issue-title, h1 bdi, .gh-header-title .js-issue-title')?.textContent?.trim()
    || document.title;
  const author = document.querySelector('.TimelineItem-body .author:first-child')?.textContent?.trim()
    || document.querySelector('.comment-header .author')?.textContent?.trim() || '';
  const state = document.querySelector('.State')?.textContent?.trim() || '';
  const body = document.querySelector('.comment-body.markdown-body, .js-comment-body')?.innerHTML || '';
  const labels = Array.from(document.querySelectorAll('.IssueLabel, .Label'))
    .map(el => el.textContent.trim()).filter(t => t);

  let content = '';
  if (author) content += `**Author:** ${author}\n`;
  if (state) content += `**Status:** ${state}\n`;
  if (labels.length > 0) content += `**Labels:** ${labels.join(', ')}\n`;
  content += `**URL:** ${window.location.href}\n\n---\n\n`;
  if (body) content += htmlToMarkdown(body);

  return { title, content: content.trim() };
}

// ============================================
// BEHANCE EXTRACTOR
// ============================================

function extractBehance() {
  const title = document.querySelector('h1.project-title, h1.ProjectInfo-projectTitle, h1')?.textContent?.trim()
    || document.title.replace(' on Behance', '').trim();

  const owner = document.querySelector('.rf-profile-item__name, .UserInfo-name, .project-owner-name')?.textContent?.trim() || '';
  const description = document.querySelector('.project-description, .ProjectInfo-projectDescription')?.textContent?.trim() || '';
  const tools = Array.from(document.querySelectorAll('.ProjectInfo-tool, .tool')).map(el => el.textContent.trim()).filter(t => t);

  // Project modules: text and images
  const modules = [];
  document.querySelectorAll('.project-module, .ProjectModule').forEach(module => {
    const textEl = module.querySelector('.TextElement-paragraph, .text-section p, p');
    const imgEl = module.querySelector('img');

    if (textEl) {
      const text = textEl.innerText?.trim();
      if (text) modules.push(text);
    } else if (imgEl) {
      const src = imgEl.dataset.src || imgEl.src || '';
      const alt = imgEl.alt || '';
      if (src) modules.push(`![${alt}](${src})`);
    }
  });

  let content = '';
  if (owner) content += `**By:** ${owner}\n`;
  if (tools.length > 0) content += `**Tools:** ${tools.join(', ')}\n`;
  content += `**URL:** ${window.location.href}\n\n`;
  if (description) content += `${description}\n\n`;
  if (modules.length > 0) content += '---\n\n' + modules.join('\n\n');

  return { title, content: content.trim() };
}

// ============================================
// FACEBOOK EXTRACTOR
// ============================================

function extractFacebook() {
  const url = window.location.href;
  const articles = Array.from(document.querySelectorAll('[role="article"]'));

  if (articles.length === 0) return extractArticle();

  // Use the first meaningful article
  const mainArticle = articles[0];

  // Author
  const author = mainArticle.querySelector('h2 a, h3 a, strong a, [data-testid="story-subtitle"] a')?.textContent?.trim()
    || mainArticle.querySelector('h2, h3, strong')?.textContent?.trim() || '';

  // Post text: Facebook uses different attributes depending on version
  let postText = '';
  const textSelectors = [
    '[data-ad-comet-preview="message"]',
    '[data-ad-preview="message"]',
    '[data-testid="post_message"]',
    '.userContent',
  ];
  for (const sel of textSelectors) {
    const el = mainArticle.querySelector(sel);
    if (el && el.innerText?.trim()) {
      postText = el.innerText.trim();
      break;
    }
  }

  // Fallback: collect meaningful dir="auto" text blocks
  if (!postText) {
    const blocks = Array.from(mainArticle.querySelectorAll('div[dir="auto"]'))
      .map(el => el.innerText?.trim())
      .filter(t => t && t.length > 30);
    postText = [...new Set(blocks)].join('\n\n');
  }

  const title = author ? `Facebook post by ${author}` : 'Facebook Post';
  let content = '';
  if (postText) content += postText.split('\n').map(l => `> ${l}`).join('\n');
  if (author) content += `\n\n— ${author}`;
  content += `\n\n**URL:** ${url}`;

  return { title, content: content.trim() };
}

// ============================================
// YOUTUBE HELPERS
// ============================================

function ytFormatDuration(seconds) {
  const s = parseInt(seconds) || 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}

function ytFormatViews(n) {
  const num = parseInt(n) || 0;
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
  if (num >= 1_000_000)     return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000)         return (num / 1_000).toFixed(1) + 'K';
  return num.toLocaleString();
}

async function getYouTubeTranscript() {
  try {
    const tracks = window.ytInitialPlayerResponse
      ?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks?.length) return null;

    const track = tracks.find(t => t.languageCode === 'es')
      || tracks.find(t => t.languageCode === 'en')
      || tracks[0];
    if (!track?.baseUrl) return null;

    const resp = await fetch(track.baseUrl + '&fmt=json3');
    const data = await resp.json();
    const text = data.events
      ?.filter(e => e.segs)
      ?.map(e => e.segs.map(s => s.utf8 || '').join(''))
      ?.join(' ')
      ?.replace(/\s+/g, ' ')
      ?.trim();
    return text || null;
  } catch {
    return null;
  }
}

// ============================================
// YOUTUBE EXTRACTOR
// ============================================

async function extractYouTube() {
  const playerResponse = window.ytInitialPlayerResponse || {};
  const videoDetails   = playerResponse.videoDetails || {};
  const url            = window.location.href;
  const videoId        = new URL(url).searchParams.get('v') || videoDetails.videoId || '';

  const title = videoDetails.title
    || document.querySelector('h1.ytd-watch-metadata yt-formatted-string, #title h1')?.textContent?.trim()
    || document.title.replace(' - YouTube', '').trim();

  const channel    = videoDetails.author
    || document.querySelector('#channel-name yt-formatted-string a, ytd-channel-name yt-formatted-string a')?.textContent?.trim()
    || '';
  const channelUrl = document.querySelector('#channel-name yt-formatted-string a, ytd-channel-name yt-formatted-string a')?.href || '';

  const duration    = ytFormatDuration(videoDetails.lengthSeconds);
  const views       = ytFormatViews(videoDetails.viewCount);
  const description = videoDetails.shortDescription
    || document.querySelector('#description-inline-expander yt-formatted-string, ytd-text-inline-expander yt-formatted-string')?.textContent?.trim()
    || '';
  const publishDate = document.querySelector('#info-strings yt-formatted-string')?.textContent?.trim() || '';
  const thumbnail   = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : '';
  const transcript  = await getYouTubeTranscript();

  return {
    isYouTube: true,
    filename:  title.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().substring(0, 100),
    title, videoId, channel, channelUrl, duration, views,
    description, publishDate, thumbnail, transcript, url,
  };
}

// ============================================
// SPOTIFY EXTRACTOR
// ============================================

function extractSpotify() {
  const title = document.querySelector('h1')?.textContent?.trim() || document.title.replace(' | Spotify', '').trim();
  const subtitle = document.querySelector('h1 + span, [data-testid="entityTitle"] + span')?.textContent?.trim() || '';
  const url = window.location.href;

  let content = '';
  if (subtitle) content += `**${subtitle}**\n\n`;
  content += `**URL:** ${url}`;

  return { title, content };
}

// ============================================
// GENERIC ARTICLE EXTRACTOR
// ============================================

function extractArticle() {
  const title = document.title;

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
  if (!mainEl) mainEl = document.body;

  // Clone and remove noise
  const temp = mainEl.cloneNode(true);
  temp.querySelectorAll('nav, header, footer, aside, .sidebar, .comments, .advertisement, .ad, script, style, .social-share, .related-posts').forEach(el => el.remove());

  const content = htmlToMarkdown(temp.innerHTML, title);
  return { title, content };
}

// ============================================
// DRIBBBLE EXTRACTOR
// ============================================

function extractDribbble() {
  const url = window.location.href;

  // Single shot page
  if (url.includes('/shots/')) {
    const title = document.querySelector('h1, .shot-title, [class*="shot-title"]')?.textContent?.trim()
      || document.title.replace('- Dribbble', '').trim();

    const author = document.querySelector(
      '.shot-byline-author, [class*="player-name"], .Designer-module, a[href*="/designers/"] span, .user-information-container h2'
    )?.textContent?.trim() || '';

    const description = document.querySelector(
      '.shot-description, [class*="shot-description"], .commentable-description'
    )?.innerText?.trim() || '';

    const tags = Array.from(document.querySelectorAll(
      '.shot-tags a, [class*="shot-tag"] a, [href*="/shots/tags/"]'
    )).map(el => el.textContent.trim()).filter(t => t);

    const tools = Array.from(document.querySelectorAll(
      '.shot-tools a, [class*="tools"] a'
    )).map(el => el.textContent.trim()).filter(t => t);

    // Main shot image/gif
    const images = [];
    const seenSrcs = new Set();
    document.querySelectorAll(
      '.media-shot img, .shot-image img, [class*="shot-media"] img, .js-media-thumbnail img'
    ).forEach(img => {
      const src = img.dataset.src || img.dataset.hidpiSrc || img.src || '';
      if (!src || src.startsWith('data:') || seenSrcs.has(src)) return;
      seenSrcs.add(src);
      images.push(`![${img.alt?.trim() || title}](${src})`);
    });

    let content = '';
    if (author) content += `**Author:** ${author}\n`;
    if (tags.length > 0) content += `**Tags:** ${tags.join(', ')}\n`;
    if (tools.length > 0) content += `**Tools:** ${tools.join(', ')}\n`;
    content += `**URL:** ${url}\n\n---\n\n`;
    if (images.length > 0) content += images.join('\n\n') + '\n\n';
    if (description) content += description;

    return { title, content: content.trim() };
  }

  // Profile page
  const name = document.querySelector('h1, .profile-masthead h1, [class*="Profile"] h1')?.textContent?.trim()
    || document.title.replace('- Dribbble', '').trim();
  const bio = document.querySelector('.bio, [class*="profile-bio"], .user-bio')?.textContent?.trim() || '';
  const location = document.querySelector('.location, [class*="location"]')?.textContent?.trim() || '';

  let content = '';
  if (bio) content += `${bio}\n\n`;
  if (location) content += `📍 ${location}\n\n`;
  content += `**URL:** ${url}`;

  return { title: name, content: content.trim() };
}

// ============================================
// MEDIUM EXTRACTOR
// ============================================

function extractMedium() {
  const title = document.querySelector('h1')?.textContent?.trim()
    || document.title.replace(' | Medium', '').replace(' – Medium', '').trim();

  // Author — multiple selectors for Medium's different layouts
  let author = '';
  const authorSelectors = [
    '[data-testid="authorName"]',
    '.pw-author-name',
    'a[rel="author"]',
    '[class*="authorName"]',
  ];
  for (const sel of authorSelectors) {
    const text = document.querySelector(sel)?.textContent?.trim();
    if (text) { author = text; break; }
  }

  // Publication name (e.g. "Towards Data Science")
  const publication = document.querySelector('[data-testid="publicationName"], .pw-publication-name')?.textContent?.trim() || '';

  // Publish date
  const dateEl = document.querySelector('[data-testid="storyPublishDate"], time');
  const date = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '';

  // Reading time
  const readingTime = document.querySelector('[data-testid="storyReadTime"], .pw-reading-time')?.textContent?.trim() || '';

  // Tags
  const tags = Array.from(document.querySelectorAll('[href*="/tag/"] span, .pw-tags a'))
    .map(el => el.textContent.trim()).filter(t => t);

  // Article body
  const articleEl = document.querySelector('article');
  let bodyContent = '';
  if (articleEl) {
    const clone = articleEl.cloneNode(true);
    // Remove clap buttons, follow buttons, responses section
    clone.querySelectorAll('[data-testid="clapButton"], [data-testid="followButton"], section[class*="response"]').forEach(el => el.remove());
    bodyContent = htmlToMarkdown(clone.innerHTML, title);
  }

  let content = '';
  if (author) content += `**Author:** ${author}\n`;
  if (publication) content += `**Publication:** ${publication}\n`;
  if (date) content += `**Date:** ${date}\n`;
  if (readingTime) content += `**Reading time:** ${readingTime}\n`;
  if (tags.length > 0) content += `**Tags:** ${tags.join(', ')}\n`;
  content += `**URL:** ${window.location.href}\n\n---\n\n`;
  if (bodyContent) content += bodyContent;

  return { title, content: content.trim() };
}

// ============================================
// AUTO CAPTURE (router)
// ============================================

async function autoCapture(pageType, returnContent = false) {
  // YouTube returns raw data — popup.js handles formatting + AI summary
  if (pageType === 'youtube') {
    return await extractYouTube();
  }

  let data;
  switch (pageType) {
    case 'twitter':   data = extractTwitter();   break;
    case 'spotify':   data = extractSpotify();   break;
    case 'linkedin':  data = extractLinkedIn();  break;
    case 'github':    data = extractGitHub();    break;
    case 'behance':   data = extractBehance();   break;
    case 'facebook':  data = extractFacebook();  break;
    case 'medium':    data = extractMedium();    break;
    case 'dribbble':  data = extractDribbble();  break;
    default:          data = extractArticle();
  }

  const safeTitle = data.title
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100);

  const base = (pageType === 'article')
    ? generateMarkdownWithTitle(data.title, data.content)
    : data.content;

  const markdown = `#Capture\n\n${base}`;

  if (returnContent) {
    return { filename: safeTitle, content: markdown };
  }

  showNotification('Content extracted. Use extension popup to save.', 'info');
}

// ============================================
// NOTIFICATION
// ============================================

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
// EDIT SELECTION MODE
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
      e.stopPropagation(); e.preventDefault(); this.resetSelection();
    });
    document.getElementById('oc-cancel').addEventListener('click', (e) => {
      e.stopPropagation(); e.preventDefault(); this.cancel();
    });
    document.getElementById('oc-capture').addEventListener('click', (e) => {
      e.stopPropagation(); e.preventDefault(); this.capture();
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
      if (el && el.innerText.length > 500) return el;
    }
    return document.body;
  }

  getSelectableElements(container) {
    const selectableTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
                           'BLOCKQUOTE', 'PRE', 'UL', 'OL',
                           'FIGURE', 'IMG', 'TABLE'];
    const elements = [];
    const seen = new Set();

    container.querySelectorAll(selectableTags.join(',')).forEach(el => {
      if (el.closest('nav, header, footer, aside, .sidebar, .comments, .advertisement, .ad')) return;
      if (el.tagName !== 'IMG' && el.innerText.trim().length < 10) return;

      let dominated = false;
      for (const seen_el of seen) {
        if (seen_el.contains(el) && seen_el !== el) { dominated = true; break; }
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
    this.allElements.forEach(el => el.classList.remove('oc-selected', 'oc-excluded'));
    this.allElements = [];
    this.selectedElements = [];
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
    if (this.highlight) { this.highlight.remove(); this.highlight = null; }
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
    this.highlight.className = this.selectedElements.includes(target) ? 'oc-highlight-exclude' : 'oc-highlight-restore';
  }

  getSelectableTarget(target) {
    let current = target;
    while (current && current !== document.body) {
      if (this.allElements.includes(current)) return current;
      current = current.parentElement;
    }
    return null;
  }

  onClick(e) {
    if (!this.isActive) return;
    if (e.target.closest('#obsidian-clipper-overlay')) return;

    const clickedLink = e.target.closest('a');
    if (clickedLink) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    }

    const target = this.getSelectableTarget(e.target);
    if (!target || target.id === 'obsidian-clipper-highlight') return;

    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();

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
    this.overlay.querySelector('.oc-count').textContent = `${count} items`;
    const captureBtn = document.getElementById('oc-capture');
    captureBtn.classList.toggle('ready', count > 0);
  }

  resetSelection() {
    this.allElements.forEach(el => el.classList.remove('oc-selected', 'oc-excluded'));
    this.selectedElements = [...this.allElements];
    this.allElements.forEach(el => el.classList.add('oc-selected'));
    this.updateCount();
  }

  onKeyDown(e) {
    if (!this.isActive) return;
    if (e.key === 'Escape') this.cancel();
    else if (e.key === 'Enter') this.capture();
  }

  cancel() { this.stop(); }

  async capture() {
    if (this.selectedElements.length === 0) return;

    this.overlay.style.display = 'none';
    this.highlight.style.display = 'none';
    this.allElements.forEach(el => el.classList.remove('oc-selected', 'oc-excluded'));

    const sortedElements = this.sortByDOMOrder(this.selectedElements);
    const html = sortedElements.map(el => el.outerHTML).join('\n\n');
    const content = htmlToMarkdown(html, document.title);

    const safeTitle = document.title
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);

    const markdown = generateMarkdownWithTitle(document.title, content);
    // Send back to background/popup to save
    chrome.runtime.sendMessage({ action: 'saveToVault', filename: safeTitle, content: markdown });
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
    autoCapture(message.pageType, message.returnContent)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ error: err.message }));
    return true; // keep channel open for async
  } else if (message.action === 'editSelection') {
    selectionEditor.start();
    sendResponse({ success: true });
  }
  return true;
});

} // End of obsidianClipperLoaded guard
