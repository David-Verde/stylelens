# StyleLens ✨ – Smart Visual Refactor

![StyleLens Icon](media/icons/stylelens.png)

**StyleLens es una extensión inteligente para VS Code diseñada para ayudarte a detectar, visualizar y refactorizar estilos CSS repetidos o mal estructurados en tus proyectos frontend modernos.**

Mantén tu base de código de estilos limpia, consistente y mantenible. ¡Di adiós al CSS duplicado y a las largas listas de clases de utilidad!

---

### ¿Por Qué StyleLens?

En proyectos grandes que usan frameworks como Tailwind CSS, es fácil terminar con la misma combinación de clases (`flex items-center justify-between...`) repetida en docenas de componentes. Esto lleva a:
-   **Inconsistencia:** Un pequeño cambio requiere editar múltiples archivos.
-   **Mantenimiento Difícil:** ¿Dónde se usa este estilo? ¿Es seguro cambiarlo?
-   **Código Inflado:** Listas de clases largas que dificultan la lectura del marcado.

StyleLens ataca este problema de frente, dándote las herramientas para refactorizar con confianza.

### 🚀 Características Principales

-   **Análisis Multi-Framework:** Detecta estilos duplicados en **React (JSX/TSX), Vue, y Svelte(pendiente por crear)**.
-   **Panel de Control Visual:** Obtén una vista global de todos los estilos repetidos en tu proyecto desde una vista dedicada en la barra lateral.
-   **Refactorización con Un Clic:**
    -   **Desde el Editor:** Sugerencias contextuales (CodeLens) aparecen directamente sobre el código repetido.
    -   **Desde el Panel:** Refactoriza grupos de estilos duplicados en todo el proyecto con un solo botón.
-   **Extracción Inteligente:** Extrae automáticamente combinaciones de clases de utilidad a una nueva clase reutilizable en tu archivo CSS global (usando `@apply` para Tailwind).
-   **Navegación Rápida:** Haz clic en los resultados del panel para saltar directamente a la línea de código problemática.

### 🎬 Demo

*(Aquí es donde pondrás tu increíble GIF mostrando la extensión en acción)*

### 🛠️ Tecnologías Soportadas

-   **Frameworks:** React, Next.js, Vue, Nuxt, Svelte(pendiente por crear), SvelteKit(pendiente por crear), Astro.
-   **Lenguajes:** HTML, JSX, TSX, Vue, Svelte(pendiente por crear).
-   **Estilos:** Clases de utilidad (Tailwind CSS, etc.), clases CSS normales.

### ⚙️ Cómo Usarlo

1.  **Abre el Panel de StyleLens:** Haz clic en el icono de StyleLens en la barra de actividades de VS Code.
2.  **Analiza tu Proyecto:** Haz clic en el botón "Analizar Workspace".
3.  **Explora los Resultados:** El panel mostrará una tabla con todos los estilos duplicados, el número de apariciones y los archivos/líneas donde se encuentran.
4.  **Refactoriza:**
    -   Haz clic en el botón "Refactorizar" en el panel para arreglar un grupo de duplicados en todo el proyecto.
    -   O trabaja directamente en el editor, donde verás sugerencias sobre el código.

### 🗺️ Roadmap Futuro (v2.0 y más allá)

StyleLens está en desarrollo activo. Algunas de las características planeadas incluyen:
-   **Detección de Similitud:** Sugerir la unificación de estilos que son *casi* idénticos (ej. `p-4` vs `p-5`).
-   **Soporte para CSS-in-JS:** Analizar patrones en `styled-components` y `Emotion`.
-   **Sugerencias de Design Tokens:** Detectar valores brutos (`margin: 16px`) y sugerir la creación de tokens de diseño (`spacing-md`).
-   **Mapa Visual (Heatmap):** Un diagrama que muestre visualmente qué componentes comparten más estilos.
-   **Configuración Avanzada:** Permitir ignorar archivos, carpetas o clases específicas.

---

Hecho con ❤️ por [Tu David Verde].

