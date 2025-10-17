# Módulo de Autenticación

Este módulo proporciona funcionalidades completas de autenticación para el microservicio.

## Características

- ✅ Registro de usuarios
- ✅ Login con email y contraseña
- ✅ Refresh tokens para renovar access tokens
- ✅ Logout con invalidación de tokens
- ✅ Protección de rutas con JWT
- ✅ Validación de datos con class-validator
- ✅ Encriptación de contraseñas con bcrypt

## Estructura

```
src/auth/
├── controllers/
│   ├── auth.controller.ts      # Endpoints de autenticación
│   └── profile.controller.ts    # Endpoint protegido de ejemplo
├── decorators/
│   └── current-user.decorator.ts # Decorador para obtener usuario actual
├── dto/
│   ├── login-auth.dto.ts        # DTOs para login, register, refresh, logout
│   └── register-auth.dto.ts     # DTO para registro
├── entities/
│   └── user.entity.ts          # Entidad User y interfaces
├── guards/
│   └── jwt-auth.guard.ts       # Guard JWT para proteger rutas
├── strategies/
│   └── jwt.strategy.ts         # Estrategia JWT para Passport
├── auth.module.ts              # Módulo principal
└── auth.service.ts             # Lógica de negocio
```

## Endpoints Disponibles

### Microservicio (MessagePattern)
- `auth.register` - Registro de usuario
- `auth.login` - Login de usuario
- `auth.refresh-token` - Renovar access token
- `auth.logout` - Logout de usuario

### HTTP (si se configura)
- `GET /profile` - Obtener perfil del usuario (protegido)

## Variables de Entorno

```env
JWT_SECRET=tu_jwt_secret_muy_seguro_de_al_menos_32_caracteres_aqui
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=tu_refresh_token_secret_muy_seguro_de_al_menos_32_caracteres_aqui
REFRESH_TOKEN_EXPIRES_IN=7d
```

## Uso

1. Configura las variables de entorno
2. El módulo está listo para usar con microservicios
3. Para usar con HTTP, configura el transporte apropiado en main.ts

## Próximos Pasos

- [ ] Integrar con base de datos real (PostgreSQL/MongoDB)
- [ ] Agregar validación de email
- [ ] Implementar recuperación de contraseña
- [ ] Agregar roles y permisos
- [ ] Configurar rate limiting
