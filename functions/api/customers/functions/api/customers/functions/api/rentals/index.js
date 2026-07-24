// 获取所有租赁信息
export async function onRequestGet(context) {
  const stmt = context.env.DB.prepare(`
    SELECT r.*, c.name as customer_name, c.phone as customer_phone
    FROM rentals r
    LEFT JOIN customers c ON r.customer_id = c.id
    ORDER BY r.created_at DESC
  `);
  const data = await stmt.all();
  return Response.json(data);
}

// 新增租赁记录
export async function onRequestPost(context) {
  const body = await context.request.json();
  const stmt = context.env.DB.prepare(
    "INSERT INTO rentals (customer_id, item_name, rental_start, rental_end, status) VALUES (?, ?, ?, ?, ?)"
  ).bind(body.customer_id, body.item_name, body.rental_start, body.rental_end, body.status || "active");
  const result = await stmt.run();
  return Response.json({ success: true, id: result.meta.last_row_id });
}
