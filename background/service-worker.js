// Obsidian Web Clipper - Background Service Worker

// Currently minimal - the popup handles most interactions
// This file can be extended for future features like:
// - Context menu integration
// - Keyboard shortcuts
// - Badge updates

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Obsidian Web Clipper installed');
  } else if (details.reason === 'update') {
    console.log('Obsidian Web Clipper updated');
  }
});
