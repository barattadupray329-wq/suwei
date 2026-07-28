export const UPDATE_IDLE_MS = 60_000

export type UpdateSafety = {
  idleFor: number
  dirty: boolean
  dialogOpen: boolean
  inputFocused: boolean
  submitting: boolean
  visible: boolean
}

export function canAutoUpdate(state: UpdateSafety) {
  return state.visible && state.idleFor >= UPDATE_IDLE_MS && !state.dirty && !state.dialogOpen && !state.inputFocused && !state.submitting
}

export function shortVersion(version: string) {
  return version.length > 24 ? version.slice(0, 24) : version
}
