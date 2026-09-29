export const splitTags = (text: string, current: string[], minLength = 1) => [
  ...new Set(
    text
      .split(/[\n,]/)
      .map((term) => term.trim())
      .filter((term) => term.length >= minLength && !current.includes(term))
  ),
]
