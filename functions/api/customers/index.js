// 获取所有客户
export async function onRequestGet(context) {
  const stmt = context.env.DB.prepare("SELECT * FROM customers ORDER BY created_at DESC");
  const data = await stmt.all();
  return Response.json(data);
}

// 新增客户
export async function onRequestPost(context) {
  const body = await context.request.json();
  const stmt = context.env.DB.prepare(
    "INSERT INTO customers (name, phone, email) VALUES (?, ?, ?)"
  ).bind(body.name, body.phone, body.email || null);
  const result = await stmt.run();
  return Response.json({ success: true, id: result.meta.last_row_id });
}
