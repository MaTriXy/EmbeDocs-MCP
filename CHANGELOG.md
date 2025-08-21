# Changelog

## [1.4.0] - 2025-08-21

### 🚨 BREAKING CHANGE
- **Removed all hardcoded repositories** - The system no longer includes any pre-configured repositories
- Users now have complete control over what gets indexed

### ✨ Features
- **User-controlled repository management** - All repositories must be explicitly added by users
- **Metadata-based system** - Repositories stored in `.repos/metadata.json`
- **Web UI saves metadata** - Selected repositories automatically saved for CLI access
- **Helpful empty state messages** - Clear instructions when no repositories configured

### 🔧 Technical Changes
- Modified `getRepositories()` to read from `.repos/metadata.json` instead of hardcoded config
- Web Coordinator now saves repository metadata when indexing
- Config repositories array is now empty by default
- CLI commands read from user-defined metadata

### 📝 Documentation
- Updated README to reflect new repository management system
- Added clear instructions for adding repositories
- Removed outdated indexing command examples
- Added troubleshooting for "No repositories configured" message

### 🔒 Security
- Users can now safely index private repositories without mixing with public defaults
- Complete control over what documentation gets indexed

## [1.3.5] - Previous
- Token limit handling improvements
- Character-level splitting for edge cases
- Network resilience for API errors
- Empty array bug fixes