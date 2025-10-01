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

export function createPersistentRunner(extensionsDir: string, moduleName: string): string {
    const template = `
import os
import requests
import sys, json, pathlib, threading, traceback
import importlib

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

requests_lock = threading.Lock()

host = os.environ['HOST']
port = int(os.environ['PORT'])
uuid = os.environ['EXTENSION_UUID']

def send_error(content: str):
    data = {'method': 'error', 'content': content }
    data['meta_data'] = {'request_id': ''}
    requests.post(f'http://{host}:{port}/api/extension/response/{uuid}', json=data)

def handle_request():
    try:
        entry_fn()
    except Exception as e:
        send_error(traceback.format_exc())

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
    except KeyboardInterrupt:
        pass
    `

    const tempFile = path.join(os.tmpdir(), `persistent_extension_runner_${Date.now()}.py`)
    fs.writeFileSync(tempFile, template.trim())

    return tempFile
}