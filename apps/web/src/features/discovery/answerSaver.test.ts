import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnswerInput } from '../../api/types'
import { AnswerSaver, SaveConflict } from './answerSaver'

type Call = {
  questionId: string
  data: AnswerInput
  expected: string | null
  resolve: (updatedAt?: string) => void
  reject: (e: Error) => void
}

function setup() {
  const calls: Call[] = []
  const saver = new AnswerSaver(
    (questionId, data, expected) =>
      new Promise<{ updatedAt: string }>((resolve, reject) => {
        calls.push({ questionId, data, expected, resolve: (updatedAt = 't') => resolve({ updatedAt }), reject })
      }),
    700,
  )
  return { saver, calls }
}
const tick = () => vi.advanceTimersByTimeAsync(0)

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('AnswerSaver', () => {
  it('reprend les réponses chargées depuis le serveur (reprise après rechargement)', () => {
    const { saver } = setup()
    saver.load([{ questionId: 'q1', value: 'déjà saisi', isReviewed: true, updatedAt: 't0' }])
    expect(saver.get('q1')).toEqual({ value: 'déjà saisi', isReviewed: true, status: 'idle', conflict: null })
    expect(saver.get('inconnue')).toEqual({ value: '', isReviewed: false, status: 'idle', conflict: null })
  })

  it('regroupe les frappes rapides en une seule requête après 700 ms', async () => {
    const { saver, calls } = setup()
    saver.edit('q1', { value: 'a' })
    await vi.advanceTimersByTimeAsync(400)
    saver.edit('q1', { value: 'ab' })
    await vi.advanceTimersByTimeAsync(400)
    expect(calls).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(300)
    expect(calls).toHaveLength(1)
    expect(calls[0].data).toEqual({ value: 'ab', isReviewed: false })
  })

  it("n'affiche « saved » qu'après confirmation du serveur", async () => {
    const { saver, calls } = setup()
    saver.edit('q1', { value: 'a' })
    expect(saver.getSnapshot().status).toBe('pending')
    await vi.advanceTimersByTimeAsync(700)
    expect(saver.getSnapshot().status).toBe('saving')
    calls[0].resolve()
    await tick()
    expect(saver.getSnapshot().status).toBe('saved')
  })

  it('sérialise les écritures : une seule requête en vol, la plus récente part ensuite', async () => {
    const { saver, calls } = setup()
    saver.edit('q1', { value: 'v1' })
    await vi.advanceTimersByTimeAsync(700)
    saver.edit('q1', { value: 'v2' })
    await vi.advanceTimersByTimeAsync(700) // le débounce expire alors que v1 est encore en vol
    expect(calls).toHaveLength(1)

    calls[0].resolve()
    await tick()
    expect(saver.get('q1').status).toBe('saving') // pas « saved » : v2 n'est pas confirmée
    expect(calls).toHaveLength(2)
    expect(calls[1].data.value).toBe('v2')

    calls[1].resolve()
    await tick()
    expect(saver.get('q1')).toMatchObject({ value: 'v2', status: 'saved' })
  })

  it("ne laisse pas une réponse ancienne écraser le brouillon local", async () => {
    const { saver, calls } = setup()
    saver.edit('q1', { value: 'v1' })
    await vi.advanceTimersByTimeAsync(700)
    saver.edit('q1', { value: 'v2' })
    calls[0].resolve()
    await tick()
    expect(saver.get('q1').value).toBe('v2')
    expect(saver.get('q1').status).not.toBe('saved')
  })

  it('passe en erreur sur échec réseau, conserve la saisie et permet de réessayer', async () => {
    const { saver, calls } = setup()
    saver.edit('q1', { value: 'important' })
    await vi.advanceTimersByTimeAsync(700)
    calls[0].reject(new Error('réseau'))
    await tick()
    expect(saver.getSnapshot().status).toBe('error')
    expect(saver.get('q1')).toMatchObject({ value: 'important', status: 'error' })

    void saver.retry('q1')
    await tick()
    expect(calls).toHaveLength(2)
    expect(calls[1].data.value).toBe('important')
    calls[1].resolve()
    await tick()
    expect(saver.getSnapshot().status).toBe('saved')
  })

  it("une nouvelle frappe après une erreur relance automatiquement l'envoi", async () => {
    const { saver, calls } = setup()
    saver.edit('q1', { value: 'a' })
    await vi.advanceTimersByTimeAsync(700)
    calls[0].reject(new Error('réseau'))
    await tick()
    saver.edit('q1', { value: 'ab' })
    await vi.advanceTimersByTimeAsync(700)
    expect(calls).toHaveLength(2)
    expect(calls[1].data.value).toBe('ab')
  })

  it('flush envoie immédiatement les modifications en attente (changement de catégorie / navigation)', async () => {
    const { saver, calls } = setup()
    saver.edit('q1', { value: 'a' })
    saver.edit('q2', { isReviewed: true })
    expect(saver.hasUnsaved()).toBe(true)
    void saver.flush()
    await tick()
    expect(calls.map((c) => c.questionId).sort()).toEqual(['q1', 'q2'])
    await vi.advanceTimersByTimeAsync(2000)
    expect(calls).toHaveLength(2) // le timer de débounce a bien été annulé
    calls.forEach((c) => c.resolve())
    await tick()
    expect(saver.hasUnsaved()).toBe(false)
  })

  it("n'envoie rien si le contenu est identique à celui du serveur", async () => {
    const { saver, calls } = setup()
    saver.load([{ questionId: 'q1', value: 'x', isReviewed: false, updatedAt: 't0' }])
    saver.edit('q1', { value: 'xy' })
    saver.edit('q1', { value: 'x' }) // retour à la valeur d'origine
    await vi.advanceTimersByTimeAsync(700)
    expect(calls).toHaveLength(0)
    expect(saver.get('q1').status).toBe('saved')
  })

  it('traite chaque réponse indépendamment', async () => {
    const { saver, calls } = setup()
    saver.edit('q1', { value: 'a' })
    saver.edit('q2', { value: 'b' })
    await vi.advanceTimersByTimeAsync(700)
    expect(calls).toHaveLength(2)
    calls[0].reject(new Error('x'))
    calls[1].resolve()
    await tick()
    expect(saver.get('q1').status).toBe('error')
    expect(saver.get('q2').status).toBe('saved')
    expect(saver.getSnapshot().status).toBe('error')
  })

  it('envoie la version vue du serveur et la met à jour après chaque succès', async () => {
    const { saver, calls } = setup()
    saver.load([{ questionId: 'q1', value: 'a', isReviewed: false, updatedAt: 'v1' }])
    saver.edit('q1', { value: 'b' })
    await vi.advanceTimersByTimeAsync(700)
    expect(calls[0].expected).toBe('v1')
    calls[0].resolve('v2')
    await tick()
    saver.edit('q1', { value: 'c' })
    await vi.advanceTimersByTimeAsync(700)
    expect(calls[1].expected).toBe('v2')
    saver.edit('q9', { value: 'neuf' }) // jamais vue du serveur
    await vi.advanceTimersByTimeAsync(700)
    expect(calls[2].expected).toBeNull()
  })

  describe('conflit d’écriture (modifiée ailleurs)', () => {
    const conflict = () => new SaveConflict({ value: 'version serveur', isReviewed: true, updatedAt: 'v9' })

    async function inConflict() {
      const ctx = setup()
      ctx.saver.load([{ questionId: 'q1', value: 'a', isReviewed: false, updatedAt: 'v1' }])
      ctx.saver.edit('q1', { value: 'ma version' })
      await vi.advanceTimersByTimeAsync(700)
      ctx.calls[0].reject(conflict())
      await tick()
      return ctx
    }

    it('passe en « conflict », conserve le brouillon et n’écrase rien', async () => {
      const { saver, calls } = await inConflict()
      expect(saver.getSnapshot().status).toBe('conflict')
      expect(saver.get('q1')).toMatchObject({ value: 'ma version', status: 'conflict', conflict: { value: 'version serveur' } })
      void saver.flush()
      await vi.advanceTimersByTimeAsync(2000)
      expect(calls).toHaveLength(1) // aucun renvoi automatique
      saver.edit('q1', { value: 'ma version bis' })
      await vi.advanceTimersByTimeAsync(2000)
      expect(calls).toHaveLength(1)
      expect(saver.get('q1').value).toBe('ma version bis')
      expect(saver.hasUnsaved()).toBe(true)
    })

    it('« garder ma version » réécrit avec la version serveur comme référence', async () => {
      const { saver, calls } = await inConflict()
      saver.resolveConflict('q1', 'mine')
      await tick()
      expect(calls).toHaveLength(2)
      expect(calls[1].expected).toBe('v9')
      expect(calls[1].data.value).toBe('ma version')
      calls[1].resolve('v10')
      await tick()
      expect(saver.get('q1')).toMatchObject({ value: 'ma version', status: 'saved', conflict: null })
    })

    it('« reprendre la version enregistrée » adopte la valeur du serveur sans requête', async () => {
      const { saver, calls } = await inConflict()
      saver.resolveConflict('q1', 'theirs')
      expect(saver.get('q1')).toMatchObject({ value: 'version serveur', isReviewed: true, status: 'saved', conflict: null })
      expect(calls).toHaveLength(1)
      saver.edit('q1', { value: 'suite' })
      await vi.advanceTimersByTimeAsync(700)
      expect(calls[1].expected).toBe('v9')
    })
  })
})
