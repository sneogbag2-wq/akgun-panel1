---
globs: ["panel/src/services/ai*.js", "panel/src/hooks/useAiChat.js", "panel/src/components/ai/**", "panel/src/pages/AiChatPage.*"]
---

# AI Assistant Development Rules

## Architecture
- AI service layer: `aiService.js` → `aiTools.js` → `customerService.js`
- System prompt in `aiContext.js` — always Turkish, includes live data summary
- Tool declarations follow Gemini `functionDeclarations` format
- Maximum 5 tool-call iterations per user message

## Adding a New AI Tool
1. Add declaration to `aiToolDeclarations` array in `aiTools.js`
2. Add execution case to `executeAiTool()` switch statement
3. Add offline fallback handling in `handleOfflineFallback()` in `aiService.js`
4. System prompt auto-updates via `buildSystemPrompt()` — no manual changes needed
5. Add a test case in `aiTools.test.js`

## Data Access
- Use `*Sync()` getters from `customerService.js` in tool executors (they run in the same context)
- Format output currencies with `formatCurrency()`, dates with `formatDate()`
- Always include both formatted strings and raw numbers in tool results
- Never fabricate data — return `{ error: '...' }` if not found

## UI
- AI responses are rendered via `react-markdown` + `remark-gfm`
- Table content must use standard markdown table syntax
- Tool calls are shown as badges below the message
- Floating panel (`AiChatPanel`) shares `useAiChat` hook with full page
