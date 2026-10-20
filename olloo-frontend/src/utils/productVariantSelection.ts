import type {
  ProductDetail,
  ProductDetailVariant,
  ProductOptionGroup,
} from '../data/productDetail'

export type VariantSelections = Record<string, string>

export function getDefaultVariant(variants: ProductDetailVariant[]): ProductDetailVariant | undefined {
  return variants.find((variant) => variant.isDefault) ?? variants[0]
}

export function selectionsFromVariant(
  variant: ProductDetailVariant,
  optionGroups: ProductOptionGroup[],
): VariantSelections {
  const selections: VariantSelections = {}
  for (const group of optionGroups) {
    if (group.key === 'color' && variant.color) selections.color = variant.color
    if (group.key === 'size' && variant.size) selections.size = variant.size
  }
  return selections
}

export function findVariantForSelections(
  variants: ProductDetailVariant[],
  optionGroups: ProductOptionGroup[],
  selections: VariantSelections,
): ProductDetailVariant | undefined {
  return variants.find((variant) =>
    optionGroups.every((group) => {
      const selected = selections[group.key]
      if (!selected) return true
      if (group.key === 'color') return variant.color === selected
      if (group.key === 'size') return variant.size === selected
      return variant.name === selected
    }),
  )
}

export function isValueAvailable(
  variants: ProductDetailVariant[],
  optionGroups: ProductOptionGroup[],
  selections: VariantSelections,
  groupKey: string,
  value: string,
): boolean {
  const probe = { ...selections, [groupKey]: value }
  const match = findVariantForSelections(variants, optionGroups, probe)
  return match ? match.inStock : false
}

export function slideIndexForSelection(
  detail: ProductDetail,
  variant: ProductDetailVariant | undefined,
  clickedColor?: string,
): number | null {
  if (variant?.imageIndex != null) return variant.imageIndex
  if (clickedColor) {
    const index = detail.gallery.findIndex(
      (image) =>
        detail.variants.find((entry) => entry.rid === image.variantRid)?.color === clickedColor,
    )
    if (index !== -1) return index
  }
  return null
}

export function resolveSelectionAfterPick(
  variants: ProductDetailVariant[],
  optionGroups: ProductOptionGroup[],
  current: VariantSelections,
  groupKey: string,
  value: string,
): VariantSelections {
  const next = { ...current, [groupKey]: value }
  if (findVariantForSelections(variants, optionGroups, next)) {
    return next
  }

  const candidates = variants.filter((variant) => {
    if (groupKey === 'color') return variant.color === value
    if (groupKey === 'size') return variant.size === value
    return variant.name === value
  })

  const preferred =
    candidates.find((variant) => variant.inStock) ?? candidates[0] ?? getDefaultVariant(variants)

  if (!preferred) return next

  return selectionsFromVariant(preferred, optionGroups)
}
