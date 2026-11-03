import { useEffect, useState, useSyncExternalStore } from 'react'
import { AnswerSaver, type SaveFn } from './answerSaver'

type InitialAnswer = { questionId: string; value: string; isReviewed?: boolean; updatedAt: string }

/** Un saver par écran, avec envoi des modifications en attente au démontage et avant fermeture de l'onglet. */
export function useAnswerSaver(save: SaveFn, initialAnswers: InitialAnswer[]) {
  const [saver] = useState(() => {
    const s = new AnswerSaver(save)
    s.load(initialAnswers)
    return s
  })
  const snapshot = useSyncExternalStore(saver.subscribe, saver.getSnapshot)

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (!saver.hasUnsaved()) return
      void saver.flush()
      e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => {
      window.removeEventListener('beforeunload', warn)
      void saver.flush() // navigation interne : on n'abandonne aucune modification
    }
  }, [saver])

  return { saver, snapshot }
}
