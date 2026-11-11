// Acomoda bloques en hojas, de arriba hacia abajo.
// Cada bloque: { space, advance, draw(top) }.
//   space   = alto que necesita libre para no partirse (un título pide espacio para su primer renglón)
//   advance = cuánto baja el cursor después de dibujarlo
// Regresa una lista de hojas; cada hoja es la lista de { block, top }.

const newPage = (cursor) => ({ cursor, items: [] });

const placeOn = (page, block) => ({
  cursor: page.cursor + block.advance,
  items: [...page.items, { block, top: page.cursor }],
});

export function paginate(blocks, { firstTop, nextTop, bottom }) {
  const place = (pages, block) => {
    const current = pages.at(-1);
    const fits = current.cursor + block.space <= bottom;
    return fits
      ? [...pages.slice(0, -1), placeOn(current, block)]
      : [...pages, placeOn(newPage(nextTop), block)];
  };
  return blocks.reduce(place, [newPage(firstTop)]).map((page) => page.items);
}
