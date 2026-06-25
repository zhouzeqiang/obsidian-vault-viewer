# 一键构建并部署到 Obsidian vault
$vaultPath = "D:\app\obsidian\我的知识库"

npm run build
if ($LASTEXITCODE -ne 0) { exit }

Copy-Item -Path "main.js" -Destination "$vaultPath\.obsidian\plugins\vault-viewer\main.js" -Force
Copy-Item -Path "manifest.json" -Destination "$vaultPath\.obsidian\plugins\vault-viewer\manifest.json" -Force
Copy-Item -Path "styles.css" -Destination "$vaultPath\.obsidian\plugins\vault-viewer\styles.css" -Force

Write-Output "部署完成！请在 Obsidian 中重新加载插件。"
