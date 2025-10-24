# NotBadAI IDE

A code editor with AI assistance. It supports chat, apply changes, autocomplete, and inline gray completions etc. These AI
features ***(extensions)*** are simple Python scripts, so you can easily modify them, create your own, and quickly try out new code tool
ideas.

***We call these AI features extensions.***

## Documentation

For setting up a development environment and detailed information on using extensions and developing/modifying your own, please see our [documentation](https://github.com/notbadai/ide/blob/main/docs/README.md).

## Installation

### Quick Install & Update

Install or update IDE with a single command (clones/update the repo and builds automatically):

```bash
curl -sSL https://raw.githubusercontent.com/notbadai/ide/main/install.sh | bash
```

The packaged application will be available in the `ide/dist/desktop/` directory.

## Setup

<img src="https://github.com/notbadai/ide/blob/main/docs/images/image.001.png" alt=""/>

To use the AI features, you need to complete the following setup:

**1. Setting Up API Keys**

Configure API keys for your AI model providers by navigating to `Extensions → Management` from the left panel. This will open the configuration YAML file located at `~/.notbadaiide/config.yaml`.

Add at least one provider with your API key. You can add one or both providers, and remove any that you don't plan to use:

```yaml
  - provider: "openrouter"
    key: "<YOUR-KEY>"
    default: true
  - provider: "deepinfra"
    key: "<YOUR-KEY>"
```

***Important: Add an OpenRouter API key to enable the code apply feature. Other provider we support do not have the model we use to apply changes.***

## Features

<img src="https://github.com/notbadai/ide/blob/main/docs/images/image.003.png" alt=""/>

#### 1. Chat

Lets you talk to your LLM directly from the editor. You can ask for code
explanations, code suggestions, and edits.

You can access this from the left-side pane.

- You can select a Chat extension to run from the dropdown menu.
- In the `default` chat extension, the context sent to the LLM includes only the currently open tabs.
- You can manually add more context, such as additional files or folders using the `+ context` option.
- The `files` extension automatically determines the relevant context to include, ignoring open tabs and any manually
  added context.
- In both extensions, the last 1,000 lines of current terminal are also included in the context sent to the LLM.

#### 2. Apply

Lets you review and apply code suggestions from the LLM. You can see a diff, accept the changes, or discard them with a
click.

When the chat provides a code suggestion, it appears inside a code block.
Each code block includes an `Apply` button:

- Click `Apply` to review a diff between your current file and the suggested code.
- Click `Accept` to apply the changes (the file will be updated) or `Reject` to discard the suggestion (in the diff
  view).
- If the file doesn’t exist, you’ll be prompted to create it.
- Click `Apply All` to review every code block. Choosing `Accept` or `Reject` will automatically move you to the next
  block.

#### 3. Autocomplete

Provides smart single-line suggestions as you type.

Works like most code editors: as you type, a suggestion popup appears, allowing you to pick from a list of
options. Open tabs are automatically used as context to provide more accurate suggestions. Press `Shift+Cmd+Space`
trigger autocomplete suggestions manually.

#### 4. Gray Code Completions

<img src="https://github.com/notbadai/ide/blob/main/docs/images/image.002.png" alt=""/>

Shows inline ghost-text suggestions, single or multi-line, to help you complete code quickly.

Press `Ctrl + M` to trigger Gray Code completion in the editor.

- Press `Tab` to accept the suggestion.
- Press `Esc` to dismiss it.

#### 5. Source Control

Access this tool from the left-side pane. When the search bar is focused, all available tools will be displayed, and you
can search for specific tools.
This tool provides Git integration with commit and push functionality. When selected, it automatically generates a
commit message based on your Git diffs. You can then push your commits to the remote repository directly from the
interface.

#### 6. Voice

This is an experimental feature. To use voice, toggle `Caps Lock` on to start and off to stop.
When you start voice input, the current active chat will be rendered, and the transcribed text will appear in the chat
input box. Setup instructions are available in the [documentation](https://github.com/notbadai/ide/blob/main/docs/README.md#setting-up-voice)


## Community

Join our Discord server to connect with other users, get support, and discuss features:

[Join our Discord](https://discord.gg/PaDEsZ6wYk)
