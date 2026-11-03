import type { AnswerInput } from '../../api/types'

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export interface AnswerState extends AnswerInput {
  status: SaveStatus
}

export interface SaverSnapshot {
  /** Incrémenté à chaque changement : sert d'identité pour useSyncExternalStore. */
  revision: number
  /** Statut global agrégé sur toutes les réponses. */
  status: SaveStatus
}

interface Entry {
  value: string
  isReviewed: boolean
  /** Incrémenté à chaque modification locale. */
  version: number
  /** Dernier contenu confirmé par le serveur. */
  confirmed: AnswerInput
  inFlight: boolean
  timer: ReturnType<typeof setTimeout> | null
  status: SaveStatus
}

const EMPTY: AnswerInput = { value: '', isReviewed: false }

/**
 * Sauvegarde automatique des réponses.
 *
 * - La source de vérité de l'affichage est le brouillon local : une réponse serveur tardive
 *   ne l'écrase jamais.
 * - Débounce par réponse ; au plus une requête en vol par réponse (les écritures d'une même
 *   réponse sont sérialisées, donc la dernière modification gagne côté serveur).
 * - « saved » n'est atteint qu'après confirmation du serveur ET si rien n'a changé depuis l'envoi.
 * - Aucune requête si le contenu est identique à ce que le serveur a confirmé.
 */
export class AnswerSaver {
  private entries = new Map<string, Entry>()
  private listeners = new Set<() => void>()
  private snapshot: SaverSnapshot = { revision: 0, status: 'idle' }
  private disposed = false

  private readonly save: (questionId: string, data: AnswerInput) => Promise<void>
  private readonly debounceMs: number

  constructor(save: (questionId: string, data: AnswerInput) => Promise<void>, debounceMs = 700) {
    this.save = save
    this.debounceMs = debounceMs
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = () => this.snapshot

  /** Initialise l'état confirmé depuis le serveur, sans toucher aux brouillons non synchronisés. */
  load(answers: Array<AnswerInput & { questionId: string }>) {
    for (const a of answers) {
      const existing = this.entries.get(a.questionId)
      if (existing && existing.status !== 'idle' && existing.status !== 'saved') continue
      this.entries.set(a.questionId, this.makeEntry({ value: a.value, isReviewed: a.isReviewed }, 'idle'))
    }
    this.emit()
  }

  get(questionId: string): AnswerState {
    const e = this.entries.get(questionId)
    return e
      ? { value: e.value, isReviewed: e.isReviewed, status: e.status }
      : { ...EMPTY, status: 'idle' }
  }

  edit(questionId: string, patch: Partial<AnswerInput>) {
    if (this.disposed) return
    const e = this.entries.get(questionId) ?? this.makeEntry(EMPTY, 'idle')
    this.entries.set(questionId, e)
    if (patch.value !== undefined) e.value = patch.value
    if (patch.isReviewed !== undefined) e.isReviewed = patch.isReviewed
    e.version++
    e.status = 'pending'
    if (e.timer) clearTimeout(e.timer)
    e.timer = setTimeout(() => void this.send(questionId), this.debounceMs)
    this.emit()
  }

  /** Relance immédiatement la sauvegarde d'une réponse (échec précédent ou envoi anticipé). */
  retry(questionId: string) {
    return this.send(questionId)
  }

  /** Envoie sans attendre le débounce tout ce qui n'est pas encore confirmé. */
  async flush() {
    const ids = [...this.entries].filter(([, e]) => this.isUnsynced(e)).map(([id]) => id)
    await Promise.all(ids.map((id) => this.send(id)))
  }

  hasUnsaved() {
    return [...this.entries.values()].some((e) => this.isUnsynced(e))
  }

  dispose() {
    this.disposed = true
    for (const e of this.entries.values()) if (e.timer) clearTimeout(e.timer)
    this.listeners.clear()
  }

  private isUnsynced(e: Entry) {
    return e.inFlight || e.timer !== null || e.status === 'error' || e.status === 'pending'
  }

  private makeEntry(confirmed: AnswerInput, status: SaveStatus): Entry {
    return { ...confirmed, version: 0, confirmed, inFlight: false, timer: null, status }
  }

  private async send(questionId: string): Promise<void> {
    const e = this.entries.get(questionId)
    if (!e) return
    if (e.timer) {
      clearTimeout(e.timer)
      e.timer = null
    }
    if (e.inFlight) return // la requête en cours relancera un envoi si le brouillon a changé

    if (e.value === e.confirmed.value && e.isReviewed === e.confirmed.isReviewed) {
      e.status = 'saved' // déjà identique au serveur : aucune requête
      this.emit()
      return
    }

    const sentVersion = e.version
    const payload: AnswerInput = { value: e.value, isReviewed: e.isReviewed }
    e.inFlight = true
    e.status = 'saving'
    this.emit()

    try {
      await this.save(questionId, payload)
      e.confirmed = payload
      e.inFlight = false
      if (e.version === sentVersion) e.status = 'saved'
      else if (!e.timer) {
        this.emit()
        return this.send(questionId) // modifié pendant le vol, sans débounce en attente
      }
    } catch {
      e.inFlight = false
      // Si une modification plus récente attend son débounce, elle retentera l'envoi.
      e.status = e.timer ? 'pending' : 'error'
    }
    this.emit()
  }

  private emit() {
    const statuses = [...this.entries.values()].map((e) => e.status)
    const status: SaveStatus = statuses.includes('error')
      ? 'error'
      : statuses.includes('saving')
        ? 'saving'
        : statuses.includes('pending')
          ? 'pending'
          : statuses.includes('saved')
            ? 'saved'
            : 'idle'
    this.snapshot = { revision: this.snapshot.revision + 1, status }
    for (const l of this.listeners) l()
  }
}
