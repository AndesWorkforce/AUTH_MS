# Guía de Contribución - AUTH_MS

## Tabla de Contenidos

- [Configuración del Entorno](#configuración-del-entorno)
- [Estándares de Código](#estándares-de-código)
- [Convenciones de Commits](#convenciones-de-commits)
- [Flujo de Trabajo](#flujo-de-trabajo)
- [Testing](#testing)

## Configuración del Entorno

### Prerequisitos

- Node.js 20+
- pnpm 8+
- Git

### Instalación

```bash
# Instalar dependencias
pnpm install

# Copiar variables de entorno
cp .env.example .env

# Ejecutar en modo desarrollo
pnpm run start:dev
```

## Estándares de Código

### ESLint y Prettier

El proyecto usa ESLint para linting y Prettier para formateo de código.

```bash
# Ejecutar lint
pnpm run lint

# Arreglar errores de lint automáticamente
pnpm run lint:fix

# Formatear código
pnpm run format
```

### Reglas Importantes

1. **No usar `any` explícitamente**: Preferir tipos específicos
2. **Nombres descriptivos**: Variables y funciones deben ser claras
3. **Complejidad cognitiva**: Mantener funciones con complejidad ≤ 15
4. **Variables no usadas**: Prefijar con `_` si son necesarias pero no usadas

### Estructura de Archivos

```
src/
├── auth/                    # Módulo de autenticación
│   ├── dto/                # Data Transfer Objects
│   ├── entities/           # Entidades
│   ├── guards/             # Guards de autenticación
│   ├── strategies/         # Estrategias JWT
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.module.ts
├── common/                  # Recursos compartidos
│   └── exceptions/         # Excepciones personalizadas
├── app.module.ts
└── main.ts
```

## Convenciones de Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

### Formato

```
<tipo>: <descripción corta>

[cuerpo opcional]

[footer opcional]
```

### Tipos permitidos

- `feat`: Nueva funcionalidad
- `fix`: Corrección de bug
- `docs`: Cambios en documentación
- `style`: Cambios de formato (no afectan la lógica)
- `refactor`: Refactorización de código
- `test`: Agregar o modificar tests
- `chore`: Cambios en build o herramientas

### Ejemplos

```bash
feat: add refresh token endpoint

fix: resolve token expiration issue

docs: update API documentation

refactor: simplify login validation logic
```

### Límites

- **Título**: Máximo 72 caracteres
- **Primera palabra**: Minúscula
- **Sin punto final**: En el título

## Flujo de Trabajo

### Branching

```
main/master              # Producción
  └── development        # Desarrollo
       └── feature/*     # Features
       └── fix/*         # Bug fixes
       └── SDT-*         # Tickets específicos
```

### Proceso

1. **Crear rama desde development**

```bash
git checkout development
git pull origin development
git checkout -b SDT-123-feature-name
```

2. **Hacer cambios y commits**

```bash
git add .
git commit -m "feat: add new feature"
```

3. **Ejecutar tests y lint**

```bash
pnpm run test
pnpm run lint
```

4. **Push y crear PR**

```bash
git push -u origin SDT-123-feature-name
```

5. **Code Review y Merge**

## Testing

### Ejecutar Tests

```bash
# Todos los tests
pnpm run test

# Tests en modo watch
pnpm run test:watch

# Tests con coverage
pnpm run test:cov

# Tests e2e
pnpm run test:e2e
```

### Escribir Tests

#### Unit Tests

```typescript
describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

#### Mocks

Siempre mockear dependencias externas:

```typescript
const mockJwtService = {
  sign: jest.fn(),
  verify: jest.fn(),
};

const mockUserService = {
  send: jest.fn(),
};
```

### Coverage

Mantener coverage mínimo del 80%:

- Statements: 80%
- Branches: 80%
- Functions: 80%
- Lines: 80%

## Pre-commit Hooks

El proyecto usa Husky para ejecutar automáticamente:

1. **Lint-staged**: Formatea archivos modificados
2. **Commitlint**: Valida formato de commits

No necesitas hacer nada extra, estos hooks se ejecutan automáticamente al hacer commit.

## Manejo de Excepciones

Ver [EXCEPTIONS.md](./EXCEPTIONS.md) para guía completa sobre el sistema de excepciones personalizadas.

### Regla General

```typescript
// ❌ Evitar
throw new Error('User not found');

// ✅ Usar
throw new EntityNotFoundException('User', userId);
```

## Logger

Usar el Logger de NestJS para registro:

```typescript
import { Logger } from '@nestjs/common';

export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  someMethod() {
    this.logger.log('Operation started');
    this.logger.error('Error occurred', error.stack);
    this.logger.warn('Warning message');
  }
}
```

## Preguntas Frecuentes

### ¿Cómo agrego una nueva dependencia?

```bash
pnpm add <package>        # Dependencia de producción
pnpm add -D <package>     # Dependencia de desarrollo
```

### ¿Qué hago si falla el pre-commit hook?

1. Revisa los errores mostrados
2. Ejecuta `pnpm run lint:fix`
3. Corrige errores manualmente si es necesario
4. Intenta el commit nuevamente

### ¿Cómo actualizo las dependencias?

```bash
# Ver dependencias desactualizadas
pnpm outdated

# Actualizar dependencias
pnpm update

# Actualizar a versión específica
pnpm update <package>@<version>
```

## Recursos

- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Conventional Commits](https://www.conventionalcommits.org/)
