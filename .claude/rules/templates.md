---
paths:
  - "src/**/*.html"
  - "src/**/*.component.ts"
  - "src/**/*.page.ts"
  - "src/styles.css"
---

# Plantillas y estilos
- Solo Tailwind v4 con los tokens de `@theme` y las utilidades `@utility` de `src/styles.css`. Sin CSS por componente.
- Tokens nuevos (color, fuente) se agregan en `@theme`; patrones repetidos, como `@utility` (no `@layer components`,
  porque `@apply` de clases propias solo funciona con `@utility`).
- Control flow `@if/@for/@switch` con `track`; sin `*ngIf`/`*ngFor`.
- Accesibilidad: `aria-label` en botones de solo ícono, `role="alert"` para errores, `role="status"` para avisos.
- Responsive: probar a 390 px; ocultar detalles secundarios con `hidden sm:inline` en lugar de apretarlos.
