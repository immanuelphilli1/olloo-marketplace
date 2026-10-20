import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ProductDetail, ProductDetailVariant } from '../data/productDetail'
import {
  findVariantForSelections,
  getDefaultVariant,
  isValueAvailable,
  resolveSelectionAfterPick,
  selectionsFromVariant,
  slideIndexForSelection,
  type VariantSelections,
} from '../utils/productVariantSelection'

export function useProductDetailSelection(detail: ProductDetail) {
  const { optionGroups, variants } = detail

  const [selections, setSelections] = useState<VariantSelections>(() => {
    const initial = getDefaultVariant(variants)
    return initial ? selectionsFromVariant(initial, optionGroups) : {}
  })

  const [legacyVariantIndex, setLegacyVariantIndex] = useState(0)
  const [galleryIndex, setGalleryIndex] = useState(0)

  useEffect(() => {
    const initial = getDefaultVariant(variants)
    setSelections(initial ? selectionsFromVariant(initial, optionGroups) : {})
    setLegacyVariantIndex(0)
    setGalleryIndex(0)
  }, [detail.product.id, optionGroups, variants])

  const selectedVariant = useMemo((): ProductDetailVariant | undefined => {
    if (optionGroups.length > 0) {
      return findVariantForSelections(variants, optionGroups, selections)
    }
    if (variants.length > 1) {
      return variants[legacyVariantIndex] ?? variants[0]
    }
    return variants[0]
  }, [legacyVariantIndex, optionGroups, selections, variants])

  useEffect(() => {
    if (!selectedVariant) return
    const nextIndex = slideIndexForSelection(detail, selectedVariant)
    if (nextIndex != null) {
      setGalleryIndex(nextIndex)
    }
  }, [detail, selectedVariant])

  const selectOption = useCallback(
    (groupKey: string, value: string) => {
      if (groupKey === 'color') {
        const variant = findVariantForSelections(
          variants,
          optionGroups,
          resolveSelectionAfterPick(variants, optionGroups, selections, groupKey, value),
        )
        const index = slideIndexForSelection(detail, variant, value)
        if (index != null) setGalleryIndex(index)
      }
      setSelections((current) =>
        resolveSelectionAfterPick(variants, optionGroups, current, groupKey, value),
      )
    },
    [detail, optionGroups, selections, variants],
  )

  const selectLegacyVariant = useCallback((index: number) => {
    setLegacyVariantIndex(index)
  }, [])

  const isOptionDisabled = useCallback(
    (groupKey: string, value: string) =>
      !isValueAvailable(variants, optionGroups, selections, groupKey, value),
    [optionGroups, selections, variants],
  )

  return {
    selectedVariant,
    selections,
    selectOption,
    selectLegacyVariant,
    legacyVariantIndex,
    isOptionDisabled,
    galleryIndex,
    setGalleryIndex,
    displayPriceAmount: selectedVariant?.priceAmount ?? detail.priceAmount,
    displayPriceCurrency: selectedVariant?.priceCurrency ?? detail.priceCurrency,
    inStock: selectedVariant?.inStock ?? detail.product.inStock ?? true,
    variantTitle: selectedVariant?.name,
    showOptionGroups: optionGroups.length > 0,
    showLegacyVariantRow: optionGroups.length === 0 && variants.length > 1,
    showSingleVariant: variants.length <= 1 && optionGroups.length === 0,
  }
}
