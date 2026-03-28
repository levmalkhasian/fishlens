import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import { parseGitHubUrl } from "@/lib/github";
import { generateExplanation } from "@/lib/gemini";
import { getAICache, setAICache, aiCacheKey } from "@/lib/ai-cache";
import { getAnalysis } from "@/lib/analyze";

type Difficulty = "easy" | "medium" | "hard";
const DIFFICULTY_ORDER: Record<Difficulty, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
};
const MAX_GEMINI_CALLS = 10;

function classifyDifficulty(
  labels: Array<{ name?: string }>
): Difficulty {
  for (const label of labels) {
    if (label.name === "good first issue") return "easy";
  }
  for (const label of labels) {
    if (label.name === "help wanted") return "medium";
  }
  return "hard";
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const repoUrl = searchParams.get("repoUrl");
  const experienceLevel = searchParams.get("experienceLevel");

  if (
    !repoUrl ||
    !experienceLevel ||
    !["junior", "mid", "senior"].includes(experienceLevel)
  ) {
    return NextResponse.json(
      {
        error:
          "Missing or invalid repoUrl or experienceLevel query param (junior | mid | senior)",
      },
      { status: 400 }
    );
  }

  let owner: string;
  let repo: string;
  try {
    ({ owner, repo } = parseGitHubUrl(repoUrl));
  } catch {
    return NextResponse.json(
      { error: "Invalid GitHub repository URL" },
      { status: 400 }
    );
  }

  const token = process.env.GITHUB_TOKEN;
  const hasRealToken = token && !token.startsWith("your_");
  const octokit = new Octokit(hasRealToken ? { auth: token } : {});

  let rawIssues;
  try {
    const res = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: "open",
      per_page: 20,
    });
    rawIssues = res.data;
  } catch (err) {
    console.error("[issues] Failed to fetch issues:", err);
    return NextResponse.json(
      { error: "Failed to fetch issues from GitHub" },
      { status: 500 }
    );
  }

  // Filter out pull requests (GitHub API returns PRs as issues)
  const issuesOnly = rawIssues.filter((i) => !i.pull_request);

  const mapped = issuesOnly.map((issue) => {
    const labels = issue.labels.map((l) =>
      typeof l === "string" ? { name: l } : l
    );
    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
      difficulty: classifyDifficulty(labels),
      labels: labels.map((l) => l.name ?? "").filter(Boolean),
      body: issue.body ?? "",
    };
  });

  // Sort: easy → medium → hard
  mapped.sort(
    (a, b) => DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty]
  );

  // Fetch analysis context for better 'where to start' advice (likely hits cache)
  let analysisContext: {
    fileTree: Array<{ path: string }>;
    repoMeta: { name: string; description: string };
  } | null = null;
  try {
    analysisContext = await getAnalysis(repoUrl);
  } catch (err) {
    console.warn("[issues] Could not fetch analysis context for issues:", err);
  }

  // Generate AI explanations — batch all uncached issues into one Gemini call
  const level = experienceLevel as "junior" | "mid" | "senior";
  const toExplain = mapped.slice(0, MAX_GEMINI_CALLS);

  // Check cache for each issue
  const explanationMap = new Map<number, string>();
  const uncached: typeof toExplain = [];
  for (const issue of toExplain) {
    const cacheKey = aiCacheKey("issue", String(issue.id), experienceLevel);
    const cached = getAICache(cacheKey);
    if (cached) {
      explanationMap.set(issue.id, cached);
    } else {
      uncached.push(issue);
    }
  }

  // Batch uncached issues into a single Gemini call
  if (uncached.length > 0) {
    const treeSection = analysisContext?.fileTree
      ? `\nRelevant files:\n${analysisContext.fileTree.map((f) => f.path).slice(0, 50).join("\n")}`
      : "";
    const repoSection = analysisContext?.repoMeta
      ? `\nRepo: ${analysisContext.repoMeta.name} — ${analysisContext.repoMeta.description || "No description."}`
      : "";

    const batchPrompt = `You are explaining GitHub issues to a ${level}-level developer.
Keep each explanation under 100 words. For each issue, cover:
1. **Summary** — what the issue is about (1 sentence)
2. **Where to start** — suggest specific files or directories
3. **Potential approach** — a brief technical hint
${repoSection}${treeSection}

Return a JSON array where each element has "id" (number) and "explanation" (string).
Issues:
${uncached.map((i) => `- ID: ${i.id} | #${i.number} "${i.title}" [${i.labels.join(", ") || "no labels"}] — ${(i.body || "No description.").slice(0, 300)}`).join("\n")}

Respond ONLY with the JSON array, no markdown fences.`;

    try {
      const raw = await generateExplanation(batchPrompt, { lite: true });
      const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const parsed: Array<{ id: number; explanation: string }> = JSON.parse(cleaned);
      for (const entry of parsed) {
        explanationMap.set(entry.id, entry.explanation);
        setAICache(aiCacheKey("issue", String(entry.id), experienceLevel), entry.explanation);
      }
    } catch (err) {
      console.error("[issues] Batch explanation failed, falling back:", err);
    }
  }

  const issues = mapped.map((issue) => ({
    id: issue.id,
    number: issue.number,
    title: issue.title,
    url: issue.url,
    difficulty: issue.difficulty,
    labels: issue.labels,
    explanation: explanationMap.get(issue.id) ?? "",
  }));

  return NextResponse.json({ issues });
}
