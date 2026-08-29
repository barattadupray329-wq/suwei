# -*- coding: utf-8 -*-
# 第二部分：给 components/dashboard.tsx 加"随手备注"UI，同样用 Python UTF-8 纯字符串替换避免中文损坏。
import io, sys

def patch(path, replacements):
    with io.open(path, 'r', encoding='utf-8') as f:
        text = f.read()
    for label, old, new in replacements:
        count = text.count(old)
        if count != 1:
            print('ERROR %s [%s]: 期望唯一匹配但找到 %d 处' % (path, label, count))
            sys.exit(1)
        text = text.replace(old, new)
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    print('OK', path)

header_remark_component = u'''
// 合同详情头部的随手备注：没备注时显示一个"加备注"入口，有备注时把内容显示成一个可点的小标签，
// 点一下就进入行内编辑，随时能改或清空。保存/清空走父级传入的 onSave（内部用 runInDetail 提交并
// 刷新+toast）。用受控 input，编辑态本地 useState 暂存，取消则丢弃回退到已保存值。
function HeaderRemark({ value, onSave }: { value: string | null; onSave: (remark: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value ?? "");
    setEditing(false);
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next === (value ?? "")) return;
    onSave(next);
  };

  const cancel = () => {
    setDraft(value ?? "");
    setEditing(false);
  };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          ref={inputRef}
          value={draft}
          maxLength={200}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) {
              event.preventDefault();
              commit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
          }}
          placeholder="如：实际使用人 张三"
          className="h-7 w-48 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
          aria-label="合同备注"
        />
        <button type="button" onClick={commit} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-primary hover:bg-primary/10" aria-label="保存备注">
          <Check className="h-4 w-4" />
        </button>
        <button type="button" onClick={cancel} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" aria-label="取消编辑">
          <X className="h-4 w-4" />
        </button>
      </span>
    );
  }

  if (value) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="group inline-flex max-w-[16rem] items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground ring-1 ring-inset ring-border hover:bg-accent/70" title="点击修改备注">
        <span className="truncate">{value}</span>
        <Pencil className="h-3 w-3 shrink-0 opacity-50 group-hover:opacity-100" />
      </button>
    );
  }

  return (
    <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary">
      <Plus className="h-3 w-3" />
      加备注
    </button>
  );
}
'''

patch('components/dashboard.tsx', [
    # 1. 图标导入
    ('icons',
     u"  Monitor,\n  Plus,\n  Search,",
     u"  Check,\n  Monitor,\n  Pencil,\n  Plus,\n  Search,"),
    # 2. Rental 类型加字段
    ('rental-type',
     u"  status: string;\n  notes: string | null;\n  items: Item[];",
     u"  status: string;\n  notes: string | null;\n  headerRemark: string | null;\n  items: Item[];"),
    # 3. import action
    ('import-action',
     u"  updateRentalAssignee,\n",
     u"  updateRentalAssignee,\n  updateRentalHeaderRemark,\n"),
    # 4. DetailProps 类型
    ('detailprops',
     u"type DetailProps = {\n  rental: Rental;\n  role: \"super_admin\" | \"admin\" | \"employee\";\n  assignees: RentalAssignee[];\n  canManageContracts: boolean;\n  canViewFinance: boolean;\n  onSendNotice: () => void;\n  onAssignee: (assigneeId: string) => void;\n  onDelete: () => void;",
     u"type DetailProps = {\n  rental: Rental;\n  role: \"super_admin\" | \"admin\" | \"employee\";\n  assignees: RentalAssignee[];\n  canManageContracts: boolean;\n  canViewFinance: boolean;\n  onSendNotice: () => void;\n  onAssignee: (assigneeId: string) => void;\n  onUpdateRemark: (remark: string) => void;\n  onDelete: () => void;"),
    # 5. Detail 解构
    ('detail-destructure',
     u"function Detail(props: DetailProps) {\n  const {\n    rental,\n    role,\n    assignees,\n    canManageContracts,\n    canViewFinance,\n    onSendNotice,\n    onAssignee,\n    onDelete,",
     u"function Detail(props: DetailProps) {\n  const {\n    rental,\n    role,\n    assignees,\n    canManageContracts,\n    canViewFinance,\n    onSendNotice,\n    onAssignee,\n    onUpdateRemark,\n    onDelete,"),
    # 6. Detail 调用处传 prop
    ('detail-callsite',
     u"  onAssignee={(assigneeId) =>\n  runInDetail(\n                () => updateRentalAssignee(selected.id, assigneeId),\n                \"维护负责人已更新\",\n              )\n            }",
     u"  onAssignee={(assigneeId) =>\n  runInDetail(\n                () => updateRentalAssignee(selected.id, assigneeId),\n                \"维护负责人已更新\",\n              )\n            }\n            onUpdateRemark={(remark) =>\n              runInDetail(\n                () => updateRentalHeaderRemark(selected.id, remark),\n                \"备注已保存\",\n              )\n            }"),
    # 7. 头部 UI 插入 HeaderRemark
    ('header-ui',
     u"              <span className=\"rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground\">\n                {rental.orderType === \"draft\" ? \"草稿\" : rental.orderType === \"test\" ? \"测试\" : \"正式合同\"}\n              </span>\n            </div>",
     u"              <span className=\"rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground\">\n                {rental.orderType === \"draft\" ? \"草稿\" : rental.orderType === \"test\" ? \"测试\" : \"正式合同\"}\n              </span>\n              <HeaderRemark value={rental.headerRemark} onSave={onUpdateRemark} />\n            </div>"),
    # 8. 新增 HeaderRemark 组件（插在 Info 组件之后）
    ('component',
     u"function Info({ l, v }: { l: string; v: string }) {\n  return (\n    <div>\n      <p className=\"text-xs text-muted-foreground\">{l}</p>\n      <p className=\"mt-1 font-medium\">{v}</p>\n    </div>\n  );\n}",
     u"function Info({ l, v }: { l: string; v: string }) {\n  return (\n    <div>\n      <p className=\"text-xs text-muted-foreground\">{l}</p>\n      <p className=\"mt-1 font-medium\">{v}</p>\n    </div>\n  );\n}\n" + header_remark_component),
])
