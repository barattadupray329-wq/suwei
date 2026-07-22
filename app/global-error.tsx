'use client'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, background: '#f5f7f6', color: '#17201d', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <section style={{ width: '100%', maxWidth: 420, border: '1px solid #d9dfdc', borderRadius: 16, background: '#ffffff', padding: 32, textAlign: 'center', boxShadow: '0 16px 40px rgba(23,32,29,.12)' }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>系统暂时无法加载</h1>
            <p style={{ margin: '12px 0 24px', color: '#64706b', lineHeight: 1.6 }}>系统遇到临时问题，请重新加载。若问题持续，请返回登录页面重新登录。</p>
            <button type="button" onClick={reset} style={{ width: '100%', height: 44, border: 0, borderRadius: 8, background: '#08745b', color: '#ffffff', fontWeight: 600, cursor: 'pointer' }}>重新加载</button>
            <a href="/sign-in" style={{ display: 'block', marginTop: 16, color: '#08745b', fontWeight: 600 }}>返回登录</a>
            {error.digest ? <p style={{ marginTop: 20, color: '#64706b', fontSize: 12 }}>错误编号：{error.digest}</p> : null}
          </section>
        </main>
      </body>
    </html>
  )
}
