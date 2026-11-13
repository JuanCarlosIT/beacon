// Convierte elementos del catálogo en opciones de <ResponsiveSelect>.
export const toOptions = (items, label = (item) => item.name, value = (item) => item.id) =>
  items.map((item) => ({ value: value(item), label: label(item) }));
