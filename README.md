
![StyleLens Logo](https://raw.githubusercontent.com/David-Verde/stylelens/master/media/icons/stylelens.png)

👉 [Download Here](https://marketplace.visualstudio.com/items?itemName=DavidVerde.stylelens) 


**StyleLens is a powerful VS Code extension that acts as a co-pilot for your styles. It scans your entire frontend project to detect, visualize, and refactor duplicated, dead, or inline styles, helping you write cleaner, more consistent, and highly maintainable CSS.**

Whether you use **Tailwind CSS**, **pure CSS**, or **inline styles**, StyleLens streamlines your workflow and keeps your codebase pristine.

---

### 🔥 New in v1.0.0: The Complete Style Auditor

This major update transforms StyleLens into an essential tool for any modern frontend developer:

-   **Cross-File Duplicate Detection:** Finds identical style patterns (both `className` and inline `style` attributes) across your entire workspace, no matter the file or framework.
-   **Dead-Class Detection:** Scans your project for custom CSS classes used in your components (JSX, Vue, etc.) but **not defined** in any of your stylesheets. Eliminate ghost classes with confidence.
-   **Inline Style Refactoring:** A brand-new feature that detects repeated inline `style` blocks and helps you extract them into reusable CSS classes in one click.
-   **Smart Style Creation Engine:**
    -   For any "dead class," instantly generate a CSS rule.
    -   Choose between creating an empty rule (**Manual Mode**) or scaffolding it with a pre-built template (**Template Mode**).
    -   Templates are available in both **Tailwind CSS (`@apply`)** and **Pure CSS** formats, making the tool framework-agnostic.

---

### Why StyleLens?

In modern component-based projects, it's easy to fall into common traps:

-   **Inconsistency:** The same combination of Tailwind utilities (`flex items-center...`) or inline styles (`style={{ color: 'red' }}`) is repeated in dozens of places. A small design change becomes a project-wide scavenger hunt.
-   **Maintenance Nightmares:** Is this custom class `.user-avatar` still used anywhere? Is it safe to delete?
-   **Code Bloat:** Long, unreadable `className` attributes and forgotten, unused CSS rules make your markup and stylesheets difficult to navigate.

StyleLens solves these problems by providing a centralized dashboard and actionable insights, turning style maintenance from a chore into a quick, satisfying task.

### 🚀 Key Features

-   **Universal Style Analysis:** Works seamlessly with **React (JSX/TSX)** and **Vue**. (Svelte support is in development).
-   **Intelligent Dashboard:**
    -   Get a global overview of all **Duplicate `className` combinations**.
    -   See all **Duplicate Inline Styles**.
    -   Instantly spot **Undefined (Dead) Classes**.
-   **One-Click Refactoring & Creation:**
    -   **Consolidate Duplicates:** Extract repeated styles (both utility classes and inline styles) into a new, single CSS class and replace all occurrences across the project.
    -   **Generate Dead Classes:** Choose a "dead class," and let StyleLens create the CSS rule for you in your global stylesheet, either empty or pre-filled from a template.
-   **Framework-Agnostic Templates:**
    -   Scaffold common UI patterns like Cards, Buttons, and Inputs.
    -   Choose to generate them with Tailwind's `@apply` directive or with standard CSS properties.
-   **Quick Navigation:** Click any result in the panel to jump directly to the line of code in the corresponding file.

### 🎬 Demo

*(Coming soon! Replace this with an updated GIF showing the new features)*

### 🛠️ Supported Technologies


-   **Frameworks:** React, Next.js, Vue, Nuxt, Astro.
-   **Languages:** HTML, JSX, TSX, Vue.
-   **Styles:** Utility classes (Tailwind CSS, etc.), Custom CSS classes, and Inline Styles.
-   **Coming Soon:** Full Svelte support, SCSS analysis, and CSS-in-JS patterns.

## Installation
1. Open VS Code
2. Go to Extensions view (Ctrl+Shift+X)
3. Search for "StyleLens"
4. Click Install

## ⚙️ How to Use


### ⚙️ How to Use

1.  **Open the StyleLens Panel:** Click the StyleLens icon in the VS Code Activity Bar.
2.  **Analyze Your Project:** Click the "Analyze Workspace" button.
3.  **Review the Report:** The panel will display up to three tables:
    -   `Duplicate Styles (className)`
    -   `Duplicate Inline Styles (style)`
    -   `Undefined Classes`
4.  **Take Action:**
    -   Click **"Refactor"** to consolidate a group of duplicates.
    -   Click **"Create Styles"** to generate a new CSS rule for an undefined class.

### 🗺️ Future Roadmap

-   [ ] **Full Svelte & SCSS Support:** Deep analysis for Svelte components and SCSS syntax (mixins, variables).
-   [ ] **Similarity Analysis:** Suggest merging styles that are *almost* identical (e.g., `p-4` vs `p-5`).
-   [ ] **CSS-in-JS Patterns:** Analyze styles in `styled-components` and `Emotion`.
-   [ ] **Design Token Suggestions:** Detect raw CSS values (`margin: 16px`) and suggest replacing them with CSS variables (`var(--spacing-md)`).
-   [ ] **Advanced Configuration:** Allow users to ignore files, folders, or classes via a `stylelens.json` config file.

---


Made with ❤️ by 👤 **David Verde Alvarez**

- This is My **GitHub**: [![@David-Verde](https://img.shields.io/github/followers/omarramoun?label=David&style=social)](https://github.com/David-Verde)

- This is My **Twitter**: [![@Unyielding1](https://img.shields.io/twitter/follow/omarramoun?label=David16&style=social)](https://twitter.com/UnyieldingOne)

- This is My **LinkedIn**: [![David-Verde](https://img.shields.io/badge/David_Verde_Alvarez-0077B5?style=social&logo=linkedin)](https://www.linkedin.com/in/david-verde-alvarez/)

