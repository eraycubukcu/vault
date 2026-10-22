// Minimal Prisma-benzeri projeksiyon: sahte DB'nin, handler'ın verdiği
// `include` / `select` argümanına göre yalnızca istenen alanları döndürmesini sağlar.
// Böylece testler sorgu argümanını değil, istemciye gerçekten giden veriyi doğrular.

type Args = true | { select?: Record<string, unknown>; include?: Record<string, unknown> } | undefined;

const isRelation = (value: unknown) =>
    Array.isArray(value)
        ? value.length > 0 && typeof value[0] === "object" && !(value[0] instanceof Date)
        : typeof value === "object" && value !== null && !(value instanceof Date);

const scalars = (data: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(data).filter(([, value]) => !isRelation(value)));

export function project<T>(data: T, args?: Args): T {
    if (Array.isArray(data)) {
        return data.map((item) => project(item, args)) as T;
    }
    if (data === null || typeof data !== "object") {
        return data;
    }
    const record = data as Record<string, unknown>;

    if (args && args !== true && args.select) {
        const out: Record<string, unknown> = {};
        for (const [key, nested] of Object.entries(args.select)) {
            if (!nested) continue;
            out[key] = isRelation(record[key]) ? project(record[key], nested as Args) : record[key];
        }
        return out as T;
    }

    const out = scalars(record);
    if (args && args !== true && args.include) {
        for (const [key, nested] of Object.entries(args.include)) {
            if (!nested) continue;
            out[key] = project(record[key], nested as Args);
        }
    }
    return out as T;
}

/** `{ where, include/select, ... }` argümanını alıp fixture'ı projekte eden mock gövdesi. */
export const projecting = <T>(fixture: T) => (args?: Record<string, any>) =>
    Promise.resolve(project(fixture, args && { select: args.select, include: args.include }));
