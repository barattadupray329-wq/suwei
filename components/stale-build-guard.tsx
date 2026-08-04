'use client'

import { useEffect } from 'react'
import { isStaleBuildError, reloadForStaleBuild } from '@/lib/stale-build'

// 兜底捕获没有被 React 错误边界接住的分片加载失败（例如预取、动态 import、脚本标签）。
export function StaleBuildGuard() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (isStaleBuildError(event.error) || isStaleBuildError(event.message)) reloadForStaleBuild()
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isStaleBuildError(event.reason)) reloadForStaleBuild()
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
  return null
}
