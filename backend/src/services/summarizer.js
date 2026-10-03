import { config } from '../config.js';
import OpenAI from 'openai';


let client = null;
let clientBuilt = false;
const getClient = () => {
  if (!clientBuilt) {
    clientBuilt = true;
    client = config.openaiApiKey ? new OpenAI({ apiKey: config.openaiApiKey, timeout: 20000 }) : null;
    if (!client) {
      console.warn('[summarizer] OPENAI_API_KEY not set — using keyword extraction.');
    }
  }
  return client;
};

const SYSTEM_PROMPT = `You summarize meeting transcripts for a productivity app.
Respond with ONLY a JSON object, no markdown, matching exactly:
{
  "title": string,                              // <=120 chars
  "summary": string,                            // <=150 words, neutral tone
  "keyPoints": string[],                        // 3-6 items, each <=200 chars
  "actionItems": [ { "task": string, "assignedTo": string | null } ],
  "decisions": string[]
}
Rules: base everything strictly on the transcript. If a person's name appears
next to a commitment, set assignedTo to that name; otherwise null. Never invent
action items or decisions that were not discussed.`;

// Coerce ANYTHING the model (or a future prompt tweak) returns into the
// uniform shape. This is the boundary where LLM output becomes data.
const sanitize = (s) => ({
  source: s.source,
  title: String(s.title || 'Meeting summary').slice(0, 120),
  summary: String(s.summary || '').slice(0, 2000),
  keyPoints: (Array.isArray(s.keyPoints) ? s.keyPoints : [])
    .slice(0, 8).map((k) => String(k).slice(0, 200)),
  actionItems: (Array.isArray(s.actionItems) ? s.actionItems : [])
    .slice(0, 15)
    .map((a) => ({
      task: String(a?.task || '').slice(0, 300),
      assignedTo: a?.assignedTo ? String(a.assignedTo).slice(0, 60) : null,
    }))
    .filter((a) => a.task),
  decisions: (Array.isArray(s.decisions) ? s.decisions : [])
    .slice(0, 10).map((d) => String(d).slice(0, 200)),
});

const gptSummarize = async (rawText, activeClient) => {
  const response = await activeClient.chat.completions.create({
    model: 'gpt-3.5-turbo',
    temperature: 0.2,                       // summaries want determinism, not creativity
    response_format: { type: 'json_object' }, // hard JSON mode — half the parsing bugs gone
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: rawText.slice(0, 12000) }, // token-budget guard
    ],
  });
  const content = response.choices?.[0]?.message?.content || '{}';
  return sanitize({ source: 'gpt', ...JSON.parse(content) }); // JSON.parse may throw → caught by caller
};

const STOPWORDS = new Set(
  'the a an and or but if then so of to in on at for with is are was were be been i you he she it we they this that these those as by from not no yes do does did have has had will would can could should about into over after before meeting yeah okay okay just really know like think going want'.split(' ')
);

// Zero-config fallback: top terms + sentences containing them. Honest about
// what it is — 'keyword' source is displayed in the UI so reports never
// pretend an AI wrote them.
const keywordSummarize = (rawText) => {
  const words = rawText.toLowerCase().match(/[a-z']{3,}/g) || [];
  const freq = {};
  words.forEach((w) => { if (!STOPWORDS.has(w)) freq[w] = (freq[w] || 0) + 1; });
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);

  const sentences = rawText
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
  const keyPoints = sentences
    .map((s) => ({ s, score: top.reduce((n, t) => n + (s.toLowerCase().includes(t) ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x) => x.s.slice(0, 140));

  return sanitize({
    source: 'keyword',
    title: 'Meeting summary (keyword extraction)',
    summary: top.length
      ? `Automatically extracted main topics: ${top.join(', ')}.`
      : 'Not enough transcript content to summarize.',
    keyPoints,
    actionItems: [],   // honest: keyword matching cannot reliably extract tasks
    decisions: [],
  });
};

// THE entry point — uniform shape regardless of engine:
export const summarizeTranscript = async (rawText) => {
  
  const activeClient = getClient();
  if (activeClient && rawText && rawText.trim().length > 40) {
    try {
      return await gptSummarize(rawText, activeClient);
    } catch (err) {
      console.warn('GPT summary failed — using keyword fallback:', err.message);
      // falls through to keyword path: timeout, bad key, quota, malformed JSON…
    }
  }
  return keywordSummarize(rawText);
};