import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export function buildEnv(extensionsDir: string): Record<string, string> {
    const env = {...process.env}
    env.PYTHONPATH = `${extensionsDir}${path.delimiter}${env.PYTHONPATH || ''}`
    env.PYTHONDONTWRITEBYTECODE = '1'

    return env
}

export function createVirtualRunner(extensionsDir: string, extFile: string): string {

    const template = `
import sys, json, importlib, pathlib
import importlib.util

EXT_DIR = ${JSON.stringify(extensionsDir)}
if EXT_DIR not in sys.path:
    sys.path.insert(0, EXT_DIR)

from common.api import ExtensionAPI
file_path = pathlib.Path(${JSON.stringify(extFile)})
spec = importlib.util.spec_from_file_location("user_extension", file_path)
ext  = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ext)

if __name__ == "__main__":
    payload = sys.stdin.read()
    api = ExtensionAPI().load(**json.loads(payload))
    ext.extension(api)
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

from common.api import ExtensionAPI

# Load the extension module
file_path = pathlib.Path(${JSON.stringify(extFile)})
spec = importlib.util.spec_from_file_location("user_extension", file_path)
ext = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ext)

requests_lock = threading.Lock()

def handle_request(request_data):
    # create API instance
    api = ExtensionAPI()
    api.load(**request_data)

    try:
        ext.extension(api)
    except Exception as e:
        api._dump('error', content=traceback.format_exc())

def process_request_async(request_data):
    """Process a single request in a separate thread"""
    thread = threading.Thread(target=handle_request, args=(request_data,), daemon=True)
    thread.start()

if __name__ == "__main__":
    try:
        while True:
            line = sys.stdin.readline()
            if not line:
                break

            request_data = json.loads(line.strip())
            process_request_async(request_data)
    except KeyboardInterrupt:
        pass
    `

    const tempFile = path.join(os.tmpdir(), `persistent_extension_runner_${Date.now()}.py`)
    fs.writeFileSync(tempFile, template.trim())

    return tempFile
}