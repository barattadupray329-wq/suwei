# -*- coding: utf-8 -*-
# 一次性补丁脚本：给合同详情头部加"随手备注"功能。
# 用 Python 显式以 UTF-8 读写做纯字符串替换，避免编辑大文件时多字节中文被破坏。
import io, sys

def patch(path, replacements):
    with io.open(path, 'r', encoding='utf-8') as f:
        text = f.read()
    for old, new in replacements:
        count = text.count(old)
        if count != 1:
            print('ERROR %s: 期望唯一匹配但找到 %d 处:\n%s' % (path, count, old[:80]))
            sys.exit(1)
        text = text.replace(old, new)
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    print('OK', path)

# ---------- app/actions/rentals.ts ----------
rentals_action = (
    u"// 合同详情头部的\"随手备注\"：用于记录实际使用人和合同签约人不一致等临时说明，可随时修改/清空。\n"
    u"// 和创建合同时录入的业务备注 notes 分开存（headerRemark 列），互不覆盖。这是一个轻量说明性字段，\n"
    u"// 不涉及金额或权限，所以员工也可以改；但仍按 userId 严格限定范围，只能改本商户自己的合同。\n"
    u"export async function updateRentalHeaderRemark(rentalId: number, remark: string) {\n"
    u"  const access = await getAccessContext('租赁操作')\n"
    u"  const trimmed = remark.trim()\n"
    u"  if (trimmed.length > 200) throw new Error('备注最多 200 字')\n"
    u"  const nextValue = trimmed.length > 0 ? trimmed : null\n"
    u"  const [rental] = await db.select({ id: rentals.id, contractNo: rentals.contractNo, headerRemark: rentals.headerRemark }).from(rentals).where(and(eq(rentals.id, rentalId), eq(rentals.userId, access.userId)))\n"
    u"  if (!rental) throw new Error('租赁合同不存在')\n"
    u"  await db.batch([\n"
    u"    db.update(rentals).set({ headerRemark: nextValue, updatedAt: new Date() }).where(and(eq(rentals.id, rentalId), eq(rentals.userId, access.userId))),\n"
    u"    db.insert(auditLogs).values({ userId: access.userId, actorUserId: access.actorId, actorName: access.actorName, action: nextValue ? '更新备注' : '清空备注', resourceType: '租赁合同', resourceId: String(rentalId), summary: `${rental.contractNo}：${rental.headerRemark || '（空）'} → ${nextValue || '（空）'}`, metadata: { previousRemark: rental.headerRemark, remark: nextValue } }),\n"
    u"  ])\n"
    u"  revalidatePath('/dashboard')\n"
    u"}\n\n"
)
patch('app/actions/rentals.ts', [
    (
        u"const settlementSchema = z.object({ timing: z.enum(['now', 'later']), date: z.string().min(1), method: z.enum(['现金', '微信', '支付宝', '银行卡', '其他']) })",
        rentals_action + u"const settlementSchema = z.object({ timing: z.enum(['now', 'later']), date: z.string().min(1), method: z.enum(['现金', '微信', '支付宝', '银行卡', '其他']) })",
    ),
])
