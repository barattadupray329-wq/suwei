# 速维电脑租赁

速维电脑租赁是基于 Next.js 16 与 Cloudflare 构建的租赁业务 Web 系统，包含官网、员工登录、经营总览、租赁合同、资金流水、客户门户、业务设置和数据备份等功能。

## 技术栈

- Next.js 16、React 19、TypeScript
- Tailwind CSS 4
- Better Auth
- Cloudflare Workers、D1、OpenNext
- Drizzle ORM
- Vitest、ESLint

## 本地开发

```bash
pnpm install --frozen-lockfile
pnpm exec wrangler d1 migrations apply suwei-db --local
pnpm dev
```

若本地数据库尚未登记新增迁移，可执行对应 SQL 文件：

```bash
pnpm exec wrangler d1 execute suwei-db --local --file=migrations/0004_website_packages.sql
```

## 质量检查

```bash
pnpm test
pnpm lint
pnpm build
pnpm build:cloudflare
pnpm exec wrangler deploy --dry-run
```

## 数据库迁移

迁移文件位于 `migrations/`。生产环境变更前先检查目标 D1 数据库，再执行：

```bash
pnpm exec wrangler d1 migrations apply suwei-db --remote
```

数据库、CSV、Excel 和业务导出文件禁止提交到仓库。

## Cloudflare 部署

生产部署使用 `wrangler.jsonc`、`open-next.config.ts` 和 `worker-entry.js`。`worker-entry.js` 是裸域名跳转到 `www.tuzhuzu.cn` 的唯一入口。

```bash
pnpm deploy
```

生产地址：<https://www.tuzhuzu.cn>
