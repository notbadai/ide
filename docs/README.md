# NotBadAI IDE

## Developer

Follow these steps to set up the development environment.

1. Initialize and update git submodules:

```bash
 git submodule update --init --recursive
```

2. Create an `env.ts` file in `ui/src/` and add the following configuration:

```typescript
export const TRANSCRIPTION_API_ENDPOINT: string = ''
```

3. install the packages

```bash
npm install
```

4. To compile frontend assets and automatically recompile when changes are made:

```bash
make watch
```

To build and package the Electron application into a distributable format run:

```bash
make package
```

The packaged application will be available in the `dist/desktop/` directory.

## Code Editor

The code editor supports shortcuts similar to VS
Code. [Here](https://github.com/notbadai/ide/blob/main/docs/shortcuts.md)’s a list of the popular
ones.

## Terminal

Multiple terminals are supported. To reset a terminal, including clearing its display and scrollback history, right-click the terminal tab and select `Clear Buffer`.

## Extensions

Extensions are Python scripts that enable interactions with LLMs, such as chat, code apply, autocomplete, gray
completions etc. You can also create your own extensions, which the editor will manage and execute (explained in a later
section).

### Extension Errors

<img src="https://github.com/notbadai/ide/blob/main/docs/images/image.004.png" alt=""/>

If an extension encounters any errors during execution, they will appear under `Extensions` → `Errors`. It will
provide details such as error messages and stack traces to help you debug and resolve the issue.

### Running Extensions

<img src="https://github.com/notbadai/ide/blob/main/docs/images/image.005.png" alt=""/>

Extensions that are currently running will be listed under `Extensions` → `Running`.
From this tab, you can:

- Terminate any active extension.
- Monitor progress, as extensions that send progress updates will display a progress bar here.

### Extension Updates and Notifications

- If an extension sends an update, it will appear under `Extensions` → `Updates`.
- If an extension sends a notification, it will be shown under `Extensions` → `Notifications`.

## Developing Your Own Extensions

To use your own set of extensions, create a directory named `extensions` at the root level of your project.
All Python modules in this directory will be automatically added to the Python path, making them available for use by the IDE.

The easiest way to get started is to copy
the [default extensions](https://github.com/notbadai/extensions) into your project (top level) and
customize it as needed.

### 1. config.yaml

<img src="https://github.com/notbadai/ide/blob/main/docs/images/image.006.png" alt=""/>

All extension-related settings are defined in [config.yaml](https://github.com/notbadai/ide/blob/main/config.default.yaml).
From this file, you can configure the main entry file and other settings for each extension.

Any errors in the `config.yaml` file will be displayed in the `Extensions` tab.

#### `config.yaml` Priority

By default, the IDE uses the system-wide configuration located at `Extensions → Management`.

You can override these defaults by creating a `config.yaml` file in your project's root-level `extensions/` directory. This local configuration takes precedence over system-wide settings, enabling per-project customization and easier extension development.


### 2. Extension API

The [ExtensionAPI](https://github.com/notbadai/notbadai_ide/blob/main/notbadai_ide/api.py)
defines:

- The data passed from the editor to the extension.
- The utility functions available for extensions to interact with the editor.
- Can be imported in your extension using `from notbadai_ide import api`

Every extension must include a function with the following definition:

```python
from notbadai_ide import api

def start():
    pass
``` 

This function is executed by the editor when the extension runs.

### 3. Debug Logs

During extension development, you can add debug logs using the [
`log`](https://github.com/hnipun/extensions/blob/32a86209fb968d1b157d72ef73e43d2a95452523/common/api.py#L234)  function
provided by the ExtensionAPI.

These logs are generated each time the extension runs.

To view the logs:

- Go to `View` → `Toggle Developer Tools`

- Or use the shortcut `Shift+Cmd+I` 

## Setting Up Voice

### Server Setup

We’ve tested [faster-whisper-server](https://github.com/etalab-ia/faster-whisper-server/tree/master) as the backend for
transcription.  
It’s quite fast and easy to set up.

1. Run the transcription server.
2. Install the IDE with voice support enabled:

```bash
curl -sSL https://raw.githubusercontent.com/notbadai/ide/main/install.sh | bash -s -- --voice "<URL>"
```