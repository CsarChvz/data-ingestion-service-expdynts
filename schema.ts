import { sql, relations, eq } from 'drizzle-orm';
import {
    index,
    pgTableCreator,
    varchar,
    timestamp,
    integer,
    json,
    pgEnum,
    uniqueIndex,
    pgView,
    pgMaterializedView,
    serial,
} from 'drizzle-orm/pg-core';

// Creador con prefijo por proyecto
export const createTable = pgTableCreator((name) => `expdynts_${name}`);

// Enums
export const estadoExpediente = pgEnum('estado_expediente', ['ACTIVE', 'ARCHIVED']);

export const estadoJuzgado = pgEnum('estado_juzgado', ['ACTIVE', 'ARCHIVED']);

// Tablas
export const extractos = createTable(
    'extractos',
    (d) => ({
        extractoId: d.varchar({ length: 50 }).primaryKey(),
        extracto_value: d.varchar({ length: 50 }),
        extracto_name: d.varchar({ length: 120 }).notNull(),
        key_search: d.varchar({ length: 100 }),
    }),
    (t) => [index('extractos_id_idx').on(t.extractoId)],
);

export const juzgados = createTable(
    'juzgados',
    {
        juzgadoId: varchar('juzgadoId', { length: 50 }).primaryKey(),
        value: varchar('value', { length: 50 }).notNull(),
        name: varchar('name', { length: 255 }).notNull(),
        judge: varchar('judge', { length: 100 }).notNull(),
        status_juzgado: estadoExpediente('status_juzgado').default('ACTIVE').notNull(),
        extractoId: varchar('extracto_id', { length: 50 })
            .notNull()
            .references(() => extractos.extractoId, { onDelete: 'cascade' }),
    },
    (t) => [
        index('juzgados_value_idx').on(t.value),
        index('juzgados_judge_idx').on(t.judge),
        index('juzgados_extracto_idx').on(t.extractoId),
    ],
);

export const expedientes = createTable(
    'expedientes',
    {
        expedienteId: serial('expediente_id').primaryKey(),
        exp: integer('exp').notNull(),
        fecha: integer('fecha').notNull(),
        cve_juz: varchar('cve_juz', { length: 50 }).references(() => juzgados.juzgadoId, { onDelete: 'set null' }),
        url: varchar('url', { length: 255 }).notNull(),
        acuerdos_json: json('acuerdos_json').notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at')
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (t) => [
        index('expedientes_exp_idx').on(t.exp),
        index('expedientes_juzgado_idx').on(t.cve_juz),
        index('expedientes_fecha_juzgado_idx').on(t.fecha, t.cve_juz),
    ],
);

export const usuarios = createTable(
    'usuarios',
    {
        usuarioId: serial('usuario_id').primaryKey(),
        externalId: varchar('external_id', { length: 255 }).unique(),
        email: varchar('email', { length: 255 }).notNull().unique(),
        createdAt: timestamp('created_at')
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
        updatedAt: timestamp('updated_at')
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (t) => [index('usuarios_email_idx').on(t.email)],
);

export const usuarioAttributes = createTable(
    'usuario_attributes',
    {
        usuarioAttributeId: integer('usuario_id')
            .primaryKey()
            .references(() => usuarios.usuarioId, { onDelete: 'cascade' }),
        nombre_usuario: varchar('nombre_usuario', { length: 255 }),
        apellido: varchar('apellido', { length: 255 }),
        phoneNumber: varchar('phone_number', { length: 15 }),
        preferencias: json('preferencias'),
        createdAt: timestamp('created_at')
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
        updatedAt: timestamp('updated_at')
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (t) => [index('usuario_attributes_phone_idx').on(t.phoneNumber)],
);

export const usuarioExpedientes = createTable(
    'usuario_expedientes',
    {
        usuarioExpedientesId: serial('usuario_expedientes_id').primaryKey(),
        usuarioId: integer('usuario_id')
            .notNull()
            .references(() => usuarios.usuarioId, { onDelete: 'cascade' }),
        expedienteId: integer('expediente_id')
            .notNull()
            .references(() => expedientes.expedienteId, { onDelete: 'cascade' }),
        status: estadoExpediente('status').default('ACTIVE').notNull(),
        createdAt: timestamp('created_at')
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
        updatedAt: timestamp('updated_at')
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (t) => [
        uniqueIndex('usuario_expediente_unq').on(t.usuarioId, t.expedienteId),
        index('usuario_expedientes_status_idx')
            .on(t.status)
            .where(sql`status = 'ACTIVE'`),
    ],
);

export const acuerdosHistorial = createTable(
    'acuerdos_historial',
    {
        acuerdosHistorialId: serial('acuerdos_historial_id').primaryKey(),
        usuarioExpedienteId: integer('usuario_expediente_id')
            .notNull()
            .references(() => usuarioExpedientes.usuarioExpedientesId, {
                onDelete: 'cascade',
            }),
        acuerdos: json('acuerdos').notNull(),
        hash: json('hash').notNull(),
        cambios_realizados: json('cambios_realizados'),
        createdAt: timestamp('created_at')
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
    },
    (t) => [
        index('acuerdos_historial_usuario_exp_idx').on(t.usuarioExpedienteId),
        index('acuerdos_historial_created_idx').on(t.createdAt),
    ],
);

// Relaciones
export const usuariosRelations = relations(usuarios, ({ one, many }) => ({
    attributes: one(usuarioAttributes, {
        fields: [usuarios.usuarioId],
        references: [usuarioAttributes.usuarioAttributeId],
        relationName: 'attributes',
    }),
    expedientes: many(usuarioExpedientes),
}));

export const usuarioAttributesRelations = relations(usuarioAttributes, ({ one, many }) => ({
    usuario: one(usuarios, {
        fields: [usuarioAttributes.usuarioAttributeId],
        references: [usuarios.usuarioId],
        relationName: 'usuario',
    }),
    usuarioExpedientes: many(usuarioExpedientes),
}));

export const usuarioExpedientesRelations = relations(usuarioExpedientes, ({ one, many }) => ({
    usuario: one(usuarios, {
        fields: [usuarioExpedientes.usuarioId],
        references: [usuarios.usuarioId],
    }),
    expediente: one(expedientes, {
        fields: [usuarioExpedientes.expedienteId],
        references: [expedientes.expedienteId],
    }),
    historialAcuerdos: many(acuerdosHistorial),
}));

export const acuerdosHistorialRelations = relations(acuerdosHistorial, ({ one }) => ({
    usuarioExpediente: one(usuarioExpedientes, {
        fields: [acuerdosHistorial.usuarioExpedienteId],
        references: [usuarioExpedientes.usuarioExpedientesId],
        relationName: 'usuarioExpediente',
    }),
}));

export const expedientesRelations = relations(expedientes, ({ one, many }) => ({
    juzgado: one(juzgados, {
        fields: [expedientes.cve_juz],
        references: [juzgados.juzgadoId],
    }),
    usuarioExpedientes: many(usuarioExpedientes),
    historialAcuerdos: many(acuerdosHistorial),
}));

export const juzgadosRelations = relations(juzgados, ({ one, many }) => ({
    extracto: one(extractos, {
        fields: [juzgados.extractoId],
        references: [extractos.extractoId],
    }),
    expedientes: many(expedientes),
}));

export const extractosRelations = relations(extractos, ({ many }) => ({
    juzgados: many(juzgados),
}));

// Vistas
export const expedientesCompletos = pgView('expedientes_completos').as((qb) =>
    qb
        .select({
            expedienteId: expedientes.expedienteId,
            numero: expedientes.exp,
            fecha: expedientes.fecha,
            url: expedientes.url,
            createdAt: expedientes.createdAt,
            juzgadoId: juzgados.juzgadoId,
            juzgadoNombre: juzgados.name,
            juzgadoValue: juzgados.value,
            extractoId: extractos.extractoId,
            extractoNombre: extractos.extracto_name,
        })
        .from(expedientes)
        .leftJoin(juzgados, eq(expedientes.cve_juz, juzgados.juzgadoId))
        .leftJoin(extractos, eq(juzgados.extractoId, extractos.extractoId)),
);

export const juzgadosFormateados = pgMaterializedView('juzgados_formateados').as((qb) =>
    qb
        .select({
            value: juzgados.value,
            name: juzgados.name,
            judge: juzgados.judge,
            id: juzgados.juzgadoId,
            key_search: extractos.key_search,
            extractoId: extractos.extractoId,
            extractoNombre: extractos.extracto_name,
        })
        .from(juzgados)
        .leftJoin(extractos, eq(juzgados.extractoId, extractos.extractoId)),
);

export const listaJuzgados = pgMaterializedView('lista_juzgados').as((qb) =>
    qb
        .select({
            value: juzgados.value,
            name: juzgados.name,
            judge: juzgados.judge,
            id: juzgados.juzgadoId,
            key_search: extractos.key_search,
        })
        .from(juzgados)
        .leftJoin(extractos, eq(juzgados.extractoId, extractos.extractoId)),
);

export const listaExtractos = pgMaterializedView('lista_extractos').as((qb) => qb.select().from(extractos));

export const extractosConJuzgados = pgMaterializedView('extractos_con_juzgados').as((qb) =>
    qb
        .select({
            extractoId: extractos.extractoId,
            extractoNombre: extractos.extracto_name,
            key_search: extractos.key_search,
            juzgadoValue: juzgados.value,
            juzgadoName: juzgados.name,
            judge: juzgados.judge,
            juzgadoId: juzgados.juzgadoId,
        })
        .from(extractos)
        .leftJoin(juzgados, eq(extractos.extractoId, juzgados.extractoId)),
);

export const usuariosConExpedientesActivos = pgView('usuarios_expedientes_activos').as((qb) =>
    qb
        .select({
            usuarioId: usuarios.usuarioId,
            email: usuarios.email,
            expedienteId: usuarioExpedientes.expedienteId,
            createdAt: usuarioExpedientes.createdAt,
        })
        .from(usuarios)
        .innerJoin(usuarioExpedientes, eq(usuarios.usuarioId, usuarioExpedientes.usuarioId))
        .where(eq(usuarioExpedientes.status, 'ACTIVE')),
);

// Tipos inferidos
export type Usuario = typeof usuarios.$inferSelect;
export type Expediente = typeof expedientes.$inferSelect;
export type UsuarioExpedientes = typeof usuarioExpedientes.$inferSelect;
export type UsuarioExpedienteConExpediente = UsuarioExpedientes & {
    expediente: Expediente;
};
export type UsuarioAtributos = typeof usuarioAttributes.$inferInsert;
export type Juzgado = typeof juzgados.$inferSelect;
export type Extracto = typeof extractos.$inferSelect;
export type JuzgadoExtracto = Juzgado & {
    extracto: Extracto;
};
export type ResultadoExpediente = UsuarioExpedientes & {
    expediente: Expediente & {
        juzgado:
            | (Juzgado & {
                  extracto: Extracto;
              })
            | null;
    };
};
