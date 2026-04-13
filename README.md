# Shadcn Studio MCP Server

Build modern, production-ready UI blocks, components, and full pages in minutes using Shadcn Studio. Seamlessly integrates with your favorite IDE and supports the most popular frameworks like React, Next.js.

## 🚀 What is Shadcn Studio MCP Server?

Shadcn Studio MCP Server is a [Shadcn AI](https://shadcnstudio.com/mcp) builder that helps you create, inspire, refine, and convert Figma designs into stunning, production-ready blocks, UI components, and full pages using Shadcn Studio blocks. It easily integrates directly into your favorite IDE for a fast & efficient workflow.

Try Shadcn Studio MCP Server for free today.

## 🛠️ Installation

We've made installation super easy!

1. Access the [Installation Guide](https://shadcnstudio.com/mcp/onboarding) and select your IDE (VS Code, Cursor, Windsurf, etc.).
2. Follow the step-by-step instructions to set up the MCP Server in your IDE.
3. Start using Shadcn Studio MCP Server for **free**.

### Quick Setup (npx)

```json
{
  "mcpServers": {
    "shadcn-studio-mcp": {
      "command": "npx",
      "args": ["-y", "shadcn-studio-mcp"]
    }
  }
}
```

### Pro Users (with API Key & Email)

```json
{
  "mcpServers": {
    "shadcn-studio-mcp": {
      "command": "npx",
      "args": ["-y", "shadcn-studio-mcp", "API_KEY=your-api-key", "EMAIL=your@email.com"]
    }
  }
}
```

> **Note:** For freemium features, no credentials are needed. For pro features, both `API_KEY` and `EMAIL` are required.

## 📒 Documentation

Shadcn Studio MCP Server is designed to be intuitive and easy to use. The commands are simple and straightforward, allowing you to create, inspire, refine, and convert Figma designs to UI blocks quickly.

For detailed documentation on how to use Shadcn Studio MCP Server, please refer to the [Shadcn Studio MCP Documentation](https://shadcnstudio.com/docs/getting-started/shadcn-studio-mcp-server).

## 🔧 Usage

Shadcn Studio MCP Server provides four main workflows:

| Command | Description | Use Case |
|---------|-------------|----------|
| `/cui`  | Create UI | Customize and install from existing Shadcn Studio blocks |
| `/iui`  | Inspire UI | Generate new, creative UI blocks inspired by existing ones |
| `/rui`  | Refine UI | Refine, edit, or theme an existing block or page |
| `/ftc`  | Figma to Code | Convert Figma designs blocks directly to Shadcn Studio blocks |

See the complete documentation here: [Shadcn Studio MCP Documentation](https://shadcnstudio.com/docs/getting-started/shadcn-studio-mcp-server).

### Examples

**Create UI (`/cui`):**
```
/cui Create a hero section for an eLearning Academy site.
/cui Create a feature section for my SaaS landing page.
/cui Create a pricing section with a monthly/yearly toggle.
```

**Inspire UI (`/iui`):**
```
/iui Create a hero section for my AI SaaS - AI Video Generator.
/iui Create a feature section for my productivity app.
/iui Build a testimonials section inspired by modern design trends.
```

**Refine UI (`/rui`):**
```
/rui Update the theme to Modern Minimal.
/rui Replace the "Get Started" button with Login and Register buttons.
/rui Update the pricing card to Dynamic 3D Hover Card.
/rui Update the login button to animated ripple style.
```

**Figma to Code (`/ftc`):**
```
/ftc generate code for the selected figma frame using shadcn/studio blocks
/ftc Install matching shadcn/studio blocks for this design
```

## 📚 Documentation & Resources

- [Official Documentation](https://shadcnstudio.com/docs/getting-started/shadcn-studio-mcp-server)
- [Installation Guide](https://shadcnstudio.com/mcp/onboarding)
- [Shadcn Studio Blocks](https://shadcnstudio.com/blocks)
- [Shadcn Studio Components](https://shadcnstudio.com/components)
- [Shadcn Studio Themes](https://shadcnstudio.com/theme-generator)
- [Homepage](https://shadcnstudio.com)

## Community 🤝

Join the Shadcn Studio community to discuss the library, ask questions, and share your experiences:

- 🐦 [Follow us on Twitter](https://x.com/ShadcnStudio)
- 💬 [Discuss on GitHub](https://github.com/shadcnstudio/shadcn-mcp-server/discussions)
- 🎮 [Join us on Discord](https://discord.com/invite/kBHkY7DekX)

## Contributing 📝

Fix a bug, or add a new feature. You can make a pull request and see your code in the next version of Shadcn Studio MCP.

Before adding a pull request, please see the **[contributing guidelines](https://github.com/shadcnstudio/shadcn-studio/blob/main/CONTRIBUTING.md)**.