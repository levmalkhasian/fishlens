# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start dev server (Turbopack) on localhost:3000
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run lint` — run ESLint (flat config, `eslint.config.mjs`)

No test framework is configured yet.

## Architecture

Next.js App Router project (no `src/` directory). All routing lives under `app/`.

### API Routes (all under `app/api/`)

- `parse/` — POST: accepts `{ repoUrl }`, returns repo metadata, file tree, call graph, raw source files
- `explain/` — POST: accepts `{ repoUrl, filePath, experienceLevel }`, streams Gemini explanation for a single file
- `summary/` — POST: accepts `{ repoUrl, experienceLevel }`, streams Gemini repo summary
- `issues/` — GET: `?repoUrl=...&experienceLevel=...`, returns GitHub issues with AI explanations and difficulty classification
- `health/` — GET: returns `{ status, timestamp }`

All explain/summary/parse routes share `lib/analyze.ts` → `getAnalysis()` which caches parsed results in-memory. They do NOT call each other over HTTP.

### Key Libraries (all under `lib/`)

- `github.ts` — `parseGitHubUrl(url)` and `fetchRepoData(owner, repo)` using Octokit. Fetches repo metadata, recursive file tree, and raw content of up to 50 .ts/.tsx/.js/.jsx files (skips node_modules, .next, dist, build, coverage). Octokit auth is conditional — only passed when `GITHUB_TOKEN` is truthy and not a placeholder.
- `parser.ts` — `parseCodebase(rawFiles)` using web-tree-sitter. Extracts imports, exports, and function-level call graph from each file via AST traversal.
- `cache.ts` — `getCache(key)` / `setCache(key, value)`. In-memory, 10 entries max, 15-minute TTL, evicts oldest on overflow.
- `analyze.ts` — `getAnalysis(repoUrl)` — shared entry point that calls github → parser → cache. Used by parse, explain, and summary routes.
- `gemini.ts` — `generateExplanation(prompt)` and `generateExplanationStream(prompt)`. Uses Gemini 2.5 Flash. Has `friendlyError()` for rate limit / auth issues.
- `prompts.ts` — `buildFileExplanationPrompt()`, `buildRepoSummaryPrompt()`, `buildIssueExplanationPrompt()`. Experience-level-aware (junior/mid/senior). Word limits: 200 (summary), 250 (file), 100 (issue). Output format is markdown.

### Components

- `FileExplorer.tsx` — tree view of repo files, highlights selected file
- `ExplanationPanel.tsx` — renders AI file explanation as markdown (`react-markdown` + `remark-gfm`), experience-level badge, skeleton loading state
- `CallGraph.tsx` — Mermaid diagram with zoom/pan (useZoomPan hook), fullscreen overlay, clickable nodes with tooltips. Uses `sanitizeLabel()` and `sanitizeId()` to escape special chars for Mermaid syntax.
- `IssuesPanel.tsx` — GitHub issues list with difficulty badges and AI explanations

### Markdown Rendering

Uses `react-markdown` + `remark-gfm`. Styled via `.prose-glitch` CSS class in `app/globals.css`. Applied in both `ExplanationPanel` and the summary section of `app/page.tsx`. The summary panel is collapsible.

### POST /api/parse Response Shape

```
{
  cache: "hit" | "miss",
  repoMeta: { name, description, language, stars },
  fileTree: [{ path, type: "file"|"dir", language }],
  callGraph: { [filePath]: { imports: string[], exports: string[], functions: { [name]: { calls: string[] } } } },
  rawFiles: { [filePath]: rawSourceString }
}
```

Error codes: 400 (bad URL), 404 (repo not found), 429 (rate limit), 500 (other).

### External Services

- **GitHub API** — via `@octokit/rest`, authenticated with `GITHUB_TOKEN` (conditional — skipped when missing/placeholder)
- **Google Gemini** — via `@google/generative-ai`, model `gemini-2.5-flash`, authenticated with `GEMINI_API_KEY`
- **Mermaid** — client-side diagram rendering with `securityLevel: "loose"` for click callbacks

### Tree-sitter Setup (IMPORTANT)

Uses `web-tree-sitter` (WASM) instead of native `tree-sitter` (won't compile on Node 25). Key config:
- `next.config.ts` must have `serverExternalPackages: ["web-tree-sitter", "tree-sitter-typescript", "tree-sitter-javascript"]`
- `tree-sitter-javascript` and `tree-sitter-typescript` installed with `--ignore-scripts` (only .wasm files are used)
- Import as named exports: `import { Parser, Language } from "web-tree-sitter"` (NOT default)

### Environment

Copy `.env.local.example` to `.env.local` and fill in real values. Required vars: `GITHUB_TOKEN`, `GEMINI_API_KEY`, `NEXT_PUBLIC_API_URL`.

### Path Aliases

`@/*` maps to the project root (configured in `tsconfig.json`).

### Deployment

Railway via Nixpacks (`railway.json`). Healthcheck at `/api/health`.

### Important: Next.js Version

This uses a recent Next.js with potential breaking changes from older versions. Consult `node_modules/next/dist/docs/` before using APIs that may have changed.

### Known Patterns & Gotchas

- Mermaid labels must be sanitized — chars like `[ ] " ( ) { } < > #` break diagram syntax. Use `sanitizeLabel()` in CallGraph.tsx.
- Fullscreen overlays need `e.stopPropagation()` on interactive children to prevent backdrop clicks from closing the modal.
- The explain route only works for files present in `callGraph` (i.e., .ts/.tsx/.js/.jsx). Non-code files get a static message.
- Gemini streaming uses `generateContentStream` — chunks are yielded as `TextEncoder` encoded bytes in API routes.
- `handleFileSelect` in page.tsx guards against fetching explanations for non-parsed files.
