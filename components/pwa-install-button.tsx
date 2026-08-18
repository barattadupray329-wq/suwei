'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaInstallButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null)
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)')
    const updateMode = () => setStandalone(displayMode.matches || ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)))
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as InstallPromptEvent)
    }
    const onInstalled = () => {
      setPromptEvent(null)
      setStandalone(true)
      toast.success('桌面应用已安装')
    }
    updateMode()
    displayMode.addEventListener('change', updateMode)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      displayMode.removeEventListener('change', updateMode)
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (standalone || !promptEvent) return null

  const install = async () => {
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice.outcome === 'accepted') setPromptEvent(null)
  }

  return <button type="button" onClick={install} className="secondary-button hidden md:inline-flex" title="安装为独立桌面应用"><Download data-icon="inline-start"/>安装桌面应用</button>
}
