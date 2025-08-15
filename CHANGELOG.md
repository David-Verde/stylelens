# StyleLens Changelog

## [1.0.0] - 2023-08-15

### ✨ Added (Nuevas Funcionalidades)

-   **Complete Workspace Analysis:** StyleLens now analyzes the entire project and finds duplicates across all supported files (React, Vue, etc.).
-   **Inline Style Detection:** Now detects and helps refactor duplicated inline `style` attributes.
-   **Dead Class Detection:** A new panel section that shows custom CSS classes used in your components but not defined in any stylesheet.
-   **Smart Style Creation:**
    -   New "Create Styles" button for undefined classes.
    -   Option to create an empty CSS rule manually.
    -   Option to use pre-built templates for common UI patterns like Cards, Buttons, and Inputs.
-   **Framework-Agnostic Templates:** Templates are now available in both **Tailwind CSS (`@apply`)** and **Pure CSS** formats.

### 🚀 Changed 

-   The analysis engine is now significantly more robust and accurate.
-   Improved filtering of Tailwind CSS utility classes to dramatically reduce noise in the "Undefined Classes" panel.
-   The UI now supports multiple sections for different types of style issues.

### 🐞 Fixed 

-   Resolved various issues related to data transfer between the extension and the webview panel.