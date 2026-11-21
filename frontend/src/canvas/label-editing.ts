import { createContext } from 'react'

/** The arrow whose label is being edited, if any; one at a time on a board. */
export const LabelEditing = createContext<{
  editing: string | null
  setEditing: (id: string | null) => void
}>({ editing: null, setEditing: () => {} })
