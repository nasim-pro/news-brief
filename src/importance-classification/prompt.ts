export function buildPrompt(articles: any[]): string {
  const news = articles.map(article => ({
    id: article._id.toString(),
    title: article.title,
    summary: article.aiSummary
  }));

  return `
You are an expert news editor preparing a daily briefing. Review the following news articles and select the top 10 most noteworthy stories that a well-informed person should know today.

Prioritize a diverse mix of categories:
- Major national or international political, policy, and legal developments
- Major economic, market, or financial news
- Prominent obituaries, deaths of famous personalities, or major cultural figures
- Major accidents, disasters, or critical public safety events
- Significant scientific, technological, or environmental breakthroughs
- Major national or international sports achievements or events
- High-impact public interest stories that people are talking about

STRICT RULES:
- Select a MAXIMUM of 15 stories total and a few stories minimum. Choose the 10 most significant and interesting items from the list.
- Do NOT restrict selections only to policy or government news. Cultural shifts, major tragedies.
- Return ONLY valid JSON matching the exact format below, with no extra text or markdown formatting.

{
  "importantIds": ["id1", "id2", "id3"]
}

Only use IDs provided in the input.

TODAY'S NEWS:
${JSON.stringify(news)}
`;
}