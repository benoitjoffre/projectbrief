import { useCallback, useRef, useState } from 'react'
import type { Answer, DiscoveryProgress, QuestionCategory } from '../../api/types'
import { api, ApiError } from '../../api/client'
import { ErrorMessage, Loading } from '../../components/ui'
import { useApi } from '../../hooks/useApi'
import { SaveConflict, type SaveFn } from './answerSaver'
import { Interview } from './Interview'
import { ShareLinkCard } from './ShareLinkCard'
import { useAnswerSaver } from './useAnswerSaver'

export function DiscoveryPanel({ projectId }: { projectId: string }) {
  const categories = useApi<QuestionCategory[]>('/api/questions')
  const answers = useApi<Answer[]>(`/api/projects/${projectId}/answers`)
  const progress = useApi<DiscoveryProgress>(`/api/projects/${projectId}/discovery/progress`)

  const error = categories.error ?? answers.error ?? progress.error
  if (error) {
    return (
      <ErrorMessage
        message={error.message}
        onRetry={() => {
          categories.reload()
          answers.reload()
          progress.reload()
        }}
      />
    )
  }
  if (!categories.data || !answers.data || !progress.data) return <Loading />

  return (
    <>
      <ShareLinkCard projectId={projectId} />
      <AdminInterview
        projectId={projectId}
        categories={categories.data}
        initialAnswers={answers.data}
        initialProgress={progress.data}
      />
    </>
  )
}

function AdminInterview({
  projectId,
  categories,
  initialAnswers,
  initialProgress,
}: {
  projectId: string
  categories: QuestionCategory[]
  initialAnswers: Answer[]
  initialProgress: DiscoveryProgress
}) {
  const [progress, setProgress] = useState(initialProgress)

  // Rafraîchit la progression (calculée côté serveur) après chaque sauvegarde confirmée.
  // Un compteur écarte les réponses arrivées dans le désordre.
  const refreshSeq = useRef(0)
  const refreshProgress = useCallback(() => {
    const seq = ++refreshSeq.current
    api
      .get<DiscoveryProgress>(`/api/projects/${projectId}/discovery/progress`)
      .then((p) => seq === refreshSeq.current && setProgress(p))
      .catch(() => {})
  }, [projectId])

  const [save] = useState<SaveFn>(() => async (questionId, data, expectedUpdatedAt) => {
    try {
      const saved = await api.saveAnswer(projectId, questionId, { ...data, expectedUpdatedAt })
      refreshProgress()
      return { updatedAt: saved.updatedAt }
    } catch (err) {
      // Réponse modifiée entre-temps (par le client via son lien, ou dans un autre onglet).
      if (err instanceof ApiError && err.code === 'STALE_WRITE') {
        throw new SaveConflict(err.current ?? { value: '', isReviewed: false, updatedAt: null })
      }
      throw err
    }
  })
  const { saver } = useAnswerSaver(save, initialAnswers)

  return (
    <Interview
      categories={categories}
      saver={saver}
      isDone={(a) => a.isReviewed && a.value.trim() !== ''}
      progress={{
        text: `Progression : ${progress.reviewedQuestions} / ${progress.totalQuestions} questions validées (${progress.percentage} %)`,
        percentage: progress.percentage,
      }}
    />
  )
}
