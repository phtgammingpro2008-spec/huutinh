/** Search key: lowercase, no Vietnamese accents ("Đức" → "duc"). SQLite's lower()/LIKE only fold ASCII. */
export const foldSearch = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
