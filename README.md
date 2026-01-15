# Zen Workspace Background Image

A userChrome.js script for Zen Browser (Firefox fork) that allows you to set custom background images for workspace indicators.

## Features

- 🖼️ **Custom Background Images**: Set a local image as the background for any workspace indicator
- 🎨 **Workspace-Specific**: Each workspace can have its own unique background image
- 💾 **Persistent Storage**: Background images are saved and persist across browser restarts
- 🎯 **Easy to Use**: Simple right-click menu option to set or remove backgrounds
- ✨ **Subtle Design**: Images are displayed with low opacity and a soft inner shadow for a polished look


## Usage

1. Right-click on any workspace indicator (the workspace name/icon at the top of the sidebar)
2. Select **"Set Background Image"** from the context menu
3. Choose an image file from your computer
4. The background will be applied immediately

To remove a background:
- Right-click the workspace indicator
- Select **"Remove Background Image"**

## How It Works

- Background images are stored per workspace using SessionStore
- Images are embedded as data URLs in CSS rules
- Each workspace's background is independent and persists across sessions
- The script automatically detects workspace switches and applies the correct background


## Notes

- Large images (>2MB) may take a moment to load
