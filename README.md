# QuantNexus Official Plugins

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Official plugin collection for [QuantNexus](https://github.com/SilverstreamsAI/QuantNexus).

## Available Plugins

| Plugin | Category | Description |
|--------|----------|-------------|
| **data** | Data | Market data provider with multi-source support |
| **chart** | Visualization | Interactive charting component |
| **backtest** | Execution | Backtesting UI and workflow |
| **backtest-engine** | Execution | Python backtesting engine |
| **backtest-panel** | UI | Backtest results panel |
| **ai-analyzer** | Analysis | AI-powered market analysis |

## Installation

Plugins are automatically loaded by QuantNexus Desktop from two locations:

1. **Bundled Plugins**: Included with the installer (read-only)
2. **User Plugins**: `~/.config/QuantNexus/plugins/` (user-installed)

## Plugin Structure

Each plugin contains:

```
plugin-name/
├── manifest.json    # Plugin metadata and configuration
├── src/             # Source code
│   └── index.ts     # Entry point
├── dist/            # Compiled output
└── package.json     # Node.js config
```

## Development

### Create a New Plugin

Use the [Plugin Template](https://github.com/SilverstreamsAI/QuantNexus-plugin-template) to get started:

```bash
# Clone the template
git clone https://github.com/SilverstreamsAI/QuantNexus-plugin-template.git my-plugin
cd my-plugin

# Install and build
pnpm install
pnpm build
```

### Plugin Manifest

```json
{
  "id": "com.example.my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "main": "dist/index.js",
  "type": "ui",
  "permissions": ["network"],
  "contributes": {
    "sidePanel": {
      "id": "my-panel",
      "title": "My Panel",
      "icon": "settings"
    }
  }
}
```

## Contributing

See [QuantNexus Contributing Guide](https://github.com/SilverstreamsAI/QuantNexus/blob/main/CONTRIBUTING.md).

## License

[MIT](LICENSE)
