import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { GEAR, HELD_ORDER, type GearId, type HeldId } from '../src/game/data'
import { HOTBAR_ICON } from '../src/ui/hotbar-icons'

const heldIds = (): (GearId | HeldId)[] => [
  ...(Object.values(GEAR).filter(g => g.slot === 'weapon').map(g => g.id) as GearId[]),
  ...HELD_ORDER.filter(h => h !== 'weapon'),
]

describe('hotbar icon set', () => {
  it('covers every weapon and held tool', () => {
    for (const id of heldIds()) expect(HOTBAR_ICON[id], String(id)).toBeTruthy()
  })

  it('points at icon files that exist', () => {
    for (const [id, src] of Object.entries(HOTBAR_ICON)) {
      const file = path.resolve(import.meta.dirname, '../public', src.replace(/^\.\/?/, ''))
      expect(existsSync(file), `${id} -> ${src}`).toBe(true)
    }
  })
})
