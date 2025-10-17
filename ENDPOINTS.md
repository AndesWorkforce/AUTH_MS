# Endpoints del Microservicio de Autenticación

## 📋 Resumen de Módulos

### **4 Módulos Principales:**
1. **UserModule** - Gestión de usuarios y días libres
2. **ClientModule** - Gestión de clientes
3. **TeamModule** - Gestión de equipos y sub-equipos
4. **SessionModule** - Gestión de sesiones

### **Módulos de Soporte:**
- **PrismaModule** - Conexión a base de datos
- **AuthModule** - Autenticación y autorización

---

## 🔐 AuthModule

### Endpoints de Autenticación
- `auth.register` - Registro de usuarios
- `auth.login` - Inicio de sesión
- `auth.refresh-token` - Renovar token
- `auth.logout` - Cerrar sesión

---

## 👤 UserModule

### Endpoints de Usuarios
- `createUser` - Crear usuario
- `findAllUsers` - Obtener todos los usuarios
- `findUserById` - Obtener usuario por ID
- `findUserWithDayOffs` - Obtener usuario con días libres
- `updateUser` - Actualizar usuario
- `removeUser` - Eliminar usuario

### Endpoints de Días Libres
- `createUserDayOff` - Crear día libre
- `findUserDayOffs` - Obtener días libres de un usuario
- `findUserDayOffById` - Obtener día libre por ID
- `updateUserDayOff` - Actualizar día libre
- `removeUserDayOff` - Eliminar día libre

---

## 🏢 ClientModule

### Endpoints de Clientes
- `createClient` - Crear cliente
- `findAllClients` - Obtener todos los clientes
- `findClientById` - Obtener cliente por ID
- `updateClient` - Actualizar cliente
- `removeClient` - Eliminar cliente

---

## 👥 TeamModule

### Endpoints de Equipos
- `createTeam` - Crear equipo
- `findAllTeams` - Obtener todos los equipos
- `findTeamById` - Obtener equipo por ID
- `findTeamWithSubteams` - Obtener equipo con sub-equipos
- `updateTeam` - Actualizar equipo
- `removeTeam` - Eliminar equipo

### Endpoints de Sub-equipos
- `createSubteam` - Crear sub-equipo
- `findSubteamsByTeam` - Obtener sub-equipos de un equipo
- `findSubteamById` - Obtener sub-equipo por ID
- `updateSubteam` - Actualizar sub-equipo
- `removeSubteam` - Eliminar sub-equipo

---

## ⏱️ SessionModule

### Endpoints de Sesiones
- `createSession` - Crear sesión
- `findAllSessions` - Obtener todas las sesiones
- `findSessionById` - Obtener sesión por ID
- `findSessionsByUserId` - Obtener sesiones de un usuario
- `findActiveSessions` - Obtener sesiones activas
- `updateSession` - Actualizar sesión
- `endSession` - Finalizar sesión
- `removeSession` - Eliminar sesión

---

## 🚀 Uso de los Endpoints

Todos los endpoints utilizan el patrón de microservicios de NestJS con `@MessagePattern` y `@Payload`. Para usar estos endpoints desde el API Gateway, utiliza:

```typescript
// Ejemplo de uso desde API Gateway
this.client.send('createUser', createUserDto)
this.client.send('findAllUsers', {})
this.client.send('findUserById', userId)
```

---

## 📊 Estructura de Datos

### User
```typescript
{
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  puesto_trabajo: string;
  horario_laboral_inicio: string;
  horario_laboral_fin: string;
  cliente_id: string;
  team_id: string;
  subteam_id: string;
  fecha_creacion: Date;
  fecha_actualizacion: Date;
}
```

### Client
```typescript
{
  id: string;
  nombre: string;
  descripcion?: string;
  fecha_creacion: Date;
  fecha_actualizacion: Date;
}
```

### Team
```typescript
{
  id: string;
  nombre: string;
  descripcion?: string;
  cliente_id: string;
  fecha_creacion: Date;
  fecha_actualizacion: Date;
}
```

### Subteam
```typescript
{
  id: string;
  team_id: string;
  nombre: string;
  descripcion?: string;
  fecha_creacion: Date;
  fecha_actualizacion: Date;
}
```

### Session
```typescript
{
  id: string;
  user_id: string;
  inicio_sesion: Date;
  fin_sesion?: Date;
  duracion_total?: number;
  fecha_creacion: Date;
}
```

### UserDayOff
```typescript
{
  id: string;
  user_id: string;
  fecha: Date;
  motivo: string;
  fecha_creacion: Date;
}
```
