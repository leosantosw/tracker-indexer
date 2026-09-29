import { plural } from '@/lib/format'
import type { Content, Source } from '@/lib/schemas'

const UNTIL_LAST = 'Vazio: vai até a última página.'

export function pagesFieldText(source: Source, content: Content, pages: number | null) {
  if (source.mode === 'terms') return { label: 'Páginas por termo', description: UNTIL_LAST }

  const categories = source.categories?.[content]?.length
  if (!categories) return { label: 'Páginas por varredura', description: UNTIL_LAST }

  const counted = plural(categories, 'categoria', 'categorias')
  const description =
    pages && Number.isFinite(pages)
      ? `${counted}: até ${plural(categories * pages, 'página', 'páginas')} por execução.`
      : `${counted}, cada uma até a última página.`
  return { label: 'Páginas por categoria', description }
}
