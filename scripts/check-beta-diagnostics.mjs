// Verify the diagnostic sharing contract, including omitted personal/host identifiers.
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
const args = ['-NoProfile', '-NonInteractive', '-File', 'scripts/collect-beta-diagnostics.ps1']
if (process.argv[2]) args.push('-Installer', process.argv[2])
// Windows PowerShell must resolve its own built-in modules, not inherit a PowerShell 7 module path.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'psmodulepath'),
)
const output = execFileSync('powershell.exe', args, { encoding: 'utf8', windowsHide: true, env })
const report = JSON.parse(output)
assert.deepEqual(Object.keys(report).sort(), [
  'installer',
  'osArchitecture',
  'schemaVersion',
  'webView2Versions',
  'windowsBuild',
])
assert.equal(report.schemaVersion, 1)
assert.match(report.windowsBuild, /^\d+\.\d+$/)
assert.ok(['X64', 'X86', 'Arm', 'Arm64'].includes(report.osArchitecture))
assert.ok(Array.isArray(report.webView2Versions))
for (const version of report.webView2Versions) assert.match(version, /^\d+\.\d+\.\d+\.\d+$/)
if (process.argv[2]) {
  const installer = report.installer
  assert.deepEqual(Object.keys(installer).sort(), [
    'bytes',
    'product',
    'sha256',
    'signatureStatus',
    'version',
  ])
  assert.ok(['FlowPlan Personal', 'FlowPlan Beta Acceptance'].includes(installer.product))
  assert.match(installer.version, /^\d+\.\d+\.\d+([.-][0-9A-Za-z.-]+)?$/)
  assert.match(installer.sha256, /^[A-F0-9]{64}$/)
  assert.ok(Number.isSafeInteger(installer.bytes) && installer.bytes > 0)
  assert.ok(
    [
      'Valid',
      'NotSigned',
      'HashMismatch',
      'NotTrusted',
      'UnknownError',
      'NotSupportedFileFormat',
      'Incompatible',
    ].includes(installer.signatureStatus),
  )
} else assert.equal(report.installer, null)
assert.ok(!output.includes(process.env.USERPROFILE))
assert.ok(!output.includes('\\'))
console.log('Beta diagnostics allowlist passed')
