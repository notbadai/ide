#!/bin/bash

# IDE Installation Script for macOS
# This script clones the repository and builds the desktop application

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check for required tools
check_prerequisites() {
    print_status "Checking prerequisites..."

    if ! command_exists git; then
        print_error "Git is not installed. Please install Git first."
        exit 1
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

# Clone repository
clone_repo() {
    print_status "Cloning IDE repository..."

    if [ -d "ide" ]; then
        print_warning "Directory 'ide' already exists. Removing it..."
        rm -rf ide
    fi

    git clone https://github.com/notbadai/ide.git ide
    cd ide
    print_status "Successfully cloned and entered ide directory"
}

# Run the build script
run_build_script() {
    print_status "Running build script..."
    
    if [ ! -f "build.sh" ]; then
        print_error "build.sh not found in the cloned repository!"
        exit 1
    fi
    
    chmod +x build.sh
    ./build.sh
}

# Post-installation instructions
post_install_info() {
    print_status "Installation completed successfully!"
    echo ""
    print_status "The packaged application is available in the 'ide/dist/desktop/' directory."
    echo ""
    print_status "To run the application:"
    echo "  cd ide/dist/desktop/"
    echo "  open ai-ide-v*.app"
    echo ""
    print_status "Required Python packages for AI extensions:"
    echo "pip install openai requests GitPython black labml"
}

# Main execution
main() {
    print_status "Starting IDE installation process..."
    echo ""

    check_prerequisites
    install_nodejs
    clone_repo
    run_build_script
    post_install_info

    print_status "Installation script completed!"
}

# Run main function
main "$@"