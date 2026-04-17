import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')

process.on('SIGINT', () => process.exit(130))
process.on('SIGTERM', () => process.exit(0))

const vite = spawn(process.execPath, [viteBin], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
})

vite.on('exit', (code) => process.exit(code ?? 0))
