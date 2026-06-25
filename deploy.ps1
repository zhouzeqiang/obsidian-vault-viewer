param([string]$VaultPath)
if (-not $VaultPath) {
    $VaultPath = "D:\app\obsidian\我的知识库"
}
$target = Join-Path $VaultPath ".obsidian\plugins\vault-viewer"
$src = "D:\app\AI\projects\obsibian-document-management"
Copy-Item -LiteralPath (Join-Path $src "main.js") -Destination (Join-Path $target "main.js") -Force
Copy-Item -LiteralPath (Join-Path $src "manifest.json") -Destination (Join-Path $target "manifest.json") -Force
Copy-Item -LiteralPath (Join-Path $src "styles.css") -Destination (Join-Path $target "styles.css") -Force
Write-Output "deployed to $target"
