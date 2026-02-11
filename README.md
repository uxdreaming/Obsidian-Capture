# Obsidian Web Clipper

A Chrome extension for capturing and highlighting web content, formatted for Obsidian with YAML frontmatter.

![Popup](screenshots/01-popup.png)

## Features

- **Remove Mode**: Start with all content selected, click to exclude elements
- **Add Mode**: Start empty, click to include specific elements
- **Text Highlighting**: Select text and highlight with 6 fluorescent colors
- **Obsidian Format**: Exports as Markdown with YAML frontmatter
- **Multiple Export Options**: Copy as text, image, or share

## Installation

1. Open Chrome and go to `chrome://extensions`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `obsidian-web-clipper` folder

## Usage

1. Navigate to any web page
2. Click the extension icon in the toolbar
3. Choose a mode:
   - **Remove**: All content is selected. Click elements to exclude them.
   - **Add**: Nothing is selected. Click elements to include them.
4. Optionally select a highlight color, then select text to highlight
5. Click "Capture" when ready
6. **Obsidian opens automatically** with your new note ready to save

## Output Format

Clipped content is formatted as standard Obsidian Markdown:

```markdown
---
title: "Page Title"
source: https://example.com/article
date: 2024-01-15
tags: [web-clip]
---

# Page Title

> [!info] Source
> https://example.com/article

---

Your clipped content here with ==highlights== (Yellow) color preserved.
```

## Keyboard Shortcuts

While clipping:
- `Escape`: Cancel and exit
- `Enter`: Capture current selection
- `Ctrl/Cmd + Z`: Undo last highlight

## Settings

Access settings via right-click on extension icon > Options:

- **Vault Name**: Reference name for your Obsidian vault
- **Default Folder**: Suggested folder path for clips
- **Date Format**: Format for dates in frontmatter
- **Default Tags**: Tags added to every clip
- **Frontmatter Options**: Choose which properties to include
- **Custom Templates**: Create templates for different content types

## Differences from Logseq Version

| Feature | Logseq | Obsidian |
|---------|--------|----------|
| Metadata | `key:: value` | YAML frontmatter |
| Structure | Bullet blocks (`- `) | Standard Markdown |
| Highlights | `==text== (Color)` | `==text== (Color)` |
| Callouts | N/A | `> [!info]` syntax |

## License

MIT
