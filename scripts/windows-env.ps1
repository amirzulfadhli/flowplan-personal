# Dot-source from PowerShell before building: . .\scripts\windows-env.ps1
$flowplanCargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
if (Test-Path -LiteralPath $flowplanCargoBin) {
    $env:Path = $flowplanCargoBin + ';' + $env:Path
}
$flowplanVsWhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if (-not (Test-Path -LiteralPath $flowplanVsWhere)) {
    throw 'Install Visual Studio C++ Build Tools and the Windows SDK, then retry.'
}
$flowplanVsPath = & $flowplanVsWhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $flowplanVsPath) { throw 'The Visual Studio C++ x64 build tools are not installed.' }
$flowplanDevShell = Join-Path $flowplanVsPath 'Common7\Tools\Launch-VsDevShell.ps1'
& $flowplanDevShell -Arch amd64 -HostArch amd64 -SkipAutomaticLocation
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { throw 'Install Rust with the x86_64-pc-windows-msvc toolchain, then retry.' }
