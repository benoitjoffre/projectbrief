import type { AnswerInput } from '../../api/types'

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict'

/** Version de la réponse côté serveur, renvoyée lors d'un conflit d'écriture. */
export interface ServerAnswer extends AnswerInput {
  updatedAt: string | null
}

/** À lever par la fonction de sauvegarde quand le serveur refuse une écriture obsolète (409). */
export class SaveConflict extends Error {
  current: ServerAnswer
  constructor(current: ServerAnswer) {
    super('Conflit de modification')
    this.current = current
  }
}

/**
 * Envoie une réponse. `expectedUpdatedAt` est la version que cet éditeur a vue pour la dernière fois
 * (null si aucune réponse n'existait) : le serveur refuse l'écriture si la réponse a changé entre-temps.
 */
export type SaveFn = (
  questionId: string,
  data: AnswerInput,
  expectedUpdatedAt: string | null,
) => Promise<{ updatedAt: string }>

export interface AnswerState extends AnswerInput {
  status: SaveStatus
  /** Version du serveur en conflit avec le brouillon local, le cas échéant. */
  conflict: ServerAnswer | null
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
  /** Dernière version du serveur vue par ce client (null : aucune réponse). */
  serverUpdatedAt: string | null
  conflict: ServerAnswer | null
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
 * - Écritures obsolètes : chaque envoi porte la version vue du serveur. Si une autre personne (client
 *   ou développeur) a modifié la réponse entre-temps, le serveur refuse ; la réponse passe en
 *   « conflict » et rien n'est écrasé tant que l'utilisateur n'a pas choisi (resolveConflict).
 */
export class AnswerSaver {
  private entries = new Map<string, Entry>()
  private listeners = new Set<() => void>()
  private snapshot: SaverSnapshot = { revision: 0, status: 'idle' }
  private disposed = false
  private readonly save: SaveFn
  private readonly debounceMs: number

  constructor(save: SaveFn, debounceMs = 700) {
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
  load(answers: Array<{ questionId: string; value: string; isReviewed?: boolean; updatedAt: string }>) {
    for (const a of answers) {
      const existing = this.entries.get(a.questionId)
      if (existing && existing.status !== 'idle' && existing.status !== 'saved') continue
      const confirmed = { value: a.value, isReviewed: a.isReviewed ?? false }
      this.entries.set(a.questionId, this.makeEntry(confirmed, 'idle', a.updatedAt))
    }
    this.emit()
  }

  get(questionId: string): AnswerState {
    const e = this.entries.get(questionId)
    return e
      ? { value: e.value, isReviewed: e.isReviewed, status: e.status, conflict: e.conflict }
      : { ...EMPTY, status: 'idle', conflict: null }
  }

  edit(questionId: string, patch: Partial<AnswerInput>) {
    if (this.disposed) return
    const e = this.entries.get(questionId) ?? this.makeEntry(EMPTY, 'idle', null)
    this.entries.set(questionId, e)
    if (patch.value !== undefined) e.value = patch.value
    if (patch.isReviewed !== undefined) e.isReviewed = patch.isReviewed
    e.version++
    if (e.status === 'conflict') {
      this.emit() // le brouillon est conservé ; rien n'est envoyé tant que le conflit n'est pas résolu
      return
    }
    e.status = 'pending'
    if (e.timer) clearTimeout(e.timer)
    e.timer = setTimeout(() => void this.send(questionId), this.debounceMs)
    this.emit()
  }

  /** Résout un conflit : garder sa version (réécrit par-dessus) ou reprendre celle du serveur. */
  resolveConflict(questionId: string, choice: 'mine' | 'theirs') {
    const e = this.entries.get(questionId)
    if (!e || e.status !== 'conflict' || !e.conflict) return
    const theirs = e.conflict
    e.confirmed = { value: theirs.value, isReviewed: theirs.isReviewed }
    e.serverUpdatedAt = theirs.updatedAt
    e.conflict = null
    if (choice === 'theirs') {
      e.value = theirs.value
      e.isReviewed = theirs.isReviewed
      e.version++
      e.status = 'saved'
      this.emit()
      return
    }
    e.status = 'pending'
    void this.send(questionId)
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
    return e.inFlight || e.timer !== null || e.status === 'error' || e.status === 'pending' || e.status === 'conflict'
  }

  private makeEntry(confirmed: AnswerInput, status: SaveStatus, serverUpdatedAt: string | null): Entry {
    return { ...confirmed, version: 0, confirmed, serverUpdatedAt, conflict: null, inFlight: false, timer: null, status }
  }

  private async send(questionId: string): Promise<void> {
    const e = this.entries.get(questionId)
    if (!e) return
    if (e.timer) {
      clearTimeout(e.timer)
      e.timer = null
    }
    if (e.inFlight || e.status === 'conflict') return // la requête en cours relancera un envoi si le brouillon a changé

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
      const { updatedAt } = await this.save(questionId, payload, e.serverUpdatedAt)
      e.confirmed = payload
      e.serverUpdatedAt = updatedAt
      e.inFlight = false
      if (e.version === sentVersion) e.status = 'saved'
      else if (!e.timer) {
        this.emit()
        return this.send(questionId) // modifié pendant le vol, sans débounce en attente
      }
    } catch (err) {
      e.inFlight = false
      if (err instanceof SaveConflict) {
        if (e.timer) {
          clearTimeout(e.timer)
          e.timer = null
        }
        e.conflict = err.current
        e.status = 'conflict'
      } else {
        // Si une modification plus récente attend son débounce, elle retentera l'envoi.
        e.status = e.timer ? 'pending' : 'error'
      }
    }
    this.emit()
  }

  private emit() {
    const statuses = new Set([...this.entries.values()].map((e) => e.status))
    const status: SaveStatus = (['conflict', 'error', 'saving', 'pending', 'saved'] as const).find((s) => statuses.has(s)) ?? 'idle'
    this.snapshot = { revision: this.snapshot.revision + 1, status }
    for (const l of this.listeners) l()
  }
}
