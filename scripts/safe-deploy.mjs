import { execFileSync } from 'node:child_process'

const run = (command, args, options = {}) => execFileSync(command, args, { stdio: 'inherit', ...options })
const capture = (command, args) => execFileSync(command, args, { encoding: 'utf8' }).trim()

const status = JSON.parse(capture('pnpm', ['exec', 'wrangler', 'deployments', 'status', '--json']))
const previousVersion = status.versions?.find((version) => version.percentage === 100)?.version_id

if (!previousVersion) throw new Error('无法确认当前线上正常版本，已停止发布。')

console.log(`[safe-deploy] 当前稳定版本：${previousVersion}`)
run('pnpm', ['run', 'deploy'])

const healthUrl = process.env.PRODUCTION_HEALTH_URL || 'https://www.tuzhuzu.cn/dashboard'
let healthy = false
let lastError

for (let attempt = 1; attempt <= 6; attempt += 1) {
  try {
    const response = await fetch(healthUrl, { redirect: 'manual', signal: AbortSignal.timeout(15_000) })
    if (response.status >= 200 && response.status < 400) {
      healthy = true
      console.log(`[safe-deploy] 线上健康检查通过：HTTP ${response.status}`)
      break
    }
    lastError = new Error(`HTTP ${response.status}`)
  } catch (error) {
    lastError = error
  }
  console.log(`[safe-deploy] 第 ${attempt} 次健康检查未通过，等待后重试。`)
  await new Promise((resolve) => setTimeout(resolve, 10_000))
}

if (!healthy) {
  console.error(`[safe-deploy] 新版本健康检查失败：${lastError instanceof Error ? lastError.message : '未知错误'}`)
  console.error(`[safe-deploy] 正在回滚到：${previousVersion}`)
  run('pnpm', ['exec', 'wrangler', 'rollback', previousVersion, '--yes', '--message', 'Automatic rollback after failed production health check'])
  throw new Error('新版本未通过线上健康检查，已自动回滚。')
}
