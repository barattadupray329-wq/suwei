export async function onRequestPost(context) {
  const body = await context.request.json();
  const { username, password } = body;

  const stmt = context.env.DB.prepare(
    "SELECT * FROM users WHERE username = ? AND password = ?"
  ).bind(username, password);
  const user = await stmt.first();

  if (!user) {
    return Response.json({ success: false, message: "账号或密码错误" }, { status: 401 });
  }
  return Response.json({ success: true, user: { id: user.id, username: user.username, role: user.role } });
}
