# Configuración de Variables de Entorno - Auth Microservice

## Archivo .env Requerido

Crea un archivo `.env` en la raíz del proyecto `auth-ms` con el siguiente contenido:

```env
# Puerto del microservicio de autenticación
PORT=3002

# URL de conexión a la base de datos PostgreSQL para auth
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/auth_db?schema=public"
```

## Configuración de Base de Datos

### Crear la Base de Datos

Antes de ejecutar los comandos de Prisma, asegúrate de crear la base de datos:

```sql
-- Conectarse a PostgreSQL como superusuario
psql -U postgres

-- Crear la base de datos para auth
CREATE DATABASE auth_db;

-- Verificar que se creó
\l
```

### Comandos de Prisma

Una vez configurado el `.env`:

```bash
# Generar el cliente de Prisma
pnpm prisma:generate

# Aplicar el esquema a la base de datos
pnpm prisma:push

# (Opcional) Abrir Prisma Studio
pnpm prisma:studio
```

## Separación de Bases de Datos

- **auth-ms**: Usa `auth_db` (tablas: users, clients, teams, subteams, sessions, user_day_offs)
- **agent-ms**: Usa `events_db` (tablas: events)

Esto evita conflictos entre los esquemas de los diferentes microservicios.
