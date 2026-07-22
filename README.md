# 速维电脑租赁 Web 管理系统

面向电脑租赁业务的 Next.js Web 应用。代码托管在 GitHub，应用运行于 Cloudflare Workers，业务与认证数据统一存储在 Cloudflare D1。

## 技术架构

- Web：Next.js 16、React 19、TypeScript、Tailwind CSS
- 运行平台：Cloudflare Workers（OpenNext）
- 数据库：Cloudflare D1（Drizzle ORM）
- 认证：Better Auth + D1
- 短信：阿里云短信，通过 Cloudflare Secrets 配置

## 本地开发

```bash
pnpm install --frozen-lockfile
pnpm dev
```

## 数据库

D1 binding 名称为 `DB`，数据库配置在 `wrangler.jsonc`。迁移文件位于 `migrations/d1/`。

```bash
pnpm d1:migrate:local
pnpm d1:migrate:remote
pnpm d1:verify
```

## Cloudflare 部署

```bash
pnpm cf-typegen
pnpm deploy
```

生产密钥不得提交到 GitHub，应使用 Cloudflare Secrets 配置。项目仅维护 Web 端，不包含 Python 桌面端、Windows 安装器或本地 SQLite 数据文件。
