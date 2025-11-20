# Manejo de Excepciones en AUTH_MS

## Contexto General

El microservicio AUTH_MS utiliza NestJS con transporte NATS para comunicación entre servicios. El manejo de errores y excepciones se realiza principalmente usando `RpcException` y un filtro global personalizado.

---

## 1. Lanzamiento de Excepciones

En los servicios (por ejemplo, `auth.service.ts`), los errores se lanzan así:

```typescript
throw new RpcException({
  status: 409,
  message: 'User already exists',
  custom: 'Duplicate email',
});
```

- Se utiliza siempre `RpcException` para asegurar que el error viaje correctamente por NATS.
- El objeto de error puede tener campos personalizados (`status`, `message`, `custom`).

---

## 2. Filtro Global de Excepciones

El archivo `src/common/filters/rpc-exception.filter.ts` define el filtro global:

```typescript
@Catch(RpcException)
export class RpcExceptionFilter implements IRpcExceptionFilter<RpcException> {
  catch(exception: RpcException, host: ArgumentsHost): Observable<any> {
    const error = exception.getError();
    return throwError(() => {
      if (typeof error === 'object' && error !== null) {
        return {
          status: (error as any).status || 500,
          message: (error as any).message || 'RPC Error',
          custom: (error as any).custom || null,
        };
      } else {
        return {
          status: 500,
          message: typeof error === 'string' ? error : 'RPC Error',
          custom: null,
        };
      }
    });
  }
}
```

- El filtro intercepta cualquier `RpcException` lanzada en el microservicio.
- Extrae el objeto de error y lo transforma en una estructura estándar.
- Si el error es un objeto, extrae `status`, `message` y `custom`. Si es un string, lo pone como mensaje.

---

## 3. Registro del Filtro

En `main.ts`:

```typescript
app.useGlobalFilters(new RpcExceptionFilter());
```

Esto asegura que todas las excepciones RPC sean procesadas por el filtro antes de enviarse al cliente.

---

## 4. Resumen de funcionamiento

- **Solo se debe lanzar `RpcException`** en los servicios para asegurar compatibilidad con NATS.
- El filtro global estandariza la respuesta de error.
- Los clientes pueden esperar siempre un objeto con al menos: `status`, `message`, `custom`.

---

## 5. Limitaciones

- Las excepciones personalizadas de NestJS (`HttpException`, etc.) no viajan correctamente por NATS si no se envuelven en `RpcException`.
- El campo `custom` es opcional y puede usarse para detalles adicionales.

---

## Ejemplo de respuesta de error

```json
{
  "status": 409,
  "message": "User already exists",
  "custom": "Duplicate email"
}
```

---

## Recomendación

- Mantener el uso de `RpcException` para todos los errores de microservicio.
- Si se desea mayor estandarización, definir una estructura fija para el objeto de error y documentarla para todos los equipos.
