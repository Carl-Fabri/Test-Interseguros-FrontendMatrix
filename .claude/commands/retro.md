---
description: Cierra la sesión verificando la definición de terminado y consolidando lo aprendido
---

## 1. Verificar la definición de terminado
Revisa los cambios de esta sesión y confirma cada punto (✅ o "no aplica: <motivo>"):
- **Pruebas**: ¿la lógica nueva o modificada tiene specs? Ejecuta `npm run test:ci`.
- **Documentación**: ¿están al día `.claude/CLAUDE.md`, `README.md` y los DTOs de `core/api/api.models.ts`?
- **Docker**: ¿`Dockerfile`, `docker/`, `.env.example` y `public/config.example.json` reflejan la configuración actual?
Si falta algo, dilo y propón cómo completarlo.

## 2. Consolidar lo aprendido
1. **Regla o convención permanente** → propón el cambio a `.claude/CLAUDE.md` o `.claude/rules/` (muestra el diff antes).
2. **Decisión de arquitectura** → propón un ADR en `docs/architecture/`.
3. **Contexto o preferencia que no se deduce del código** → guárdalo en la memoria.
4. **Algo que ya está en el código o en git** → no lo guardes.

Termina con el checklist del paso 1 y una lista breve de lo guardado y lo propuesto.
