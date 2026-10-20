import AlarmWarningLineIcon from 'remixicon-react/AlarmWarningLineIcon'
import AppsLineIcon from 'remixicon-react/AppsLineIcon'
import ComputerLineIcon from 'remixicon-react/ComputerLineIcon'
import HammerLineIcon from 'remixicon-react/HammerLineIcon'
import HandbagLineIcon from 'remixicon-react/HandbagLineIcon'
import Home2LineIcon from 'remixicon-react/Home2LineIcon'
import LightbulbFlashLineIcon from 'remixicon-react/LightbulbFlashLineIcon'
import PaletteLineIcon from 'remixicon-react/PaletteLineIcon'
import PlantLineIcon from 'remixicon-react/PlantLineIcon'
import PriceTag3LineIcon from 'remixicon-react/PriceTag3LineIcon'
import StarLineIcon from 'remixicon-react/StarLineIcon'
import TShirt2LineIcon from 'remixicon-react/TShirt2LineIcon'

export type CategoryNavIcon = typeof StarLineIcon

const slugIcons: Record<string, CategoryNavIcon> = {
  electronics: ComputerLineIcon,
  fashion: TShirt2LineIcon,
  'home-garden': PlantLineIcon,
  decor: PaletteLineIcon,
  furniture: Home2LineIcon,
  accessories: HandbagLineIcon,
  construction: HammerLineIcon,
  energy: LightbulbFlashLineIcon,
}

const virtualIcons: Record<string, CategoryNavIcon> = {
  'all-categories': AppsLineIcon,
  featured: StarLineIcon,
  'new-releases': AlarmWarningLineIcon,
}

export function getCategoryNavIcon(categoryId: string): CategoryNavIcon {
  return virtualIcons[categoryId] ?? slugIcons[categoryId] ?? AppsLineIcon
}

export const linkBarFixedIcons = {
  featured: PriceTag3LineIcon,
  'new-releases': AlarmWarningLineIcon,
} as const
