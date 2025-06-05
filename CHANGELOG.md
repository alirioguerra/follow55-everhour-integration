# Change Log

All notable changes to the "Follow55 - Everhour Integration" extension will be documented in this file.

## [1.1.0] - 2024-03-25
### Added
- New command to link workspace with Everhour project
  - Automatically associates current workspace with selected project
  - Persists project selection across sessions
  - Quick access to project tasks from any workspace

### Fixed
- Token validation and storage improvements
- Project selection persistence issues
- UI responsiveness during loading states


## [1.0.0] - 2024-03-21
### Added
- Pin functionality for weekly tasks
  - Users can pin/unpin tasks to VSCode's status bar
  - Only one task can be pinned at a time
  - Automatic unpinning of previously pinned task
  - Visual feedback through notifications

- Recent Projects Feature
  - Tracks last 3 selected projects
  - Quick access buttons for recent projects
  - Persistent storage between sessions
  - Visual indication of currently selected project

- Loading State Indicator
  - Spinning loader animation during startup
  - Loading message for better user feedback
  - Smooth transition to content
  - Consistent with VSCode's theming

### Improved
- Task Layout and UI
  - Two-line format for better readability
  - Task name on first line
  - Time and action buttons on second line
  - Improved spacing and typography
  - Monospace fonts for time display
  - Enhanced button hover effects

- Project Selection UI
  - Redesigned project selector layout
  - Full-width search and select inputs
  - Better organization of project-related elements
  - Improved visual hierarchy

### Fixed
- View registration issues that prevented extension display
- Mismatched view IDs between package.json and code
- State management issues with pinned tasks
- Various UI alignment and spacing issues

## [0.0.7] - Initial Release
- Basic time tracking functionality
- Project and task selection
- Time entry management
- Weekly tasks view
- Search functionality

## [0.0.6]
### Added
- Compatibility with earlier versions of VS Code (^1.90.0)

### Fixed
- Incompatibility between VS Code version and @types/vscode

## [0.0.5]
### Added
- Weekly task management
- Task search and filtering system
- Real-time timer for active task
- Daily and total time overview per task

### Improved
- More responsive user interface
- Better visual feedback during operations
- Optimized project loading

### Fixed
- Error handling in API communication
- Authentication token validation
- State synchronization across multiple windows

## [0.0.4] - 2024-03-27
### Added
- Combined filter support
- Improved visual highlight for active task
- Integration with VS Code WebView
- State management system

### Fixed
- Synchronization issues in large projects
- API error handling
- Validation of received data

### Changed
- Extension icon improved for better visibility
- Codebase refactored
- Better component organization

## [0.0.3] - 2024-03-20
### Added
- Support for multiple projects
- Request caching system
- UI improvements

### Fixed
- Performance issues with large lists
- Bugs in time synchronization

## [0.0.2] - 2024-03-15
### Added
- Token-based authentication system
- Basic task listing
- Basic time tracking

### Fixed
- Initialization issues
- Validation errors

## [0.0.1] - 2024-03-10
### Added
- Initial version of the extension with basic Everhour integration
- Base project structure
- Initial development environment setup

## [1.0.1] - 2024-03-28
### Added
- Workspace project linking: Associate local VS Code workspaces with Everhour projects
- Automatic project selection based on workspace link
- Command to manage workspace-project associations

### Changed
- Project selection now persists per workspace
- Improved project management UX
