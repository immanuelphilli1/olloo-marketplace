import { useEffect, useMemo, useState } from 'react'
import { accountApi } from '../api'
import { ApiError } from '../api/client'
import { mapApiBrowsingHistory } from '../api/mappers'
import ArrowRightSLineIcon from 'remixicon-react/ArrowRightSLineIcon'
import {
  getAllHistoryItemIds,
  getBrowsingHistoryEmptyStateMessage,
  type BrowsingHistorySection,
} from '../data/browsingHistory'
import { ProductCard } from './ProductCard'
import { AccountEmptyState } from './AccountEmptyState'
import { ListingLoader } from './ListingLoader'

function HistorySelectToggle({
  selected,
  onToggle,
  label,
  className = 'size-8',
}: {
  selected: boolean
  onToggle: () => void
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex shrink-0 cursor-pointer items-center justify-center rounded-full border-2 ${className} ${
        selected ? 'border-primary-orange bg-primary-orange' : 'border-border-secondary bg-bg-primary'
      }`}
      aria-label={label}
      aria-pressed={selected}
    >
      {selected ? <span className="size-3 rounded-full bg-bg-primary" aria-hidden /> : null}
    </button>
  )
}

function BrowsingHistoryManageBar({
  selectedCount,
  allSelected,
  onToggleSelectAll,
  onDelete,
  onDone,
}: {
  selectedCount: number
  allSelected: boolean
  onToggleSelectAll: () => void
  onDelete: () => void
  onDone: () => void
}) {
  return (
    <>
      {/* <div className="hidden items-center justify-between gap-4 border-b border-border-primary px-4 py-4 lg:flex lg:px-0">
        <div className="flex items-center gap-2">
          <HistorySelectToggle
            selected={allSelected}
            onToggle={onToggleSelectAll}
            label={allSelected ? 'Deselect all items' : 'Select all items'}
          />
          <span className="text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
            Select all
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDelete}
            disabled={selectedCount === 0}
            className="btn-orange flex cursor-pointer items-center justify-center rounded-full px-4 py-2 text-base font-medium leading-5 tracking-[-0.32px] text-text-inverse disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete({selectedCount})
          </button>
          <button
            type="button"
            onClick={onDone}
            className="cursor-pointer rounded-full px-4 py-2 text-base font-medium leading-5 tracking-[-0.32px] text-text-primary"
          >
            Done
          </button>
        </div>
      </div> */}

      <div className="fixed max-w-340 mx-auto inset-x-0 bottom-0 z-40 flex items-center justify-between gap-2 border-t border-border-primary bg-bg-primary p-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 lg:pl-[17em] ">
          <HistorySelectToggle
            selected={allSelected}
            onToggle={onToggleSelectAll}
            label={allSelected ? 'Deselect all items' : 'Select all items'}
            className="size-8"
          />
          <span className="text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
            Select all
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onDelete}
            disabled={selectedCount === 0}
            className="btn-orange flex cursor-pointer items-center justify-center rounded-full px-4 py-2 text-base font-medium leading-5 tracking-[-0.32px] text-text-inverse disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete({selectedCount})
          </button>
          <button
            type="button"
            onClick={onDone}
            className="cursor-pointer rounded-full px-4 py-2 text-base font-medium leading-5 tracking-[-0.32px] text-text-primary"
          >
            Done
          </button>
        </div>
      </div>
    </>
  )
}

function BrowsingHistorySectionBlock({
  section,
  isManageMode,
  selectedIds,
  onEnterManageMode,
  onToggleSection,
  onToggleItem,
}: {
  section: BrowsingHistorySection
  isManageMode: boolean
  selectedIds: Set<string>
  onEnterManageMode: () => void
  onToggleSection: () => void
  onToggleItem: (itemId: string) => void
}) {
  const sectionItemIds = section.items.map((item) => item.id)
  const sectionAllSelected =
    sectionItemIds.length > 0 && sectionItemIds.every((id) => selectedIds.has(id))

  return (
    <section className="flex flex-col gap-4 lg:gap-6">
      <div className="flex items-center gap-2">
        {isManageMode ? (
          <HistorySelectToggle
            selected={sectionAllSelected}
            onToggle={onToggleSection}
            label={
              sectionAllSelected
                ? `Deselect all items from ${section.label}`
                : `Select all items from ${section.label}`
            }
            className="size-8 lg:size-8"
          />
        ) : null}
        <h2
          className={`min-w-0 flex-1 font-medium text-text-primary ${
            isManageMode
              ? 'text-base leading-5 tracking-[-0.32px]'
              : 'text-2xl leading-8 tracking-[-0.48px] lg:text-2xl'
          }`}
        >
          {section.label}
        </h2>
        {!isManageMode && section.id === 'today' ? (
          <button
            type="button"
            onClick={onEnterManageMode}
            className="group flex shrink-0 cursor-pointer items-center text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-primary"
          >
            Manage
            <ArrowRightSLineIcon
              className="size-6 text-text-secondary transition-colors group-hover:text-primary-orange"
              aria-hidden
            />
          </button>
        ) : null}
        {!isManageMode && section.id !== 'today' ? (
          <button
            type="button"
            onClick={onEnterManageMode}
            className="group flex shrink-0 cursor-pointer items-center text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-primary lg:hidden"
          >
            Manage
            <ArrowRightSLineIcon
              className="size-6 text-text-secondary transition-colors group-hover:text-primary-orange"
              aria-hidden
            />
          </button>
        ) : null}
      </div>

      {section.items.length > 0 ? (
        <div className="grid grid-cols-2 items-stretch gap-2 lg:grid-cols-3 xl:grid-cols-5 lg:gap-2">
          {section.items.map((item) => (
            <ProductCard
              key={item.id}
              product={item.product}
              enableAddButton={!isManageMode}
              selectionMode={
                isManageMode
                  ? {
                      selected: selectedIds.has(item.id),
                      onSelectedChange: () => onToggleItem(item.id),
                    }
                  : undefined
              }
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}

/** Inline confirmation, so clearing the whole history is never one stray tap. */
function ClearAllConfirm({
  isClearing,
  onCancel,
  onConfirm,
}: {
  isClearing: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="mb-6 rounded-2xl border border-border-primary bg-bg-secondary p-4">
      <p className="text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
        Clear your entire browsing history?
      </p>
      <p className="mt-2 text-sm leading-4.5 tracking-[-0.28px] text-text-secondary">
        This removes every product you have viewed and cannot be undone.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isClearing}
          className="btn-orange flex h-11 cursor-pointer items-center justify-center rounded-full px-5 text-base font-medium leading-5 tracking-[-0.32px] text-text-inverse disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isClearing ? 'Clearing…' : 'Yes, clear all'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isClearing}
          className="flex h-11 cursor-pointer items-center justify-center rounded-full bg-bg-primary px-5 text-base font-medium leading-5 tracking-[-0.32px] text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export function BrowsingHistoryPanel() {
  // Starts empty: the API is the only source of truth, so an account with no
  // browsing shows the empty state rather than sample products.
  const [sections, setSections] = useState<BrowsingHistorySection[]>([])
  const [isManageMode, setIsManageMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isClearing, setIsClearing] = useState(false)
  const [showClearAll, setShowClearAll] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadHistory() {
      setIsLoading(true)
      try {
        const response = await accountApi.getBrowsingHistory()
        const items = mapApiBrowsingHistory(response)
        // Set unconditionally, including for an empty result, so a genuinely
        // empty history is not masked by leftover rows.
        if (!cancelled) {
          setSections(items)
        }
      } catch {
        // Keep whatever is on screen; the banner below reports load failures.
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadHistory()

    return () => {
      cancelled = true
    }
  }, [])

  const allItemIds = useMemo(() => getAllHistoryItemIds(sections), [sections])
  const selectedCount = selectedIds.size
  const allSelected = allItemIds.length > 0 && allItemIds.every((id) => selectedIds.has(id))
  const hasHistory = sections.some((section) => section.items.length > 0)

  /** Empties the list everywhere, then tells the server to forget it too. */
  const handleClearAll = async () => {
    const previous = sections

    setSections([])
    setSelectedIds(new Set())
    setIsManageMode(false)
    setShowClearAll(false)
    setIsClearing(true)
    setErrorMessage(null)

    try {
      await accountApi.clearBrowsingHistory()
    } catch (error) {
      setSections(previous)
      setErrorMessage(
        error instanceof ApiError && error.message
          ? error.message
          : 'We could not clear your browsing history. Please try again.',
      )
    } finally {
      setIsClearing(false)
    }
  }

  const exitManageMode = () => {
    setIsManageMode(false)
    setSelectedIds(new Set())
  }

  const toggleItem = (itemId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const toggleSection = (section: BrowsingHistorySection) => {
    const sectionItemIds = section.items.map((item) => item.id)
    const sectionAllSelected =
      sectionItemIds.length > 0 && sectionItemIds.every((id) => selectedIds.has(id))

    setSelectedIds((current) => {
      const next = new Set(current)
      if (sectionAllSelected) {
        sectionItemIds.forEach((id) => next.delete(id))
      } else {
        sectionItemIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
      return
    }
    setSelectedIds(new Set(allItemIds))
  }

  /** Removes the selected rows locally, then mirrors the delete on the server. */
  const handleDelete = async () => {
    if (selectedCount === 0) return

    const previous = sections
    const rids = [...selectedIds]

    setSections((current) =>
      current
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => !selectedIds.has(item.id)),
        }))
        .filter((section) => section.items.length > 0),
    )
    setSelectedIds(new Set())

    // Mappers fall back to a synthesized id (`today-0`, `history-3`) when the API
    // omits `rid`; those are not server records, so there is nothing to delete.
    const serverRids = rids.filter((id) => !/^(today|history|nov-\d+|item)-?\d*$/.test(id))
    if (serverRids.length === 0) return

    try {
      await accountApi.deleteBrowsingHistory(serverRids)
    } catch {
      setSections(previous)
    }
  }

  return (
    <div className={isManageMode ? 'pb-24 lg:pb-0' : undefined}>
      {isManageMode ? (
        <BrowsingHistoryManageBar
          selectedCount={selectedCount}
          allSelected={allSelected}
          onToggleSelectAll={toggleSelectAll}
          onDelete={handleDelete}
          onDone={exitManageMode}
        />
      ) : null}

      {hasHistory && !isManageMode ? (
        <div className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={() => setShowClearAll(true)}
            className="cursor-pointer text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-secondary underline underline-offset-4 hover:text-primary-orange"
          >
            Clear all history
          </button>
        </div>
      ) : null}

      {errorMessage ? (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-orange-light px-4 py-3 text-sm font-medium leading-4.5 tracking-[-0.28px] text-primary-orange"
        >
          {errorMessage}
        </p>
      ) : null}

      {showClearAll ? (
        <ClearAllConfirm
          isClearing={isClearing}
          onCancel={() => setShowClearAll(false)}
          onConfirm={() => void handleClearAll()}
        />
      ) : null}

      {isLoading ? (
        <ListingLoader label="Loading browsing history" />
      ) : hasHistory ? (
        <div className="flex flex-col gap-8 lg:gap-10">
          {sections.map((section) => (
            <BrowsingHistorySectionBlock
              key={section.id}
              section={section}
              isManageMode={isManageMode}
              selectedIds={selectedIds}
              onEnterManageMode={() => setIsManageMode(true)}
              onToggleSection={() => toggleSection(section)}
              onToggleItem={toggleItem}
            />
          ))}
        </div>
      ) : (
        <AccountEmptyState message={getBrowsingHistoryEmptyStateMessage()} />
      )}
    </div>
  )
}
