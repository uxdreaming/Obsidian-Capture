// Storage utility for Obsidian Web Clipper Chrome extension

const Storage = {
  // Default settings
  defaults: {
    vaultName: '',
    defaultFolder: 'Clippings',
    dateFormat: 'yyyy-MM-dd',
    defaultTags: 'web-clip',
    theme: 'dark',
    includeTitle: true,
    includeSource: true,
    includeDate: true,
    includeTags: true,
    includeAuthor: false,
    templates: {},
    recentClips: []
  },

  // Get all settings
  async getAll() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(this.defaults, (result) => {
        resolve(result);
      });
    });
  },

  // Get specific setting
  async get(key) {
    const all = await this.getAll();
    return all[key];
  },

  // Set setting(s)
  async set(data) {
    return new Promise((resolve) => {
      chrome.storage.sync.set(data, () => {
        resolve();
      });
    });
  },

  // Get theme
  async getTheme() {
    return this.get('theme');
  },

  // Set theme
  async setTheme(theme) {
    return this.set({ theme });
  },

  // Get vault name
  async getVaultName() {
    return this.get('vaultName');
  },

  // Set vault name
  async setVaultName(name) {
    return this.set({ vaultName: name });
  },

  // Get default folder
  async getDefaultFolder() {
    return this.get('defaultFolder');
  },

  // Get date format
  async getDateFormat() {
    return this.get('dateFormat');
  },

  // Get default tags
  async getDefaultTags() {
    return this.get('defaultTags');
  },

  // Get frontmatter settings
  async getFrontmatterSettings() {
    const all = await this.getAll();
    return {
      includeTitle: all.includeTitle,
      includeSource: all.includeSource,
      includeDate: all.includeDate,
      includeTags: all.includeTags,
      includeAuthor: all.includeAuthor
    };
  },

  // Get templates
  async getTemplates() {
    return this.get('templates');
  },

  // Save template
  async saveTemplate(name, template) {
    const templates = await this.getTemplates();
    templates[name] = template;
    return this.set({ templates });
  },

  // Delete template
  async deleteTemplate(name) {
    const templates = await this.getTemplates();
    delete templates[name];
    return this.set({ templates });
  },

  // Add to recent clips
  async addRecentClip(clipData) {
    let recent = await this.get('recentClips');
    // Add to front
    recent.unshift({
      title: clipData.title,
      url: clipData.url,
      date: new Date().toISOString()
    });
    // Keep only last 20
    recent = recent.slice(0, 20);
    return this.set({ recentClips: recent });
  },

  // Get recent clips
  async getRecentClips() {
    return this.get('recentClips');
  },

  // Clear recent clips
  async clearRecentClips() {
    return this.set({ recentClips: [] });
  }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Storage;
}
