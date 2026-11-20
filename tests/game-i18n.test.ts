import { describe, expect, it } from 'vitest'
import { zh } from '../src/i18n/game-zh-CN'

const dataLabels = [
  'Club', 'Maul', 'Spear', 'Sling', 'Hearth Camp',
  'Tuskhog', 'Mudsnapper', 'Dunestalker', 'Emberbeetle', 'Ashfang', 'Ruinhorn', 'Vulkarr',
  'Flank', 'Head', 'Tail', 'Pounce', 'Soft underside', 'Hind legs', 'Glowing throat',
  'Reedgrass', 'Collect', 'Mendleaf', 'Pick', 'Mine', 'Chip',
]

describe('game Chinese glossary', () => {
  it('translates every player-visible data label identified in the source audit', () => {
    for (const label of dataLabels) expect(zh(label), label).not.toBe(label)
  })

  it('does not let short keys corrupt longer words', () => {
    expect(zh('Not yet sighted')).toBe('尚未目击')
    expect(zh('No hunts yet.')).toBe('尚无狩猎记录。')
    expect(zh('No')).toBe('否')
  })

  it('translates undiscovered species copy in the journal', () => {
    expect(zh('Unknown beast')).toBe('未知荒兽')
    expect(zh('Rumoured to roam 雾歌海岸. Get within sight of it to begin an entry.')).toBe(
      '据传出没于雾歌海岸。靠近目击后即可开始记录。',
    )
  })

  it('translates hotbar tooltips and the locked-tool warning', () => {
    expect(zh('Quick jabs and hooks. Always free, but the weakest swing.')).toBe('快速刺拳与勾拳。随时可用，但伤害最低。')
    expect(zh('Craft it at the camp workbench.')).toBe('前往营地工作台制作。')
    expect(zh('Craft a Flint Hatchet at camp first.')).toBe('请先在营地制作燧石手斧。')
    expect(zh('Craft a Flint Pick at the camp workbench to mine this.')).toBe('需要先在营地工作台制作燧石矿镐才能采掘。')
  })
})
