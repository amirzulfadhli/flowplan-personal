# Read-only, opt-in metadata collector. No network, database, logs, or process access.
[CmdletBinding()]
param([string]$Installer)

$ErrorActionPreference = 'Stop'
function Read-Version([string]$RegistryPath) {
    $value = Get-ItemPropertyValue -LiteralPath $RegistryPath -Name pv -ErrorAction SilentlyContinue
    if ($value -match '^\d+\.\d+\.\d+\.\d+$') { return [string]$value }
    return $null
}
$windows = Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
$guid = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
$report = [ordered]@{
    schemaVersion = 1
    windowsBuild = '{0}.{1}' -f $windows.CurrentBuildNumber, $windows.UBR
    osArchitecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
    webView2Versions = @(
        Read-Version "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\$guid"
        Read-Version "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\$guid"
        Read-Version "HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\$guid"
    ) | Where-Object { $_ } | Sort-Object -Unique
    installer = $null
}
# Preserve array shape even with one or zero installed runtime registrations.
$report.webView2Versions = @($report.webView2Versions)
if ($Installer) {
    try {
        $file = Get-Item -LiteralPath $Installer
        if ($file.PSIsContainer -or $file.Extension -ne '.exe' -or
            $file.VersionInfo.ProductName -notin @('FlowPlan Personal', 'FlowPlan Beta Acceptance') -or
            $file.VersionInfo.ProductVersion -notmatch '^\d+\.\d+\.\d+([.-][0-9A-Za-z.-]+)?$') {
            throw 'Invalid candidate'
        }
        $report.installer = [ordered]@{
            product = $file.VersionInfo.ProductName
            version = $file.VersionInfo.ProductVersion
            bytes = $file.Length
            sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
            signatureStatus = (Get-AuthenticodeSignature -LiteralPath $file.FullName).Status.ToString()
        }
    } catch {
        # Never echo a private path, exception, or arbitrary executable metadata.
        throw 'Cannot inspect the candidate. Supply a readable FlowPlan installer EXE.'
    }
}
$report | ConvertTo-Json -Depth 4
