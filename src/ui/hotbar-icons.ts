import type { GearId, HeldId } from '../game/data'

/**
 * Skill-bar icons, rendered offline by scripts/iconforge.ts (`pnpm icons`) so every weapon
 * shares one camera, light rig and subject scale. Keys are gear ids, plus the bare-hands slot.
 */
export const HOTBAR_ICON: Partial<Record<GearId | HeldId, string>> = {
  club: './ui/icons/weapon-club.png',
  flintMaul: './ui/icons/weapon-maul.png',
  amberHammer: './ui/icons/weapon-amber-hammer.png',
  obsidianClub: './ui/icons/weapon-obsidian-club.png',
  boneSpear: './ui/icons/weapon-bone-spear.png',
  stalkerLance: './ui/icons/weapon-stalker-lance.png',
  reedSling: './ui/icons/weapon-reed-sling.png',
  sinewSling: './ui/icons/weapon-sinew-sling.png',
  flintHatchet: './ui/icons/weapon-hatchet.png',
  flintPick: './ui/icons/weapon-pick.png',
  hands: './ui/icons/weapon-fists.png',
}
