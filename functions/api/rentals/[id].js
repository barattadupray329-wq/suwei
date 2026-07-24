// 更新租赁状态
export async function onRequestPut(context) {
  const id = context.params.id;
  const body = await context.request.json();
  const stmt = context.env.DB.prepare(
    "UPDATE rentals SET status = ?, rental_start = ?, rental_end = ? WHERE id = ?"
  ).bind(body.status, body.rental_start, body.rental_end, id);
  await stmt.run();
  return Response.json({ success: true });
}

// 删除租赁记录
export async function onRequestDelete(context) {
  const id = context.params.id;
  await context.env.DB.prepare("DELETE FROM rentals WHERE id = ?").bind(id).run();
  return Response.json({ success: true });
}
