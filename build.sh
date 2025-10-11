#!/bin/bash

# IDE Build Script for macOS
# This script builds the desktop application

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'  # No Color

# Print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_prompt() {
    echo -e "${YELLOW}[PROMPT]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Parse command line arguments
parse_arguments() {
    VOICE_API_URL=""  # Initialize at the start of parse_arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --voice)
                if [ -n "$2" ] && [ "${2:0:1}" != "-" ]; then
                    VOICE_API_URL="$2"
                    shift 2
                else
                    print_error "--voice requires a URL argument"
                    exit 1
                fi
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --voice <URL>    Set the transcription API endpoint URL (optional)"
                echo "  -h, --help       Show this help message"
                echo ""
                exit 0
                ;;
            *)
                # Ignore unknown arguments for backward compatibility
                shift
                ;;
        esac
    done
}

# Detect and configure Python path
setup_python_config() {
    local config_dir="$HOME/.notbadaiide"
    local config_file="$config_dir/config.yaml"
    
    # Check if config already exists
    if [ -f "$config_file" ]; then
        print_status "Configuration file already exists at $config_file"
        print_status "Skipping Python configuration setup"
        return
    fi
    
    print_status "Setting up Python configuration..."
    
    local python_path=""
    if command_exists python; then
        python_path=$(which python)
    elif command_exists python3; then
        python_path=$(which python3)
    fi
    
    # Check if Python is installed
     if [ -z "$python_path" ]; then
        print_error "Python is not installed on your system."
        echo ""
        echo "Please install Python first:"
        echo ""
        echo "  Recommended: Install Miniconda (lightweight Python distribution)"
        echo "  1. Download Miniconda for macOS:"
        echo "     For Apple Silicon: https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-arm64.sh"
        echo "     For Intel: https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-x86_64.sh"
       	echo ""
        echo "  2. Install Miniconda:"
        echo "     bash ~/Downloads/Miniconda3-latest-MacOSX-*.sh"
        echo ""
        echo "  3. After installation, restart your terminal and run this script again."
        echo ""
        echo "  Alternative options:"
        echo "    - Download from https://www.python.org/downloads/"
        echo "    - Use Homebrew: brew install python"
        echo ""
        exit 1
    fi
    
    # Get Python version
    local python_version=$($python_path --version 2>&1)
    
    echo ""
    print_prompt "Detected Python installation:"
    echo "  Path: $python_path"
    echo "  Version: $python_version"
    echo ""
    
    # Ask user for confirmation with proper error handling
    print_prompt "Is this the Python environment you want to use? (y/n): "
    read -r REPLY </dev/tty
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Python path not confirmed."
        echo ""
        echo "Please activate your desired Python environment and run this script again."
        echo "For example:"
        echo "  - If using conda: conda activate your-env"
        echo "  - If using venv: source /path/to/venv/bin/activate"
        echo ""
        exit 1
    fi
    
    # Create config directory if it doesn't exist
    mkdir -p "$config_dir"
    
    # Copy default config and update python_path
    print_status "Creating configuration file at $config_file"
    
    # Read default config and replace python_path
    if [ -f "config.default.yaml" ]; then
        sed "s|python_path:|python_path: $python_path|g" config.default.yaml > "$config_file"
        print_status "Configuration file created successfully"
    else
        print_error "config.default.yaml not found. Cannot create configuration."
        exit 1
    fi
    
    echo ""
    print_status "Python configuration complete!"
    echo "  Config location: $config_file"
    echo "  Python path: $python_path"
}

# Initialize git submodules
init_submodules() {
    print_status "Initializing git submodules..."
    git submodule update --init --recursive
    print_status "Git submodules initialized successfully"
}

# Create environment configuration file
create_env_config() {
    print_status "Creating environment configuration..."

    # Create env.ts file with the provided voice API URL
    if [ -n "$VOICE_API_URL" ]; then
        print_status "Configuring transcription API endpoint: $VOICE_API_URL"
        cat > ui/src/env.ts << EOF
export const TRANSCRIPTION_API_ENDPOINT: string = '$VOICE_API_URL'
EOF
    else
        cat > ui/src/env.ts << 'EOF'
export const TRANSCRIPTION_API_ENDPOINT: string = ''
EOF
    fi
    print_status "Created ui/src/env.ts file"
}

# Install Node.js using official installer or NVM
install_nodejs() {
    print_status "Installing Node.js and npm..."

    # Check if Node.js is already installed with correct version
    if command_exists node; then
        node_version=$(node --version)
        major_version=$(echo $node_version | sed 's/v\([0-9]*\).*/\1/')
        if [ "$major_version" -ge 16 ]; then
            print_status "Node.js $node_version is already installed and compatible."
            return
        else
            print_warning "Node.js $node_version is installed but outdated. Installing newer version..."
        fi
    fi

    # Try to install via NVM first (most reliable)
    if ! command_exists nvm; then
        print_status "Installing Node Version Manager (NVM)..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

        # Source nvm
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
    fi

    # Install Node.js via NVM
    if command_exists nvm; then
        print_status "Installing Node.js via NVM..."
        nvm install --lts
        nvm use --lts
    else
        # Fallback to official installer
        print_status "NVM installation failed. Please install Node.js manually:"
        echo ""
        echo "Option 1: Download from official website"
        echo "  Visit: https://nodejs.org/"
        echo "  Download the macOS Installer (.pkg file)"
        echo "  Run the installer"
        echo ""
        echo "Option 2: Use the official installer via command line"
        echo "  For Apple Silicon Macs:"
        echo "  curl -O https://nodejs.org/dist/v20.9.0/node-v20.9.0.pkg"
        echo "  sudo installer -pkg node-v20.9.0.pkg -target /"
        echo ""
        echo "  For Intel Macs:"
        echo "  curl -O https://nodejs.org/dist/v20.9.0/node-v20.9.0.pkg"
        echo "  sudo installer -pkg node-v20.9.0.pkg -target /"
        echo ""
        print_error "Please install Node.js and run this script again."
        exit 1
    fi

    # Verify installation
    if command_exists node && command_exists npm; then
        node_version=$(node --version)
        npm_version=$(npm --version)
        print_status "Node.js version: $node_version"
        print_status "npm version: $npm_version"
    else
        print_error "Node.js installation failed. Please install manually."
        exit 1
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    npm install
}

# Build and package application
build_package() {
    print_status "Building and packaging the application..."
    
    # Clean and prepare directories
    rm -rf dist*
    mkdir -p dist/js/sourcemaps
    
    # Copy static files
    if [ -d "ui/static" ]; then
        cp -r ui/static/* dist/
        # Create 404.html as a copy of index.html
        if [ -f "dist/index.html" ]; then
            cp dist/index.html dist/404.html
        fi
    fi
    
    # Copy xterm files
    mkdir -p dist/xterm
    if [ -f "node_modules/@xterm/xterm/css/xterm.css" ]; then
        cp node_modules/@xterm/xterm/css/xterm.css dist/xterm/
    fi
    if [ -f "node_modules/@xterm/xterm/lib/xterm.js" ]; then
        cp node_modules/@xterm/xterm/lib/xterm.js dist/xterm/
    fi
    
    # Build SASS
    print_status "Building SASS..."
    npm run build:sass
    
    # Build UI
    print_status "Building UI..."
    npm run build:ui
    
    # Build Electron
    print_status "Building Electron backend..."
    npm run build:electron
    
    # Package Electron app
    print_status "Packaging Electron application..."
    npm run package:electron
}

# Post-installation instructions
post_build_info() {
    print_status "Installation completed successfully!"
    echo ""
    # Get package name and version from package.json
    local pkg_name=$(node -p "require('./package.json').name")
    local pkg_version=$(node -p "require('./package.json').version")
    
    # Detect platform and architecture
    local platform=$(uname -s | tr '[:upper:]' '[:lower:]')
    local arch=$(uname -m)
    
    # Map architecture names to electron-packager format
    case "$arch" in
        x86_64) arch="x64" ;;
        arm64|aarch64) arch="arm64" ;;
    esac
    
    local app_folder="${pkg_name}-v${pkg_version}-${platform}-${arch}"
    local app_name="${pkg_name}-v${pkg_version}.app"
    local app_path="$(pwd)/dist/desktop/${app_folder}/${app_name}"
    
    print_status "Build location: ${app_path}"
    echo ""
    
    # Install to Applications by default
    local generic_app_name="IDE.app"
    local dest_path="/Applications/${generic_app_name}"
    
    # Inform user if replacing existing version
    if [ -e "$dest_path" ]; then
        print_status "Removing existing IDE installation at ${dest_path}..."
        if rm -rf "$dest_path"; then
            print_status "✓ Old version removed successfully"
        else
            print_error "Failed to remove old version"
            print_warning "You may need administrator permissions"
            print_prompt "Try with sudo? (y/n): "
            read -r use_sudo </dev/tty
            echo ""
            if [[ $use_sudo =~ ^[Yy]$ ]]; then
                sudo rm -rf "$dest_path"
            else
                print_error "Cannot proceed without removing old version"
                return 1
            fi
        fi
    fi
    
    print_status "Installing IDE to Applications folder..."
    if cp -R "${app_path}" "$dest_path"; then
        print_status "✓ IDE installed successfully to ${dest_path}"
        echo ""
        print_status "Build complete! 🎉"
        echo ""
        print_prompt "Open IDE now? (y/n): "
        read -r open_now </dev/tty
        echo ""
        if [[ $open_now =~ ^[Yy]$ ]]; then
            open "$dest_path"
        else
            print_status "You can open IDE later from your Applications folder"
        fi
    else
        print_error "Failed to copy to Applications folder"
        print_warning "You may need administrator permissions"
        print_status "Application built successfully at:"
        print_status "${app_path}"
    fi
}

# Parse config.yaml and extract package names
parse_packages_from_config() {
    local config_file="$1"
    local packages=()
    
    # Check if config file exists
    if [ ! -f "$config_file" ]; then
        echo ""  # Return empty array
        return 1
    fi
    
    # Extract chat extensions using grep with context
    while IFS= read -r line; do
        line=$(echo "$line" | sed 's/^[[:space:]]*-[[:space:]]*//' | sed 's/[[:space:]]*$//')
        [ -n "$line" ] && packages+=("$line")
    done < <(grep -A 10 '^chat:' "$config_file" | grep '^[[:space:]]*-' | head -20)
    
    # Extract apply extension
    local apply_pkg=$(grep '^apply:' "$config_file" | sed 's/^apply:[[:space:]]*//' | sed 's/[[:space:]]*$//')
    [ -n "$apply_pkg" ] && packages+=("$apply_pkg")
    
    # Extract symbol_lookup extension
    local lookup_pkg=$(grep '^symbol_lookup:' "$config_file" | sed 's/^symbol_lookup:[[:space:]]*//' | sed 's/[[:space:]]*$//')
    [ -n "$lookup_pkg" ] && packages+=("$lookup_pkg")
    
    # Extract autocomplete extension
    local autocomplete_pkg=$(grep '^autocomplete:' "$config_file" | sed 's/^autocomplete:[[:space:]]*//' | sed 's/[[:space:]]*$//')
    [ -n "$autocomplete_pkg" ] && packages+=("$autocomplete_pkg")
    
    # Extract tools extensions using grep with context
    while IFS= read -r line; do
        # Try to extract quoted value first
        local extracted=$(echo "$line" | sed -n 's/.*extension:[[:space:]]*"\([^"]*\)".*/\1/p')
        # If no quoted value, try unquoted
        if [ -z "$extracted" ]; then
            extracted=$(echo "$line" | sed -n 's/.*extension:[[:space:]]*\([^[:space:]]*\).*/\1/p')
        fi
        # Trim whitespace
        extracted=$(echo "$extracted" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        [ -n "$extracted" ] && packages+=("$extracted")
    done < <(grep -A 100 '^tools:' "$config_file" | grep 'extension:' | head -20)
    
    # Remove duplicates and empty entries
    packages=($(printf "%s\n" "${packages[@]}" | sort -u | grep -v '^$'))
    
    # Return packages as newline-separated list
    printf "%s\n" "${packages[@]}"
    return 0
}

# Install Python packages
install_python_packages() {
    print_status "Installing Python packages..."
    
    local config_dir="$HOME/.notbadaiide"
    local config_file="$config_dir/config.yaml"
    
    # Check if config file exists
    if [ ! -f "$config_file" ]; then
        print_warning "Config file not found at $config_file"
        print_warning "Skipping Python package installation"
        return
    fi
    
    # Determine pip command based on which Python was configured
    # Read the python_path from config to determine which pip to use
    local python_path=$(grep "^python_path:" "$config_file" | sed 's/python_path:[[:space:]]*//')
    local pip_cmd="pip"
    
    if [[ "$python_path" == *"python3"* ]]; then
        pip_cmd="pip3"
    fi
    
    # Verify pip command exists
    if ! command_exists $pip_cmd; then
        print_error "$pip_cmd is not installed"
        print_warning "Trying alternative pip command..."
        if [ "$pip_cmd" = "pip3" ]; then
            pip_cmd="pip"
        else
            pip_cmd="pip3"
        fi
        
        if ! command_exists $pip_cmd; then
            print_error "No pip command found"
            print_warning "Skipping Python package installation"
            return
        fi
    fi
    
    print_status "Using pip command: $pip_cmd (matches Python at $python_path)"
    
    # Parse packages from config
    local packages=()
    while IFS= read -r line; do
        [ -n "$line" ] && packages+=("$line")
    done < <(parse_packages_from_config "$config_file")
    
    # Debug: print parsed packages
    print_status "Parsed packages from config:"
    for package in "${packages[@]}"; do
        print_status "  - $package"
    done
    echo ""
    
    # Always install the base IDE package first
    print_status "Installing notbadai_ide (base package)..."
    if $pip_cmd install "notbadai_ide" --upgrade; then
        print_status "✓ notbadai_ide installed successfully"
    else
        print_error "Failed to install notbadai_ide"
        print_warning "Continuing with remaining packages..."
    fi
    
    # Install each package from config
    if [ ${#packages[@]} -eq 0 ]; then
        print_warning "No extension packages found in config.yaml"
    else
        print_status "Found ${#packages[@]} extension package(s) in config.yaml"
        for package in "${packages[@]}"; do
            print_status "Installing $package..."
            if $pip_cmd install "$package" --upgrade; then
                print_status "✓ $package installed successfully"
            else
                print_error "Failed to install $package"
                print_warning "Continuing with remaining packages..."
            fi
        done
    fi
    
    echo ""
    print_status "Python packages installation completed!"
}

# Main execution
main() {
    print_status "Starting IDE build process..."
    echo ""

    # Parse arguments first (this is optional - script works without any args)
    parse_arguments "$@"

    init_submodules
    create_env_config
    setup_python_config
    install_nodejs
    install_dependencies
    build_package
    install_python_packages
    post_build_info

    print_status "Build script completed!"
}

# Run main function with all arguments
main "$@"