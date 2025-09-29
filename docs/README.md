# NotBadAI IDE

## Developer

To compile assets and watch for changes:

```bash
make watch
```

To build and package the Electron app for distribution in `dist/desktop/`:

```bash
make package
```

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
This will override all the default extensions, as the editor will use this directory as the extension path when
executing extensions.

The easiest way to get started is to copy
the [default extensions directory](https://github.com/hnipun/extensions/tree/main) into your project (top level) and
customize it as needed.

***Note: Default extensions are automatically downloaded to `~/.notbadaiide/extensions/` when you first run the application.***

### 1. config.yaml

<img src="https://github.com/notbadai/ide/blob/main/docs/images/image.006.png" alt=""/>

All extension-related settings are defined in [config.yaml](https://github.com/hnipun/extensions/blob/main/config.yaml).
From this file, you can configure the main entry file and other settings for each extension.

Any errors in the `config.yaml` file will be displayed in the `Extensions` tab.

### 2. Extension API

The [ExtensionAPI](https://github.com/hnipun/extensions/blob/main/common/api.py)
defines:

- The data passed from the editor to the extension.
- The utility functions available for extensions to interact with the editor.

Every extension’s main file must include a function with the following definition:

```python
def extension(api: ExtensionAPI):
    pass
``` 

This function is executed by the editor when the extension runs.

### 3. `extensions/common` directory

The `extensions/common` directory is automatically added to the Python path when running an extension.
This allows you to import shared utilities, or settings directly into your extensions without needing relative
paths.

example:

```python
from common.api import ExtensionAPI
from common.diff import get_matches
from common.settings import LLM_PROVIDERS
```

### 4. Debug Logs

During extension development, you can add debug logs using the [
`log`](https://github.com/hnipun/extensions/blob/32a86209fb968d1b157d72ef73e43d2a95452523/common/api.py#L234)  function
provided by the ExtensionAPI.

These logs are generated each time the extension runs.

To view the logs:

- Go to `View` → `Toggle Developer Tools`

- Or use the shortcut `Shift+Cmd+I` 
