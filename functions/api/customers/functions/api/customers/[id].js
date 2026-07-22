// 获取单个客户
export async function onRequestGet(context) {
  const id = context.params.id;
  const stmt = context.env.DB.prepare("SELECT * FROM customers WHERE id = ?").bind(id);
  const customer = await stmt.first();
  if (!customer) return Response.json({ error: "未找到客户" }, { status: 404 });
  return Response.json(customer);
}

// 更新客户
export async function onRequestPut(context) {
  const id = context.params.id;
  const body = await context.request.json();
  const stmt = context.env.DB.prepare(
    "UPDATE customers SET name = ?, phone = ?, email = ? WHERE id = ?"
  ).bind(body.name, body.phone, body.email || null, id);
  await stmt.run();
  return Response.json({ success: true });
}

// 删除客户
export async function onRequestDelete(context) {
  const id = context.params.id;
  await context.env.DB.prepare("DELETE FROM customers WHERE id = ?").bind(id).run();
  return Response.json({ success: true });
}
