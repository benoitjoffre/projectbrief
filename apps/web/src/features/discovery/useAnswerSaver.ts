import { useEffect, useState, useSyncExternalStore } from 'react'
import { api } from '../../api/client'
import type { Answer } from '../../api/types'
import { AnswerSaver } from './answerSaver'

/** Un saver par projet, avec envoi des modifications en attente au démontage et avant fermeture de l'onglet. */
export function useAnswerSaver(projectId: string, initialAnswers: Answer[], onConfirmed: () => void) {
  const [saver] = useState(() => {
    const s = new AnswerSaver(async (questionId, data) => {
      await api.saveAnswer(projectId, questionId, data)
      onConfirmed()
    })
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
