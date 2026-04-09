export function toQueryString(obj: any) {
  const query: string[] = [];

  for (const key in obj) {
    const value = obj[key];

    // Skip unset values and accidental string placeholders.
    if (
      value === undefined ||
      value === null ||
      value === '' ||
      value === 'undefined' ||
      value === 'null'
    ) {
      continue;
    }

    query.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }

  return query.length ? `?${query.join('&')}` : '';
}
