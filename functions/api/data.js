// 查询数据
export async function onRequestGet(context) {
  const stmt = context.env.DB.prepare("SELECT * FROM users");
  const data = await stmt.all();
  return Response.json(data);
}

// 插入数据
export async function onRequestPost(context) {
  const body = await context.request.json();
  const stmt = context.env.DB.prepare(
    "INSERT INTO users (name, email) VALUES (?, ?)"
  ).bind(body.name, body.email);
  const result = await stmt.run();
  return Response.json({ success: true, id: result.meta.last_row_id });
}
