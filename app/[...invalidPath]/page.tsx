import { notFound, redirect } from 'next/navigation'

type InvalidPathPageProps = {
  params: Promise<{ invalidPath: string[] }>
}

export default async function InvalidPathPage({ params }: InvalidPathPageProps) {
  const { invalidPath } = await params
  const literalPath = invalidPath.map(decodeURIComponent).join('/')

  if (literalPath === ':path*' || literalPath === ':path') redirect('/dashboard')

  notFound()
}
