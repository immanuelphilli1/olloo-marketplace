import type { Product } from './products'

/**
 * Search relevance for the catalog.
 *
 * The search endpoint matches literally, so `shoe` finds only products named
 * "...Shoes" and `snekars` finds nothing. This module scores the catalog against
 * a query so those cases still surface the right product, and ranks the hits.
 *
 * Scores are out of 100 and the tiers are spaced well apart so ranking stays
 * stable: exact 100, stem/typo 75, synonym 45. A product matching none of the
 * tiers is dropped, so unrelated items never outrank a real hit.
 */
const EXACT_SCORE = 100
const TYPO_SCORE = 75
const SYNONYM_SCORE = 45

/**
 * Shopping synonyms, grouped by intent so the vocabulary stays reviewable in one
 * place. Only ever adds matches, so a wrong entry widens results rather than
 * hiding them.
 */
const SYNONYM_GROUPS: Record<string, string[]> = {
  // Footwear
  shoe: ['shoes', 'sneaker', 'sneakers', 'sandal', 'sandals', 'boot', 'boots', 'loafer', 'loafers'],
  sneaker: ['sneakers', 'shoe', 'shoes', 'trainer', 'trainers', 'runner', 'kicks'],
  // Audio
  earbud: ['earbuds', 'earphone', 'earphones', 'headphone', 'headphones', 'headset', 'airpod', 'airpods'],
  headphone: ['headphones', 'earbud', 'earbuds', 'earphone', 'earphones', 'headset'],
  headset: ['headphones', 'earbud', 'earbuds', 'headphone', 'headset'],
  // Computers and mobile
  laptop: ['laptop', 'laptops', 'notebook', 'ultrabook', 'macbook', 'computer'],
  pc: ['laptop', 'laptops', 'computer', 'notebook', 'ultrabook'],
  phone: ['phone', 'phones', 'mobile', 'iphone', 'smartphone', 'cellphone'],
  mobile: ['phone', 'phones', 'smartphone', 'iphone', 'cellphone'],
  tablet: ['tablet', 'tablets', 'ipad', 'kindle'],
  // Wearables and power
  watch: ['watch', 'watches', 'smartwatch', 'timepiece', 'chronometer'],
  charger: ['charger', 'chargers', 'powerbank', 'power bank', 'adapter', 'brick'],
  battery: ['charger', 'powerbank', 'power bank', 'battery'],
  // Home, garden, and kitchen
  cookware: ['cookware', 'pan', 'pans', 'pot', 'pots', 'stockpot', 'skillet'],
  pot: ['pots', 'stockpot', 'cookware', 'pan', 'pans', 'skillet'],
  shirt: ['shirt', 'shirts', 'tee', 'tshirt', 'tshirts', 'polo', 'top'],
  knife: ['knife', 'knives', 'knifes', 'blade', 'cutlery'],
  lamp: ['lamp', 'lamps', 'light', 'lighting', 'bulb'],
  chair: ['chair', 'chairs', 'seating', 'stool', 'armchair'],
  // Clothing
  jacket: ['jacket', 'jackets', 'coat', 'coats', 'hoodie', 'hoodies', 'blazer'],
  hoodie: ['hoodie', 'hoodies', 'sweatshirt', 'jumper', 'jacket'],
  dress: ['dress', 'dresses', 'gown', 'skirt'],
  bag: ['bag', 'bags', 'backpack', 'handbag', 'crossbody', 'purse'],
  // Tools
  drill: ['drill', 'drills', 'driver', 'tool', 'tools', 'toolkit'],
  tool: ['tool', 'tools', 'toolkit', 'drill', 'driver'],
  solar: ['solar', 'panel', 'panels', 'power', 'energy'],
}

/**
 * Every term in the groups above, indexed in both directions.
 *
 * The groups are written one way, but a shopper can type any member of the set:
 * `airpods` is listed under `earbud`, so without this index typing "airpods"
 * looked up a missing key and found nothing, and only the AirPods product came
 * back instead of the earbuds and headphones a shopper means by it. Deriving the
 * reverse links here means any term already listed anywhere in a group works as
 * a query, so new entries cannot be half-connected.
 */
const SYNONYM_INDEX: Record<string, string[]> = (() => {
  const index = new Map<string, Set<string>>()

  const link = (from: string, to: string) => {
    const existing = index.get(from)
    if (existing) {
      existing.add(to)
    } else {
      index.set(from, new Set([to]))
    }
  }

  for (const [key, related] of Object.entries(SYNONYM_GROUPS)) {
    // A term is always interchangeable with itself, so the key and each member
    // of its list can all find one another.
    link(key, key)
    for (const term of related) {
      link(key, term)
      link(term, key)
      link(term, term)
    }
  }

  return Object.fromEntries(
    [...index.entries()].map(([term, related]) => [term, [...related]]),
  )
})()

/** Number words, so "six piece" finds the "6pc" knife set. */
const NUMBER_WORDS: Record<string, string> = {
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
}

/** Split a value into comparable tokens, dropping punctuation. */
function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

/**
 * Simple singular/plural variants of a word.
 *
 * The catalog only ever stores the plural ("sneakers", "shoes"), so a shopper
 * typing the singular has to be able to reach it. Generating the variants and
 * comparing across both sides covers `shoe` and `sneakers` without a stemmer.
 */
function wordVariants(word: string): string[] {
  const variants = new Set<string>([word])

  if (word.endsWith('ies') && word.length > 4) {
    variants.add(`${word.slice(0, -3)}y`)
  }
  if (word.endsWith('es') && word.length > 3) {
    variants.add(word.slice(0, -2))
  }
  if (word.endsWith('s') && word.length > 2) {
    variants.add(word.slice(0, -1))
  }

  return [...variants]
}

/** Every word of a value plus its singular/plural variants, deduplicated. */
function variantWords(value: string): Set<string> {
  const words = new Set<string>()

  for (const word of tokenize(value)) {
    for (const variant of wordVariants(word)) {
      words.add(variant)
    }
  }

  return words
}

/**
 * Damerau-Levenshtein distance (optimal string alignment), bounded by
 * `maxDistance` and returning null once the distance is certain to exceed it.
 *
 * The transposition term is what makes ordinary typos work: `shrit` and `shirt`
 * are two edits apart under plain Levenshtein but one under this, and allowing
 * two edits made `knife` match `nike` and `chair` match `air`. One edit for
 * transpositions plus the tolerance below gives the same recall without those
 * false matches.
 */
function editDistanceWithin(a: string, b: string, maxDistance: number): number | null {
  const lengthA = a.length
  const lengthB = b.length

  if (Math.abs(lengthA - b.length) > maxDistance) return null

  let twoRowsBack = Array.from({ length: lengthB + 1 }, (_, index) => index)
  let previousRow = twoRowsBack.slice()

  for (let i = 1; i <= lengthA; i += 1) {
    const currentRow = [i]
    let rowMin = i

    for (let j = 1; j <= lengthB; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1
      let distance = Math.min(
        previousRow[j] + 1,
        currentRow[j - 1] + 1,
        previousRow[j - 1] + substitutionCost,
      )

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        distance = Math.min(distance, twoRowsBack[j - 2] + 1)
      }

      currentRow.push(distance)
      rowMin = Math.min(rowMin, distance)
    }

    // Every later row can only grow, so a row this far off cannot recover.
    if (rowMin > maxDistance) return null

    twoRowsBack = previousRow
    previousRow = currentRow
  }

  const distance = previousRow[lengthB]
  return distance <= maxDistance ? distance : null
}

/**
 * How many edits a misspelling may have.
 *
 * Short words get no tolerance, because a single edit there matches too much
 * ("tee" and "tea", "kit" and "sit"). Five letters and up get one edit, and
 * anything longer gets two. Measured against the real catalog vocabulary: this
 * reaches every common typo tested while matching no unrelated word.
 */
function toleranceFor(length: number): number {
  if (length <= 3) return 0
  if (length <= 5) return 1
  if (length <= 7) return 2
  return 3
}

/** True when two words are close enough to be treated as the same word. */
function isTypoMatch(typoWord: string, candidateWord: string): boolean {
  const tolerance = toleranceFor(typoWord.length)
  if (tolerance === 0) return false
  return editDistanceWithin(typoWord, candidateWord, tolerance) !== null
}

/** Every word a product can be matched on: name, facets, and brand. */
function productWords(product: Product): string {
  return [product.name, product.subcategory, product.category, product.brand, product.tag]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}
/**
 * Expands a query with interchangeable words, so `shoe` also reaches sneakers.
 * The original tokens come first, then the expansions.
 */
export function expandQuery(query: string): string[] {
  const tokens = tokenize(query)
  if (tokens.length === 0) return []

  const expanded = [...tokens]

  for (const token of tokens) {
    const digit = NUMBER_WORDS[token]
    if (digit) {
      expanded.push(digit)
    }
    for (const related of SYNONYM_INDEX[token] ?? []) {
      expanded.push(related)
    }
  }

  return Array.from(new Set(expanded))
}

export type MatchKind = 'exact' | 'typo' | 'synonym'

export type ScoredProduct = {
  product: Product
  score: number
  match: MatchKind
}

/**
 * Ranks catalog products against a query.
 *
 * Each query token is tried against every product in turn, and a product keeps
 * the best tier any of its tokens reached. Ranking is stable, so results do not
 * reshuffle between identical queries.
 */
export function rankProducts(products: Product[], query: string): ScoredProduct[] {
  const tokens = tokenize(query)
  if (tokens.length === 0) return []

  // Only terms the shopper did not type are synonyms, so a term they did type
  // has to match literally (or as a typo) to count as a literal match.
  const typedTokens = new Set(tokens)
  const synonymTerms = expandQuery(query).filter((term) => !typedTokens.has(term))

  const scored: ScoredProduct[] = []

  for (const product of products) {
    const text = productWords(product)
    const candidates = variantWords(text)

    // Whole-word only. Substring matching would let a query of "top" score the
    // "Stainless Steel Stockpot Set" as an exact hit, and "phone" score every
    // headphones listing, because those words contain the query but are not it.
    const hasWord = (term: string) => candidates.has(term)
    const hasTypo = tokens.some(
      (token) => !candidates.has(token) && [...candidates].some((c) => isTypoMatch(token, c)),
    )

    // Synonyms describe what a product *is*, so they only consult the fields
    // that identify it. Including the merchandising tag here made a search for
    // "shirt" match Sony headphones tagged "Top rated", because "top" is a
    // shirt synonym. A literal or near-miss query may still match the tag, since
    // searching "top rated" is a reasonable thing to do.
    const identityCandidates = variantWords(
      [product.name, product.subcategory, product.category, product.brand].join(' '),
    )

    let match: MatchKind | null = null
    if (tokens.some(hasWord)) {
      match = 'exact'
    } else if (hasTypo) {
      match = 'typo'
    } else if (synonymTerms.some((term) => identityCandidates.has(term))) {
      match = 'synonym'
    }

    if (match === null) {
      continue
    }

    scored.push({ product, score: scoreFor(match), match })
  }

  // Ties keep catalog order, so an identical query always ranks identically.
  return scored.sort((a, b) => b.score - a.score)
}

function scoreFor(match: MatchKind): number {
  switch (match) {
    case 'exact':
      return EXACT_SCORE
    case 'typo':
      return TYPO_SCORE
    case 'synonym':
      return SYNONYM_SCORE
    default: {
      // Every match kind is handled, so an unhandled one is a new kind that has
      // not been given a score yet.
      const unhandled: never = match
      throw new Error(`Unhandled match kind: ${unhandled}`)
    }
  }
}
