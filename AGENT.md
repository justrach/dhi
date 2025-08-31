# Agent Documentation

Last updated: 2025-08-30

## Overview

This is an AI-powered coding assistant agent built with TypeScript and Node.js. The agent provides intelligent code generation, file manipulation, shell command execution, and development assistance through a conversational interface.

## Core Principles

The agent operates on the following core principles:
- **Safety First**: Never execute harmful commands or assist with malicious intent
- **Minimal Action**: Prefer the least destructive approach to achieve goals
- **Verification**: Always verify actions before execution
- **Transparency**: Provide clear explanations of what actions are being taken

## Core Files

- `src/index.ts` - Main entry point and CLI setup with yargs for command parsing
- `src/core.ts` - Core agent logic including safety checks and session management
- `src/planner.ts` - Planning functionality with AI-powered task breakdown
- `src/tools.ts` - Tool management system for dynamic tool loading
- `src/utils.ts` - Utility functions for file operations, environment setup, and logging
- `src/types.ts` - TypeScript type definitions for agents, tools, and configurations

## Available Tools

- `parallel` - Execute multiple tools concurrently for improved performance
- `read_file` - Read file contents
- `write_file` - Create new files
- `apply_patch` - Apply patches to existing files
- `search_replace` - Simple text replacement
- `run_shell` - Execute shell commands
- `smart_run_shell` - Shell with auto-fix capabilities
- `get_system_info` - System diagnostics
- `update_plan` - Update development plans
- `talk` - Conversational responses
- `planner` - Task planning and breakdown
- `quick_check` - Quick project validation
- `websearch` - Web search capabilities
- `deepwiki` - DeepWiki integration
- `interactive_shell` - Interactive CLI commands with expect/send capabilities

## Usage Examples

```bash
# Interactive mode
npm start

# Direct command
node dist/index.js "Create a new React component"

# With specific tools
node dist/index.js "Read and analyze package.json"
```

## Recent Changes

### 2025-08-30
- Added parallel tool execution for concurrent operations
- Enhanced TypeScript configuration with strict mode
- Added comprehensive test suite with Jest
- Implemented automated release process with semantic versioning
- Added migration system for database changes
- Enhanced frontend with React and Vite setup
- Added benchmarking suite for performance testing
- Implemented comprehensive logging system
- Added support for interactive CLI operations

### 2025-01-28
- Initial agent setup
- Core tool implementation
- Basic file operations
- Shell command integration

## Development Setup

```bash
npm install
npm run dev
npm run build
npm test
```

## Configuration

Configuration is managed through:
- Environment variables (see `.env.example`)
- `package.json` configuration
- `tsconfig.json` for TypeScript settings
- `jest.config.ts` for testing configuration
- Migration files in `/migrations` directory

## Architecture Overview

The system follows a modular architecture with:
- Core agent runtime in `/src`
- Frontend applications in `/frontend` and `/frontend2`
- Benchmarking tools in `/benchmarks`
- Documentation in `/docs`
- Migration system in `/migrations`
- Build outputs in `/dist`