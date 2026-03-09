const { contextBridge, ipcRenderer } = require("electron");

// Expose a minimal, safe API to the renderer (web page)
contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  isElectron: true,
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
  },
  // Auto-start with Windows
  getAutoStart: () => ipcRenderer.invoke("get-auto-start"),
  setAutoStart: (enabled) => ipcRenderer.invoke("set-auto-start", enabled),
  // Open login window on user's PC (returns { success, cookies })
  openLoginWindow: (url, site) => ipcRenderer.invoke("open-login-window", { url, site }),
});
