const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;

let mainWindow;

const isDev = process.env.NODE_ENV === 'development'
  || process.defaultApp
  || /[\\/]electron-prebuilt[\\/]/.test(process.execPath)
  || /[\\/]electron[\\/]/.test(process.execPath);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
    backgroundColor: '#EDEAE6',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../build/index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function readJson(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ── IPC: Library / folder selection ──────────────────────────────────────────

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Open Anchor library',
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('create-folder', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Create new Anchor library',
    buttonLabel: 'Create',
    properties: ['createDirectory'],
  });
  if (!result.canceled && result.filePath) {
    await fs.mkdir(result.filePath, { recursive: true });
    const meta = {
      name: path.basename(result.filePath),
      createdAt: new Date().toISOString(),
    };
    await writeJson(path.join(result.filePath, '_library.json'), meta);
    return result.filePath;
  }
  return null;
});

// ── IPC: Library scan ─────────────────────────────────────────────────────────
//
// Library layout on disk:
//   libraryPath/
//     _library.json              { name, createdAt }
//     ws-abc/
//       _workspace.json          { id, name, createdAt }
//       _sections.json           [{id, name, order, createdAt}]
//       ct-xxx.json              page data

ipcMain.handle('scan-library', async (event, libraryPath) => {
  const meta = await readJson(path.join(libraryPath, '_library.json')) || {
    name: path.basename(libraryPath),
    createdAt: new Date().toISOString(),
  };

  let entries;
  try {
    entries = await fs.readdir(libraryPath, { withFileTypes: true });
  } catch {
    return { meta, workspaces: [] };
  }

  const workspaces = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const wsPath = path.join(libraryPath, entry.name);
    const wsMeta = await readJson(path.join(wsPath, '_workspace.json'));
    if (!wsMeta || !wsMeta.id) continue;

    const sections = await readJson(path.join(wsPath, '_sections.json')) || [];

    let wsFiles;
    try {
      wsFiles = await fs.readdir(wsPath, { withFileTypes: true });
    } catch {
      wsFiles = [];
    }

    const pages = [];
    for (const file of wsFiles) {
      if (!file.isFile()) continue;
      if (!file.name.endsWith('.json')) continue;
      if (file.name.startsWith('_')) continue;
      const data = await readJson(path.join(wsPath, file.name));
      if (data && data.id) pages.push(data);
    }

    workspaces.push({ ...wsMeta, sections, pages });
  }

  workspaces.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return { meta, workspaces };
});

// ── IPC: Workspace CRUD ───────────────────────────────────────────────────────

ipcMain.handle('create-workspace', async (event, libraryPath, workspace) => {
  try {
    const wsPath = path.join(libraryPath, workspace.id);
    await fs.mkdir(wsPath, { recursive: true });
    await writeJson(path.join(wsPath, '_workspace.json'), {
      id: workspace.id,
      name: workspace.name,
      createdAt: workspace.createdAt,
    });
    await writeJson(path.join(wsPath, '_sections.json'), []);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('save-workspace-meta', async (event, libraryPath, workspaceId, meta) => {
  try {
    await writeJson(path.join(libraryPath, workspaceId, '_workspace.json'), meta);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-workspace', async (event, libraryPath, workspaceId) => {
  try {
    await fs.rm(path.join(libraryPath, workspaceId), { recursive: true, force: true });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: Section CRUD ─────────────────────────────────────────────────────────

ipcMain.handle('save-sections', async (event, libraryPath, workspaceId, sections) => {
  try {
    await writeJson(path.join(libraryPath, workspaceId, '_sections.json'), sections);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: Page CRUD ────────────────────────────────────────────────────────────

ipcMain.handle('save-page', async (event, libraryPath, workspaceId, page) => {
  try {
    await writeJson(path.join(libraryPath, workspaceId, page.id + '.json'), page);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-page', async (event, libraryPath, workspaceId, pageId) => {
  try {
    await fs.unlink(path.join(libraryPath, workspaceId, pageId + '.json'));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: Screenshots / assets ─────────────────────────────────────────────────

ipcMain.handle('pick-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose screenshot',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('add-asset', async (event, libraryPath, workspaceId, srcPath, caption) => {
  try {
    const assetsDir = path.join(libraryPath, workspaceId, '_assets');
    await fs.mkdir(assetsDir, { recursive: true });
    const ext = path.extname(srcPath);
    const id = `asset-${Date.now()}${ext}`;
    const destPath = path.join(assetsDir, id);
    await fs.copyFile(srcPath, destPath);
    return { success: true, id, caption: caption || '' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-asset', async (event, libraryPath, workspaceId, assetId) => {
  try {
    await fs.unlink(path.join(libraryPath, workspaceId, '_assets', assetId));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-asset-url', async (event, libraryPath, workspaceId, assetId) => {
  const assetPath = path.join(libraryPath, workspaceId, '_assets', assetId);
  return `file://${assetPath}`;
});
