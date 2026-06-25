// Vault Viewer — hot-reload helper for development
// Place this file alongside main.js in .obsidian/plugins/vault-viewer/
// during development. It watches main.js and reloads the plugin on change.
const fs = require('fs');
const path = require('path');

const pluginDir = __dirname;
let fileWatcher;

function reloadPlugin() {
  const plugin = app.plugins.plugins['vault-viewer'];
  if (plugin) {
    plugin.unload();
    plugin.load();
  }
}

function startWatching() {
  if (fileWatcher) return;
  fileWatcher = fs.watch(path.join(pluginDir, 'main.js'), () => {
    setTimeout(reloadPlugin, 200);
  });
}

module.exports = () => ({
  id: 'vault-viewer-dev',
  name: 'Vault Viewer Dev',
  onload: () => startWatching(),
  onunload: () => { if (fileWatcher) fileWatcher.close(); },
});
