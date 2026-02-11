// Obsidian Markdown formatter

const ObsidianFormatter = {
  // Generate YAML frontmatter
  generateFrontmatter(properties) {
    const lines = ['---'];

    for (const [key, value] of Object.entries(properties)) {
      if (value === null || value === undefined) continue;

      if (Array.isArray(value)) {
        if (value.length > 0) {
          lines.push(`${key}: [${value.map(v => `"${this.escapeYaml(v)}"`).join(', ')}]`);
        }
      } else if (typeof value === 'string' && value.trim()) {
        // Quote strings that might need it
        if (value.includes(':') || value.includes('#') || value.includes('"') || value.includes("'")) {
          lines.push(`${key}: "${this.escapeYaml(value)}"`);
        } else {
          lines.push(`${key}: ${value}`);
        }
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        lines.push(`${key}: ${value}`);
      }
    }

    lines.push('---');
    return lines.join('\n');
  },

  // Escape special characters in YAML strings
  escapeYaml(str) {
    return str.replace(/"/g, '\\"').replace(/\n/g, '\\n');
  },

  // Format markdown for Obsidian (standard markdown, no block prefixes)
  formatMarkdown(markdown) {
    // Obsidian uses standard markdown, so minimal processing needed
    return markdown
      .replace(/\n{3,}/g, '\n\n')  // Normalize multiple newlines
      .trim();
  },

  // Convert HTML to Obsidian markdown (via Turndown first)
  htmlToMarkdown(html, turndownService) {
    const markdown = turndownService.turndown(html);
    return this.formatMarkdown(markdown);
  },

  // Format content with frontmatter
  withFrontmatter(content, properties) {
    const frontmatter = this.generateFrontmatter(properties);
    return `${frontmatter}\n\n${content}`;
  },

  // Create callout/admonition (Obsidian format)
  createCallout(type, title, content) {
    const lines = [`> [!${type}] ${title}`];
    content.split('\n').forEach(line => {
      lines.push(`> ${line}`);
    });
    return lines.join('\n');
  },

  // Escape special Obsidian characters
  escape(text) {
    return text
      .replace(/\[\[/g, '\\[\\[')
      .replace(/\]\]/g, '\\]\\]');
  },

  // Create an Obsidian page link
  pageLink(pageName, alias = null) {
    if (alias) {
      return `[[${pageName}|${alias}]]`;
    }
    return `[[${pageName}]]`;
  },

  // Create an Obsidian tag
  tag(tagName) {
    // Remove # if present and clean up
    const clean = tagName.replace(/^#/, '').trim().replace(/\s+/g, '-');
    return `#${clean}`;
  },

  // Format tags string to Obsidian tags array
  formatTags(tagsString) {
    if (!tagsString) return [];

    return tagsString
      .split(',')
      .map(t => t.trim().replace(/^#/, '').replace(/\s+/g, '-'))
      .filter(t => t);
  },

  // Format tags for display in frontmatter
  formatTagsForFrontmatter(tagsString) {
    const tags = this.formatTags(tagsString);
    return tags.length > 0 ? tags : ['web-clip'];
  },

  // Get filename from title (Obsidian-safe)
  getFilename(title) {
    // Remove/replace characters not allowed in filenames
    const safe = title
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200);  // Limit length

    return `${safe}.md`;
  },

  // Format date for Obsidian
  formatDate(date, format = 'yyyy-MM-dd') {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return format
      .replace('yyyy', year)
      .replace('MM', month)
      .replace('dd', day)
      .replace('HH', hours)
      .replace('mm', minutes);
  },

  // Create highlight markup (Obsidian style with color)
  highlight(text, color = null) {
    if (color) {
      return `==${text}== (${color})`;
    }
    return `==${text}==`;
  },

  // Normalize text for comparison
  normalizeText(text) {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
  },

  // Check if two titles are similar enough to be considered duplicates
  isSimilarTitle(title1, title2) {
    const norm1 = this.normalizeText(title1);
    const norm2 = this.normalizeText(title2);

    if (norm1 === norm2) return true;
    if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

    const minLen = Math.min(norm1.length, norm2.length);
    if (minLen > 10) {
      if (norm1.substring(0, minLen) === norm2.substring(0, minLen)) return true;
    }

    return false;
  },

  // Check if content already starts with a similar title heading
  contentStartsWithTitle(content, title) {
    const lines = content.trim().split('\n');
    if (lines.length === 0) return false;

    const firstLine = lines[0].trim();
    const headingMatch = firstLine.match(/^#{1,2}\s+(.+)$/);
    if (!headingMatch) return false;

    return this.isSimilarTitle(headingMatch[1], title);
  },

  // Generate full clipped note
  generateNote(data) {
    const date = new Date();

    // Build frontmatter properties
    const properties = {
      title: data.title || 'Untitled',
      source: data.url || '',
      date: this.formatDate(date),
      tags: this.formatTagsForFrontmatter(data.tags)
    };

    // Add optional properties
    if (data.author) {
      properties.author = data.author;
    }

    // Build content
    let content = '';
    const title = data.title || 'Untitled';

    // Add title as heading only if content doesn't already start with it
    if (!data.content || !this.contentStartsWithTitle(data.content, title)) {
      content += `# ${title}\n\n`;
    }

    // Add source callout
    if (data.url) {
      content += `> [!info] Source\n> ${data.url}\n\n`;
    }

    content += '---\n\n';

    // Add main content
    if (data.content) {
      content += data.content;
    }

    return this.withFrontmatter(content, properties);
  }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ObsidianFormatter;
}
