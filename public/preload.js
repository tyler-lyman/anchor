const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder:       ()                                    => ipcRenderer.invoke('select-folder'),
  createFolder:       ()                                    => ipcRenderer.invoke('create-folder'),
  scanLibrary:        (libraryPath)                         => ipcRenderer.invoke('scan-library', libraryPath),
  createWorkspace:    (libraryPath, workspace)              => ipcRenderer.invoke('create-workspace', libraryPath, workspace),
  saveWorkspaceMeta:  (libraryPath, workspaceId, meta)      => ipcRenderer.invoke('save-workspace-meta', libraryPath, workspaceId, meta),
  deleteWorkspace:    (libraryPath, workspaceId)            => ipcRenderer.invoke('delete-workspace', libraryPath, workspaceId),
  saveSections:       (libraryPath, workspaceId, sections)  => ipcRenderer.invoke('save-sections', libraryPath, workspaceId, sections),
  savePage:           (libraryPath, workspaceId, page)      => ipcRenderer.invoke('save-page', libraryPath, workspaceId, page),
  deletePage:         (libraryPath, workspaceId, pageId)    => ipcRenderer.invoke('delete-page', libraryPath, workspaceId, pageId),
  pickImage:          ()                                    => ipcRenderer.invoke('pick-image'),
  addAsset:           (libraryPath, workspaceId, srcPath, caption) => ipcRenderer.invoke('add-asset', libraryPath, workspaceId, srcPath, caption),
  deleteAsset:        (libraryPath, workspaceId, assetId)   => ipcRenderer.invoke('delete-asset', libraryPath, workspaceId, assetId),
  getAssetUrl:        (libraryPath, workspaceId, assetId)   => ipcRenderer.invoke('get-asset-url', libraryPath, workspaceId, assetId),
});
