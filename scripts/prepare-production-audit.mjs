// Produces an isolated production configuration, never the distributable configuration.
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const root = resolve('desktop-test-results/production-audit')
await mkdir(root, { recursive: true })
await writeFile(
  resolve(root, 'tauri.conf.json'),
  JSON.stringify(
    {
      identifier: 'com.amirzulfadhli.flowplan-startup-audit',
      productName: 'FlowPlan Startup Audit',
    },
    null,
    2,
  ),
)
console.log(resolve(root, 'tauri.conf.json'))
