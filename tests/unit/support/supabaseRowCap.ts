/* eslint-disable @typescript-eslint/no-explicit-any */
export function cappedClient(tables: Record<string, any[]>) {
  const queryBuilder = (tableName: string) => {
    const rows = tables[tableName] ?? [];
    const builder: any = {
      select: () => builder,
      is: () => builder,
      eq: () => builder,
      gte: () => builder,
      lte: () => builder,
      or: () => builder,
      in: () => builder,
      not: () => builder,
      order: () => builder,
      range: (from: number, to: number) => {
        const pageSize = to - from + 1;
        const capped = Math.min(pageSize, 1000);
        return Promise.resolve({
          data: rows.slice(from, from + capped),
          error: null,
        });
      },
      then: (resolve: any, reject: any) => {
        return Promise.resolve({
          data: rows.slice(0, 1000),
          error: null,
        }).then(resolve, reject);
      },
      single: () =>
        Promise.resolve({
          data: rows[0] ?? null,
          error: null,
        }),
    };
    return builder;
  };

  return {
    from: (table: string) => queryBuilder(table),
    auth: {
      getSession: () =>
        Promise.resolve({
          data: {
            session: {
              user: { id: "u1" },
            },
          },
        }),
    },
  } as any;
}
