import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export function buildEnv(extensionsDir: string, uuid: string, host: string, port: number): Record<string, string> {
    const env = {...process.env}
    env.PYTHONPATH = `${extensionsDir}${path.delimiter}${env.PYTHONPATH || ''}`
    env.PYTHONDONTWRITEBYTECODE = '1'
    env.EXTENSION_UUID = uuid
    env.HOST = host
    env.PORT = `${port}`

    return env
}

export function createVirtualRunner(extensionsDir: string, moduleName: string): string {
    const template = `
import sys, json, importlib, pathlib

EXT_DIR = ${JSON.stringify(extensionsDir)}
if EXT_DIR not in sys.path:
    sys.path.insert(0, EXT_DIR)

# Import the extension module
module_name = ${JSON.stringify(moduleName)}
ext_module = importlib.import_module(module_name)

# Read settings to find entry point
settings_module = importlib.import_module(f"{module_name}.settings")
entry_point_name = getattr(settings_module, 'ENTRY_POINT', 'extension')

# Get the entry point function
entry_fn = getattr(ext_module, entry_point_name, None)
if entry_fn is None:
    raise AttributeError(f"Entry point '{entry_point_name}' not found in module '{module_name}'")

if __name__ == "__main__":
    entry_fn()
    `

    const tempFile = path.join(os.tmpdir(), `extension_runner_${Date.now()}.py`)
    fs.writeFileSync(tempFile, template.trim())

    return tempFile
}

export function createPersistentRunner(extensionsDir: string, extFile: string): string {
    const template = `
import sys, json, pathlib, threading, traceback
import importlib.util

EXT_DIR = ${JSON.stringify(extensionsDir)}
if EXT_DIR not in sys.path:
    sys.path.insert(0, EXT_DIR)

from notbadai.common.api import ExtensionAPI

# Load the extension module
file_path = pathlib.Path(${JSON.stringify(extFile)})
spec = importlib.util.spec_from_file_location("user_extension", file_path)
ext = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ext)

requests_lock = threading.Lock()

def handle_request():
    # create API instance
    api = ExtensionAPI()
    api.load()

    try:
        ext.extension(api)
    except Exception as e:
        api._dump('error', content=traceback.format_exc())

def process_request_async():
    """Process a single request in a separate thread"""
    thread = threading.Thread(target=handle_request, daemon=True)
    thread.start()

if __name__ == "__main__":
    try:
        while True:
            line = sys.stdin.readline()
            if not line:
                break
            line = line.strip()
            if line == "PROCESS_REQUEST":
                process_request_async()
            else:
                break
            process_request_async()
    except KeyboardInterrupt:
        pass
    `

    const tempFile = path.join(os.tmpdir(), `persistent_extension_runner_${Date.now()}.py`)
    fs.writeFileSync(tempFile, template.trim())

    return tempFile
}