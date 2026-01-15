// ==UserScript==
// @name           Zen Workspace Background Image
// @description    Allows setting a custom background image for the workspace indicator
// @version        2.0
// @author         Your Name
// @namespace      https://github.com/yourusername
// ==/UserScript==

(function() {
  'use strict';

  const STORAGE_KEY_PREFIX = 'zenWorkspaceBgImage_';
  
  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function getCurrentWorkspaceId() {
    // Best method: use Zen's API to get the active workspace
    if (typeof gZenWorkspaces !== 'undefined' && gZenWorkspaces.getActiveWorkspaceFromCache) {
      try {
        const activeWorkspace = gZenWorkspaces.getActiveWorkspaceFromCache();
        if (activeWorkspace && activeWorkspace.uuid) {
          return activeWorkspace.uuid;
        }
      } catch (e) {
        console.warn('Could not get active workspace from API:', e);
      }
    }
    
    // Fallback: try to find from DOM
    // Look for the selected/active workspace element
    const activeWorkspace = document.querySelector('zen-workspace[selected="true"]') || 
                           document.querySelector('zen-workspace[active="true"]');
    if (activeWorkspace && activeWorkspace.id) {
      return activeWorkspace.id;
    }
    
    // Last fallback: get from indicator
    const indicator = document.querySelector('.zen-current-workspace-indicator');
    if (indicator) {
      const workspaceId = indicator.getAttribute('zen-workspace-id');
      if (workspaceId) return workspaceId;
      
      const workspace = indicator.closest('zen-workspace');
      if (workspace) return workspace.id;
    }
    
    return null;
  }

  function getStorageKey(workspaceId) {
    return `${STORAGE_KEY_PREFIX}${workspaceId}`;
  }

  function init() {
    setTimeout(() => {
      addMenuOption();
      injectCSS();
      
      // Load all workspace images first
      loadAllWorkspaceImages();
      
      // Then load current workspace (for menu state)
      loadAndApplyImage();
      
      // Watch for workspace changes
      watchWorkspaceChanges();
    }, 1000);
  }
  
  function watchWorkspaceChanges() {
    // Watch for changes to the workspace indicator to detect workspace switches
    const observer = new MutationObserver(() => {
      const newWorkspaceId = getCurrentWorkspaceId();
      if (newWorkspaceId && newWorkspaceId !== currentWorkspaceId) {
        console.log('Workspace changed from', currentWorkspaceId, 'to', newWorkspaceId);
        currentWorkspaceId = newWorkspaceId;
        loadAndApplyImage();
        updateRemoveOption();
      }
    });
    
    // Observe the document for workspace changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['zen-workspace-id', 'id']
    });
  }
  
  let currentWorkspaceId = null;

  function injectCSS() {
    // Create style element but leave it empty initially
    // We'll only add styles when an image is set
    const style = document.createElement('style');
    style.id = 'zen-workspace-bg-style';
    document.head.appendChild(style);
  }
  
  // Store images per workspace ID
  const workspaceImages = new Map();
  
  function escapeCSSIdentifier(str) {
    // Escape special characters in CSS attribute selector
    return str.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
  }

  function updateCSS() {
    const style = document.getElementById('zen-workspace-bg-style');
    if (!style) return;
    
    // Build CSS rules for each workspace that has an image
    let cssRules = [];
    
    for (const [workspaceId, imageUrl] of workspaceImages.entries()) {
      if (imageUrl) {
        // Escape workspace ID and image URL for CSS
        const escapedId = escapeCSSIdentifier(workspaceId);
        const escapedUrl = imageUrl.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        
         // Use attribute selector to target specific workspace
         cssRules.push(`
           .zen-current-workspace-indicator[zen-workspace-id="${escapedId}"]::before {
             background-image: url("${escapedUrl}") !important;
             background-size: cover !important;
             background-position: center !important;
             background-repeat: no-repeat !important;
             opacity: 0.2 !important;
             box-shadow: inset 0 0 15px 2px rgba(0, 0, 0, 0.9) !important;
           }
         `);
      }
    }
    
    if (cssRules.length > 0) {
      style.textContent = cssRules.join('\n');
      console.log('CSS updated for', cssRules.length, 'workspace(s):', Array.from(workspaceImages.keys()));
    } else {
      style.textContent = '';
      console.log('CSS cleared - no workspace images');
    }
  }

  function applyImage(dataUrl, workspaceId) {
    if (!workspaceId) {
      workspaceId = getCurrentWorkspaceId();
    }
    
    if (workspaceId) {
      if (dataUrl) {
        workspaceImages.set(workspaceId, dataUrl);
        console.log('Background image applied for workspace:', workspaceId);
      } else {
        workspaceImages.delete(workspaceId);
        console.log('Background image removed for workspace:', workspaceId);
      }
      updateCSS();
      
      // Verify it was actually set
      if (dataUrl) {
        setTimeout(() => {
          const indicator = document.querySelector(`.zen-current-workspace-indicator[zen-workspace-id="${workspaceId}"]`);
          if (indicator) {
            const computed = window.getComputedStyle(indicator, '::before');
            const bgImg = computed.backgroundImage;
            console.log('Computed background-image:', bgImg === 'none' ? 'none' : bgImg.substring(0, 100) + '...');
            console.log('Computed opacity:', computed.opacity);
          }
        }, 100);
      }
    } else {
      console.warn('Cannot apply image: no workspace ID');
    }
  }

  function storeImage(dataUrl, workspaceId) {
    if (!workspaceId) {
      workspaceId = getCurrentWorkspaceId();
    }
    if (!workspaceId) {
      console.error('Cannot store image: no workspace ID');
      return;
    }
    
    const key = getStorageKey(workspaceId);
    try {
      if (typeof SessionStore !== 'undefined' && SessionStore.setCustomGlobalValue) {
        SessionStore.setCustomGlobalValue(key, dataUrl);
        console.log('Stored via SessionStore for workspace:', workspaceId);
      } else {
        // Fallback: use a preference (may have size limits)
        Services.prefs.setStringPref(`extensions.${key}`, dataUrl);
        console.log('Stored via Services.prefs for workspace:', workspaceId);
      }
    } catch (e) {
      console.error('Failed to store image:', e);
    }
  }

  function getStoredImage(workspaceId) {
    if (!workspaceId) {
      workspaceId = getCurrentWorkspaceId();
    }
    if (!workspaceId) {
      return '';
    }
    
    const key = getStorageKey(workspaceId);
    try {
      if (typeof SessionStore !== 'undefined' && SessionStore.getCustomGlobalValue) {
        const value = SessionStore.getCustomGlobalValue(key);
        if (value) {
          console.log('Retrieved from SessionStore for workspace:', workspaceId);
          return value;
        }
      }
      // Fallback
      return Services.prefs.getStringPref(`extensions.${key}`, '');
    } catch (e) {
      return '';
    }
  }

  function removeStoredImage(workspaceId) {
    if (!workspaceId) {
      workspaceId = getCurrentWorkspaceId();
    }
    if (!workspaceId) return;
    
    const key = getStorageKey(workspaceId);
    try {
      if (typeof SessionStore !== 'undefined' && SessionStore.deleteCustomGlobalValue) {
        SessionStore.deleteCustomGlobalValue(key);
      }
      Services.prefs.clearUserPref(`extensions.${key}`);
      console.log('Removed image for workspace:', workspaceId);
    } catch (e) {
      // Ignore
    }
  }

  function loadAllWorkspaceImages() {
    // Find all workspace elements to get their IDs
    const workspaces = document.querySelectorAll('zen-workspace');
    const workspaceIds = new Set();
    
    // Get IDs from workspace elements
    workspaces.forEach(ws => {
      if (ws.id) workspaceIds.add(ws.id);
    });
    
    // Also check indicators for zen-workspace-id attribute
    const indicators = document.querySelectorAll('.zen-current-workspace-indicator[zen-workspace-id]');
    indicators.forEach(ind => {
      const id = ind.getAttribute('zen-workspace-id');
      if (id) workspaceIds.add(id);
    });
    
    console.log('Found workspace IDs:', Array.from(workspaceIds));
    
    // Load images for all workspaces
    workspaceIds.forEach(workspaceId => {
      const stored = getStoredImage(workspaceId);
      if (stored) {
        workspaceImages.set(workspaceId, stored);
        console.log('Loaded image for workspace:', workspaceId);
      } else {
        workspaceImages.delete(workspaceId);
      }
    });
    
    // Update CSS with all workspace images
    updateCSS();
  }

  function loadAndApplyImage() {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) {
      console.log('No workspace ID found, skipping image load');
      return;
    }
    
    currentWorkspaceId = workspaceId;
    
    // Load image for current workspace if not already loaded
    if (!workspaceImages.has(workspaceId)) {
      const stored = getStoredImage(workspaceId);
      if (stored) {
        workspaceImages.set(workspaceId, stored);
        console.log('Loaded image for workspace:', workspaceId);
        updateCSS();
      } else {
        workspaceImages.delete(workspaceId);
      }
    }
    
    // Update menu option visibility
    updateRemoveOption();
  }

  function addMenuOption() {
    const menu = document.getElementById('zenWorkspaceMoreActions');
    if (!menu) {
      console.warn('zenWorkspaceMoreActions menu not found');
      return;
    }
    if (document.getElementById('context_zenSetWorkspaceBackground')) {
      console.log('Menu option already exists');
      return;
    }

    const separator = document.createXULElement('menuseparator');
    menu.appendChild(separator);

    const setItem = document.createXULElement('menuitem');
    setItem.id = 'context_zenSetWorkspaceBackground';
    setItem.setAttribute('label', 'Set Background Image');
    setItem.addEventListener('command', () => {
      console.log('Set Background Image clicked');
      handleSetBackground();
    });
    menu.appendChild(setItem);
    
    console.log('Menu option added successfully');
  }

  function addRemoveOption() {
    const existing = document.getElementById('context_zenRemoveWorkspaceBackground');
    if (existing) {
      return; // Already exists
    }
    
    const menu = document.getElementById('zenWorkspaceMoreActions');
    if (!menu) return;

    const setItem = document.getElementById('context_zenSetWorkspaceBackground');
    if (!setItem) return;

    const removeItem = document.createXULElement('menuitem');
    removeItem.id = 'context_zenRemoveWorkspaceBackground';
    removeItem.setAttribute('label', 'Remove Background Image');
    removeItem.addEventListener('command', handleRemoveBackground);
    setItem.after(removeItem);
  }

  function updateRemoveOption() {
    const workspaceId = getCurrentWorkspaceId();
    const hasImage = workspaceId && getStoredImage(workspaceId);
    
    if (hasImage) {
      showRemoveOption();
    } else {
      hideRemoveOption();
    }
  }
  
  function hideRemoveOption() {
    const item = document.getElementById('context_zenRemoveWorkspaceBackground');
    if (item) {
      item.hidden = true;
    }
  }
  
  function showRemoveOption() {
    const item = document.getElementById('context_zenRemoveWorkspaceBackground');
    if (item) {
      item.hidden = false;
    } else {
      // Create it if it doesn't exist
      addRemoveOption();
    }
  }

  async function handleSetBackground() {
    try {
      console.log('Creating file picker...');
      console.log('window.browsingContext:', window.browsingContext);
      
      const fp = Cc['@mozilla.org/filepicker;1'].createInstance(Ci.nsIFilePicker);
      console.log('File picker created');
      
      // Initialize - try different approaches
      let initSuccess = false;
      
      // Method 1: browsingContext (Firefox 102+)
      if (window.browsingContext && !initSuccess) {
        try {
          fp.init(window.browsingContext, 'Select Background Image', Ci.nsIFilePicker.modeOpen);
          initSuccess = true;
          console.log('Init with browsingContext succeeded');
        } catch (e) {
          console.log('browsingContext init error:', e.message);
        }
      }
      
      // Method 2: window (older Firefox)
      if (!initSuccess) {
        try {
          fp.init(window, 'Select Background Image', Ci.nsIFilePicker.modeOpen);
          initSuccess = true;
          console.log('Init with window succeeded');
        } catch (e) {
          console.log('window init error:', e.message);
        }
      }
      
      if (!initSuccess) {
        console.error('Could not initialize file picker');
        return;
      }
      
      fp.appendFilter('Images', '*.png;*.jpg;*.jpeg;*.gif;*.webp;*.svg');
      console.log('Opening file picker...');

      // Try to open - handle both callback and Promise styles
      let result;
      try {
        // Modern Firefox: open() returns a Promise
        result = await fp.open();
        console.log('fp.open() returned Promise with result:', result);
      } catch (e) {
        console.log('Promise-style open failed, trying callback:', e.message);
        // Fallback: callback style
        result = await new Promise(resolve => fp.open(resolve));
        console.log('Callback-style open result:', result);
      }

      if (result !== Ci.nsIFilePicker.returnOK || !fp.file) {
        console.log('File picker cancelled or no file selected');
        return;
      }

      console.log('File selected:', fp.file.path);

      // Read file to data URL
      let dataUrl;
      
      // Detect MIME type from extension as fallback
      const ext = fp.file.path.split('.').pop().toLowerCase();
      const mimeMap = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
        'bmp': 'image/bmp'
      };
      let mime = mimeMap[ext] || 'image/png';
      
      try {
        const detected = Cc['@mozilla.org/mime;1'].getService(Ci.nsIMIMEService).getTypeFromFile(fp.file);
        if (detected) mime = detected;
      } catch (e) {}
      
      console.log('File extension:', ext);
      console.log('MIME type:', mime);
      
      try {
        // Modern approach using IOUtils
        const bytes = await IOUtils.read(fp.file.path);
        console.log('File size:', bytes.length, 'bytes');
        
        // Convert Uint8Array to binary string in chunks (spread operator has limits)
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, chunk);
        }
        dataUrl = `data:${mime};base64,${btoa(binary)}`;
      } catch (e) {
        console.log('IOUtils failed, using stream fallback:', e);
        // Fallback to stream
        const stream = Cc['@mozilla.org/network/file-input-stream;1'].createInstance(Ci.nsIFileInputStream);
        stream.init(fp.file, -1, -1, 0);
        
        const bstream = Cc['@mozilla.org/binaryinputstream;1'].createInstance(Ci.nsIBinaryInputStream);
        bstream.setInputStream(stream);
        
        const bytes = bstream.readBytes(bstream.available());
        stream.close();
        
        console.log('File size (stream):', bytes.length, 'bytes');
        dataUrl = `data:${mime};base64,${btoa(bytes)}`;
      }
      
      console.log('Data URL prefix:', dataUrl.substring(0, 50));
      
      // Verify the data URL is valid by checking it starts correctly
      if (!dataUrl.startsWith('data:image/')) {
        console.error('Invalid data URL generated');
        return;
      }
      
      console.log('Data URL created, length:', dataUrl.length);
      
      const workspaceId = getCurrentWorkspaceId();
      if (!workspaceId) {
        console.error('Cannot apply image: no workspace ID');
        return;
      }
      
      // Store for persistence (workspace-specific) first
      storeImage(dataUrl, workspaceId);
      
      // Apply immediately
      workspaceImages.set(workspaceId, dataUrl);
      updateCSS();
      showRemoveOption();
      
      console.log('Image applied and stored for workspace:', workspaceId);
    } catch (e) {
      console.error('handleSetBackground error:', e);
    }
  }

  function handleRemoveBackground() {
    console.log('Remove Background clicked');
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) {
      console.error('Cannot remove image: no workspace ID');
      return;
    }
    
    // Delay slightly to let the menu close first
    setTimeout(() => {
      try {
        console.log('Removing background for workspace:', workspaceId);
        
        // Remove from storage
        removeStoredImage(workspaceId);
        
        // Remove from in-memory map
        workspaceImages.delete(workspaceId);
        
        // Update CSS (will regenerate without this workspace)
        updateCSS();
        
        // Update menu
        hideRemoveOption();
        
        console.log('Background removed for workspace:', workspaceId);
      } catch (e) {
        console.error('Error removing background:', e);
      }
    }, 100);
  }
})();
