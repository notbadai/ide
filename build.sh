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
    
    # Check if Python is installed
    if ! command_exists python; then
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
    
    # Detect Python path
    local python_path=$(which python)
    
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

    # Create env.ts file if it doesn't exist
    if [ ! -f "ui/src/env.ts" ]; then
        cat > ui/src/env.ts << 'EOF'
export const TRANSCRIPTION_API_ENDPOINT: string = ''
EOF
        print_status "Created ui/src/env.ts file"
    else
        print_warning "ui/src/env.ts already exists, skipping creation"
    fi
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
    print_status "The packaged application is available in the 'ide/dist/desktop/' directory."
    echo ""
    print_status "To run the application:"
    echo "  cd ide/dist/desktop/"
    echo "  open ide-v*.app"
    echo ""
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
    
    # Extract chat extensions (handle list items starting with -)
    while IFS= read -r line; do
        # Extract value after the dash, trim whitespace
        line=$(echo "$line" | sed 's/^\s*-\s*//;s/\s*$//')
        [ -n "$line" ] && packages+=("$line")
    done < <(awk '/^chat:/{flag=1;next}/^[a-z_]+:/{flag=0}flag&&/^\s*-\s*/{print}' "$config_file")
    
    # Extract apply extension
    local apply_pkg=$(awk -F': *' '/^apply:/{print $2}' "$config_file" | sed 's/\s*$//')
    [ -n "$apply_pkg" ] && packages+=("$apply_pkg")
    
    # Extract symbol_lookup extension
    local lookup_pkg=$(awk -F': *' '/^symbol_lookup:/{print $2}' "$config_file" | sed 's/\s*$//')
    [ -n "$lookup_pkg" ] && packages+=("$lookup_pkg")
    
    # Extract autocomplete extension
    local autocomplete_pkg=$(awk -F': *' '/^autocomplete:/{print $2}' "$config_file" | sed 's/\s*$//')
    [ -n "$autocomplete_pkg" ] && packages+=("$autocomplete_pkg")
    
    # Extract tools extensions - look for extension field and remove quotes
    while IFS= read -r line; do
        # Extract value after extension:, remove quotes and whitespace
        line=$(echo "$line" | awk -F': *' '{print $2}' | sed 's/"//g;s/\s*$//')
        [ -n "$line" ] && packages+=("$line")
    done < <(awk '/^tools:/{flag=1}/^[a-z_]+:/{if(!/^tools:/)flag=0}flag&&/extension:/{print}' "$config_file")
    
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
    
    # Parse packages from config
    local packages=()
    while IFS= read -r line; do
        [ -n "$line" ] && packages+=("$line")
    done < <(parse_packages_from_config "$config_file")
    
    # Always install the base IDE package first
    print_status "Installing notbadai_ide (base package)..."
    if pip install "notbadai_ide" --upgrade; then
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
            if pip install "$package" --upgrade; then
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

# Run main function
main "$@"