const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApi", {
  invoke: (channel, args) => ipcRenderer.invoke(channel, args),
  send: (channel, args) => ipcRenderer.send(channel, args),
  on: (channel, callback) => ipcRenderer.on(channel, callback),
  off: (channel, callback) => ipcRenderer.off(channel, callback)
});

contextBridge.exposeInMainWorld("desktopApp", {
  isElectron: true
});
