export const PRODUCT_CATEGORIES = [
  "Verduras",
  "Frutas",
  "Tubérculos",
  "Hortalizas",
  "Abarrotes",
  "Carnes",
] as const;

export const normalizeSearchText = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const editDistance = (left: string, right: string) => {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return previous[right.length];
};

const CATEGORY_ALIASES: Record<string, readonly string[]> = {
  Verduras: ["vegetales", "verdura"],
  Frutas: ["fruta"],
  "Tubérculos": ["tuberculo", "tuberculos", "papas", "papa"],
  Hortalizas: ["hortaliza"],
  Abarrotes: ["abarrote", "mercado", "despensa"],
  Carnes: ["carne"],
};

export function findMatchingCategory(query: string): string | null {
  const tokens = normalizeSearchText(query).split(/[^a-z0-9]+/).filter(Boolean);
  for (const category of PRODUCT_CATEGORIES) {
    const names = [normalizeSearchText(category), ...(CATEGORY_ALIASES[category] ?? [])]
      .flatMap((name) => {
        const normalized = normalizeSearchText(name);
        return [normalized, normalized.replace(/s$/, "")];
      });
    if (tokens.some((token) => names.some((name) => {
      if (token === name) return true;
      // Tolerate spelling errors in full category words without treating prefixes
      // such as "ver" as the category "Verduras".
      return Math.min(token.length, name.length) >= 5 && editDistance(token, name) <= (Math.min(token.length, name.length) >= 6 ? 2 : 1);
    }))) return category;
  }
  return null;
}

/** Uses the same category variants for catalog items, filters, and chatbot answers. */
export function productMatchesCategory(productCategory: string, category: string): boolean {
  const normalizedProduct = normalizeSearchText(productCategory);
  if (!normalizedProduct) return false;
  const productWords = normalizedProduct.split(/[^a-z0-9]+/).filter(Boolean);
  const categoryNames = [normalizeSearchText(category), ...(CATEGORY_ALIASES[category] ?? [])]
    .flatMap((name) => {
      const normalized = normalizeSearchText(name);
      return [normalized, normalized.replace(/s$/, "")];
    });
  return categoryNames.some((name) => normalizedProduct.includes(name) || productWords.includes(name));
}

export function matchesSearchToken(token: string, text: string): boolean {
  const normalizedToken = normalizeSearchText(token).replace(/s$/, "");
  const words = normalizeSearchText(text).split(/[^a-z0-9]+/).filter(Boolean).map((word) => word.replace(/s$/, ""));
  if (normalizedToken.length <= 3) return words.includes(normalizedToken);
  return words.some((word) => word === normalizedToken ||
    (Math.min(word.length, normalizedToken.length) >= 5 && editDistance(word, normalizedToken) <= (Math.min(word.length, normalizedToken.length) >= 7 ? 2 : 1)));
}
