# 📋 Reglas y Configuración - ESLint, Prettier y Husky

## 🚀 Instalación (OBLIGATORIO)

En cada microservicio ejecuta:

```bash
pnpm install
pnpm run prepare
```

---

## 📝 Formato de Commits

### Formato requerido:
```
<tipo>: <descripción>
```

### Tipos permitidos:
- `feat` - Nueva funcionalidad
- `fix` - Corrección de bug
- `docs` - Documentación
- `refactor` - Refactorización
- `test` - Tests
- `chore` - Mantenimiento
- `perf` - Performance
- `style` - Formato de código
- `build` - Build/dependencias
- `ci` - CI/CD

### Ejemplos válidos ✅:
```bash
git commit -m "feat: add login endpoint"
git commit -m "fix: resolve token expiration"
git commit -m "docs: update readme"
git commit -m "refactor: simplify validation"
git commit -m "chore: update dependencies"
```

### Ejemplos inválidos ❌:
```bash
git commit -m "Added feature"         # No tiene tipo
git commit -m "FEAT: new feature"     # Tipo en mayúscula
git commit -m "feat: New Feature."    # Mayúscula y punto final
```

---

## 🎨 Reglas de ESLint

### Naming Conventions (automático):
```typescript
// Clases: PascalCase
class UserService {}

// Variables: camelCase
const userName = 'John';

// Constantes: UPPER_CASE
const MAX_RETRIES = 3;

// Interfaces: PascalCase
interface CreateUserDto {}
```

### Import Order (se ordena automáticamente):
```typescript
// 1. Built-in de Node
import * as fs from 'fs';

// 2. Externos (@nestjs, rxjs, etc)
import { Controller } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// 3. Internos (tu código)
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
```

### Code Quality:
- ⚠️ Advertencia si usas `any`
- ❌ Error si no usas `const`
- ❌ Error en código duplicado
- ❌ Error en complejidad alta (code smells)

---

## 🔄 Git Hooks (Automáticos)

### Pre-commit:
- ✅ Ejecuta ESLint y corrige errores
- ✅ Ejecuta Prettier y formatea código
- Solo en archivos que modificaste (rápido)

### Commit-msg:
- ✅ Valida que el mensaje siga el formato

### Pre-push:
- ✅ Ejecuta tests
- ✅ Ejecuta build

---

## 🛠️ Scripts Nuevos

En cada microservicio:

```bash
# Lint
pnpm run lint          # Ver errores
pnpm run lint:fix      # Corregir automáticamente

# Format
pnpm run format        # Formatear todo
pnpm run format:check  # Solo verificar

# Validación
pnpm run type-check    # Verificar tipos TypeScript

# Tests
pnpm run test          # Ejecutar tests

# Build
pnpm run build         # Compilar
```

---

## ⚡ Flujo de Trabajo

```bash
# 1. Crear rama
git checkout -b feat/nueva-funcionalidad

# 2. Desarrollar
# ... escribe código ...

# 3. Commit (automático: lint + format + validación)
git add .
git commit -m "feat: add new feature"

# 4. Push (automático: tests + build)
git push origin feat/nueva-funcionalidad
```

---

## 🐛 Solución de Problemas

### Hooks no funcionan:
```bash
pnpm run prepare
```

### Error de lint:
```bash
pnpm run lint:fix
```

### Tests fallan:
```bash
pnpm run test
# Corregir y reintentar
```

### Commit rechazado:
```bash
# Verifica el formato:
git commit -m "feat: description in lowercase"
# NO: "Feat:", "FEAT:", "feat: Description.", "feat: description."
```

---

## 📦 Dependencias Agregadas

En cada microservicio se agregaron:
- `husky` - Git hooks
- `lint-staged` - Lint en archivos modificados
- `@commitlint/cli` - Validación de commits
- `@commitlint/config-conventional` - Conventional Commits
- `eslint-plugin-import` - Ordenar imports
- `eslint-plugin-sonarjs` - Detectar code smells
- `eslint-import-resolver-typescript` - Resolver imports TypeScript

---

**¡Listo! Ejecuta `pnpm install && pnpm run prepare` en cada microservicio y empieza a desarrollar. 🚀**

