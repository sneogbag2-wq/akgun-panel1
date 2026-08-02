---
globs: ["panel/src/**/*.jsx", "panel/src/**/*.css"]
---

# React & CSS Standards

## JSX Rules
- Import React hooks explicitly: `import { useState, useEffect, useMemo } from 'react'`
- Use `useState(() => getSomethingSync())` lazy initialisers — never `useState(0)` for data
- Always add `isMounted` guard in async `useEffect`
- Use `subscribeDataChange` for auto-refresh, return cleanup in `useEffect`
- Wrap conditional text nodes in `<span key="...">` for DOM reconciliation
- Never wrap pages in `<ErrorBoundary>` — it already wraps `App.jsx`

## CSS Rules
- Use CSS variables from `index.css` (e.g., `var(--bg-card)`)
- Exception: Recharts props need literal hex colours (`#3C7A56`), not CSS vars
- Use `var(--transition)` for animations
- Follow BEM-like naming for component classes
