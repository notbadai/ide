#!/bin/bash

# IDE Installation Script for macOS
# This script clones the repository and builds the desktop application

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Global variable for voice API URL
VOICE_API_URL=""

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

# Parse command line arguments
parse_arguments() {
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

# Check for required tools
check_prerequisites() {
    print_status "Checking prerequisites..."

    if ! command_exists git; then
        print_error "Git is not installed. Please install Git first."
        exit 1
    fi
}

# Clone repository
clone_repo() {
    print_status "Cloning IDE repository..."

    if [ -d "ide" ]; then
        print_warning "Directory 'ide' already exists. Updating repository..."
        cd ide
        
        # Check if it's a git repository
        if [ -d ".git" ]; then
            print_status "Pulling latest changes..."
            git fetch origin
            git reset --hard origin/main
            print_status "Repository updated successfully"
        else
            print_error "Directory 'ide' exists but is not a git repository. Please remove it manually."
            exit 1
        fi
    else
        git clone https://github.com/notbadai/ide.git ide
        cd ide
        print_status "Successfully cloned and entered ide directory"
    fi
}

# Run the build script
run_build_script() {
    print_status "Running build script..."
    
    if [ ! -f "build.sh" ]; then
        print_error "build.sh not found in the cloned repository!"
        exit 1
    fi
    
    chmod +x build.sh
    
    # Pass the voice API URL if provided
    if [ -n "$VOICE_API_URL" ]; then
        print_status "Using transcription API endpoint: $VOICE_API_URL"
        ./build.sh --voice "$VOICE_API_URL"
    else
        ./build.sh
    fi
}

# Main execution
main() {
    print_status "Starting IDE installation process..."
    echo ""

    # Parse arguments first (this is optional - script works without any args)
    parse_arguments "$@"
    
    check_prerequisites
    clone_repo
    run_build_script

    print_status "Installation script completed!"
}

# Run main function with all arguments
main "$@"