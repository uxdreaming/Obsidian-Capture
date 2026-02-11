// Template system for Obsidian Web Clipper

const Templates = {
  // Built-in templates
  builtIn: {
    article: {
      name: 'Article',
      template: `---
title: "{{title}}"
source: {{url}}
date: {{date}}
author: {{author}}
tags: [{{tags}}]
---

# {{title}}

> [!info] Source
> {{url}}

---

{{content}}`
    },
    video: {
      name: 'Video/YouTube',
      template: `---
title: "{{title}}"
source: {{url}}
date: {{date}}
type: video
tags: [video, {{tags}}]
---

# {{title}}

> [!info] Source
> {{url}}

---

## Notes

{{content}}`
    },
    tweet: {
      name: 'Tweet/Social',
      template: `---
title: "Tweet from {{author}}"
source: {{url}}
date: {{date}}
type: tweet
tags: [social, {{tags}}]
---

# Tweet from {{author}}

> {{content}}

[View original]({{url}})`
    },
    recipe: {
      name: 'Recipe',
      template: `---
title: "{{title}}"
source: {{url}}
date: {{date}}
type: recipe
tags: [recipe, {{tags}}]
---

# {{title}}

> [!info] Source
> {{url}}

---

## Ingredients

-

## Instructions

{{content}}`
    },
    bookmark: {
      name: 'Simple Bookmark',
      template: `---
title: "{{title}}"
source: {{url}}
date: {{date}}
tags: [bookmark, {{tags}}]
---

# [{{title}}]({{url}})

Clipped on {{date}}`
    },
    quote: {
      name: 'Quote',
      template: `---
title: "Quote from {{title}}"
source: {{url}}
date: {{date}}
tags: [quote, {{tags}}]
---

> {{selection}}

— [{{title}}]({{url}})`
    },
    research: {
      name: 'Research Note',
      template: `---
title: "{{title}}"
source: {{url}}
date: {{date}}
type: research
status: unprocessed
tags: [research, {{tags}}]
---

# {{title}}

> [!info] Source
> {{url}}

---

## Summary

_Add your summary here_

## Key Points

-

## Content

{{content}}

## My Notes

_Add your notes here_`
    }
  },

  // Parse template variables
  parse(template, data) {
    const variables = {
      title: data.title || 'Untitled',
      url: data.url || '',
      date: data.date || this.formatDate(new Date()),
      content: data.content || '',
      selection: data.selection || data.content || '',
      author: data.author || 'Unknown',
      tags: data.tags || 'web-clip'
    };

    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    }

    return result;
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

  // Get template by name (built-in or custom)
  async get(name) {
    if (this.builtIn[name]) {
      return this.builtIn[name].template;
    }
    // Check custom templates
    const custom = await Storage.getTemplates();
    if (custom[name]) {
      return custom[name];
    }
    return null;
  },

  // Get all available templates
  async getAll() {
    const custom = await Storage.getTemplates();
    const all = {};

    // Add built-in templates
    for (const [key, value] of Object.entries(this.builtIn)) {
      all[key] = { ...value, isBuiltIn: true };
    }

    // Add custom templates
    for (const [key, value] of Object.entries(custom)) {
      all[key] = { name: key, template: value, isBuiltIn: false };
    }

    return all;
  },

  // Validate template (check for required variables)
  validate(template) {
    const requiredVars = ['title', 'url'];
    const warnings = [];

    for (const v of requiredVars) {
      if (!template.includes(`{{${v}}}`)) {
        warnings.push(`Template is missing {{${v}}} variable`);
      }
    }

    return {
      valid: true,
      warnings
    };
  }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Templates;
}
