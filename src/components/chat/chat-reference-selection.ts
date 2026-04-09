import type { MessageReference } from "@/types/database"

interface ReferenceOption {
  id: string
  label: string
}

export function areAllReferencesSelected(
  references: MessageReference[],
  type: "prompt" | "document",
  items: ReferenceOption[]
): boolean {
  if (items.length === 0) {
    return false
  }

  const selectedIds = new Set(
    references.filter((reference) => reference.type === type).map((reference) => reference.id)
  )

  return items.every((item) => selectedIds.has(item.id))
}

export function toggleAllReferencesForType(
  references: MessageReference[],
  type: "prompt" | "document",
  items: ReferenceOption[]
): MessageReference[] {
  const otherReferences = references.filter((reference) => reference.type !== type)

  if (areAllReferencesSelected(references, type, items)) {
    return otherReferences
  }

  return [
    ...otherReferences,
    ...items.map((item) => ({
      type,
      id: item.id,
      title: item.label,
    })),
  ]
}
