import { afterEach, describe, expect, it, vi } from 'vitest'
import { DOCUMENT_SECTIONS } from '../../api/types'
import { BlobUrlHolder, DEFAULT_OPTIONS, validateOptions } from './exportOptions'

describe('configuration de l’export', () => {
  it('propose des valeurs par défaut adaptées à un document client', () => {
    expect(DEFAULT_OPTIONS.sections.risks).toBe(false)
    expect(DOCUMENT_SECTIONS.filter((s) => s !== 'risks').every((s) => DEFAULT_OPTIONS.sections[s])).toBe(true)
    expect(DEFAULT_OPTIONS.includeUnansweredQuestions).toBe(false)
    expect(validateOptions(DEFAULT_OPTIONS)).toEqual([])
  })

  it('refuse une version vide, trop longue ou avec des caractères interdits', () => {
    for (const version of ['', '   ', '../x', 'a/b', 'x'.repeat(31)]) {
      expect(validateOptions({ ...DEFAULT_OPTIONS, version }), JSON.stringify(version)).not.toEqual([])
    }
    for (const version of ['0.1', 'v1.2-rc 1', 'Édition 2']) {
      expect(validateOptions({ ...DEFAULT_OPTIONS, version })).toEqual([])
    }
  })

  it('exige au moins une section', () => {
    const none = Object.fromEntries(DOCUMENT_SECTIONS.map((s) => [s, false])) as typeof DEFAULT_OPTIONS.sections
    expect(validateOptions({ ...DEFAULT_OPTIONS, sections: none })).toEqual(['Sélectionnez au moins une section.'])
  })
})

describe('BlobUrlHolder', () => {
  afterEach(() => vi.restoreAllMocks())

  it('libère l’URL précédente à chaque remplacement et à l’abandon', () => {
    let n = 0
    const create = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:test-${++n}`)
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const holder = new BlobUrlHolder()
    expect(holder.set(new Blob(['a']))).toBe('blob:test-1')
    expect(revoke).not.toHaveBeenCalled()
    expect(holder.set(new Blob(['b']))).toBe('blob:test-2')
    expect(revoke).toHaveBeenCalledWith('blob:test-1')
    holder.clear()
    expect(revoke).toHaveBeenLastCalledWith('blob:test-2')
    holder.clear() // idempotent
    expect(revoke).toHaveBeenCalledTimes(2)
    expect(create).toHaveBeenCalledTimes(2)
  })
})
