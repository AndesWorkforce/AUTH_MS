# Sistema de Excepciones Personalizadas

Este documento describe el sistema de excepciones personalizadas implementado en el microservicio AUTH_MS.

## Objetivo

Proporcionar un sistema unificado de manejo de errores que:

- Sea consistente en toda la aplicación
- Proporcione información detallada de errores al API Gateway
- Facilite el debugging y monitoreo
- Mejore la experiencia del usuario con mensajes claros

## Excepciones Disponibles

### 1. ValidationException

**Uso**: Errores de validación de datos de entrada.

**HTTP Status**: 400 (Bad Request)

**Estructura**:

```typescript
{
  message: string;
  statusCode: 400;
  timestamp: string;
  errorCode: 'VALIDATION_ERROR';
  errors?: Record<string, string[]>;
}
```

**Ejemplo de uso**:

```typescript
const errors: Record<string, string[]> = {};
if (!registerDto.name) {
  errors.name = ['Field name is required'];
}
if (!registerDto.email) {
  errors.email = ['Field email is required'];
}

if (Object.keys(errors).length > 0) {
  throw new ValidationException('Validation failed', errors);
}
```

**Respuesta**:

```json
{
  "message": "Validation failed",
  "statusCode": 400,
  "timestamp": "2025-11-11T10:30:00.000Z",
  "errorCode": "VALIDATION_ERROR",
  "errors": {
    "name": ["Field name is required"],
    "email": ["Field email is required"]
  }
}
```

### 2. DuplicateEntityException

**Uso**: Cuando se intenta crear una entidad que ya existe.

**HTTP Status**: 409 (Conflict)

**Estructura**:

```typescript
{
  message: string;
  statusCode: 409;
  timestamp: string;
  entity: string;
  field: string;
  value: string;
}
```

**Ejemplo de uso**:

```typescript
throw new DuplicateEntityException('User', 'email', registerDto.email);
```

**Respuesta**:

```json
{
  "message": "User with email 'user@example.com' already exists",
  "statusCode": 409,
  "timestamp": "2025-11-11T10:30:00.000Z",
  "entity": "User",
  "field": "email",
  "value": "user@example.com"
}
```

### 3. EntityNotFoundException

**Uso**: Cuando no se encuentra una entidad solicitada.

**HTTP Status**: 404 (Not Found)

**Estructura**:

```typescript
{
  message: string;
  statusCode: 404;
  timestamp: string;
  entity: string;
  identifier: string;
}
```

**Ejemplo de uso**:

```typescript
throw new EntityNotFoundException('User', userId);
```

**Respuesta**:

```json
{
  "message": "User with identifier '123' not found",
  "statusCode": 404,
  "timestamp": "2025-11-11T10:30:00.000Z",
  "entity": "User",
  "identifier": "123"
}
```

### 4. BusinessException

**Uso**: Errores de lógica de negocio que no encajan en las categorías anteriores.

**HTTP Status**: 400 (Bad Request) por defecto, configurable

**Estructura**:

```typescript
{
  message: string;
  statusCode: number;
  timestamp: string;
}
```

**Ejemplo de uso**:

```typescript
throw new BusinessException('Invalid refresh token', 401);
```

**Respuesta**:

```json
{
  "message": "Invalid refresh token",
  "statusCode": 401,
  "timestamp": "2025-11-11T10:30:00.000Z"
}
```

## Cuándo usar cada excepción

| Excepción                        | Caso de uso                                                     |
| -------------------------------- | --------------------------------------------------------------- |
| `ValidationException`            | Datos de entrada inválidos, campos requeridos faltantes         |
| `DuplicateEntityException`       | Email/username ya registrado, nombre duplicado                  |
| `EntityNotFoundException`        | Usuario no encontrado, recurso no existe                        |
| `BusinessException`              | Reglas de negocio, estados inválidos, operaciones no permitidas |
| `UnauthorizedException` (NestJS) | Credenciales inválidas, token expirado                          |

## Logging de Errores

Todos los errores de comunicación RPC se registran con `Logger`:

```typescript
try {
  userData = await this.userClient.send('findUserByEmail', email).toPromise();
} catch (error) {
  this.logger.error(
    `Error finding user by email: ${error.message}`,
    error.stack,
  );
}
```

Esto permite:

- Monitoreo centralizado de errores
- Debugging de problemas de comunicación entre microservicios
- Trazabilidad completa de errores

## Mejores Prácticas

1. **Usa la excepción más específica**: Prefiere `DuplicateEntityException` sobre `BusinessException` cuando sea aplicable.

2. **Proporciona contexto**: Incluye información relevante en el mensaje y campos adicionales.

3. **Registra errores inesperados**: Usa `Logger` para errores que no se pueden manejar directamente.

4. **Mantén consistencia**: Usa el mismo formato de mensajes en toda la aplicación.

5. **No expongas detalles internos**: Los mensajes de error deben ser útiles sin revelar información sensible.

## Integración con API Gateway

El API Gateway captura estas excepciones y las transforma en respuestas HTTP apropiadas. La estructura JSON estandarizada facilita el manejo del lado del cliente.

## Migración desde excepciones de NestJS

| Antes                                      | Después                                            |
| ------------------------------------------ | -------------------------------------------------- |
| `ConflictException('User already exists')` | `DuplicateEntityException('User', 'email', email)` |
| `NotFoundException('User not found')`      | `EntityNotFoundException('User', userId)`          |
| `BadRequestException('Invalid data')`      | `ValidationException('Invalid data', errors)`      |
