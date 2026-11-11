// Prisma simulado para pruebas unitarias de repositorios.
// `handlers` = { modelo: { operación: (args) => resultado } }; cualquier otra llamada falla.
export function fakePrisma(handlers) {
  const calls = [];
  let transactions = 0;
  const model = (name) =>
    new Proxy(
      {},
      {
        get: (_, op) => async (args) => {
          calls.push({ model: name, op, args });
          const handler = handlers[name]?.[op];
          if (!handler) throw new Error(`Consulta inesperada: ${name}.${String(op)}`);
          return handler(args);
        },
      },
    );
  const db = new Proxy(
    {},
    {
      get: (_, name) =>
        name === '$transaction'
          ? async (work) => {
              transactions++;
              return work(db);
            }
          : model(name),
    },
  );
  return {
    db,
    calls,
    transactions: () => transactions,
    called: (name, op) => calls.filter((call) => call.model === name && call.op === op),
  };
}
