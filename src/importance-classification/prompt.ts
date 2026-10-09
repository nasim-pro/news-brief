function buildPrompt(articles: any[]): string {
  const news = articles.map(article => ({
    id: article._id.toString(),
    title: article.title,
    summary: article.aiSummary
  }));

  return `
Select the most important news from today's articles.

Keep an article only if it is genuinely important for current affairs or something a busy person should know.

Prioritize:
- Major national or international events
- Major government or political developments
- Important court judgments or legal developments
- Major economic or financial developments
- Major diplomatic, security or geopolitical events
- Major science, technology, health or environmental developments
- Major disasters, conflicts or events affecting many people
- Important decisions, policies, appointments or announcements
- Significant public-interest developments

Be SELECTIVE. 

Do NOT select:
- Routine news
- Minor local events
- Celebrity or entertainment news
- Ordinary crime reports
- Routine political statements
- Minor administrative activities
- Routine sports news
- Repetitive coverage of the same event
- Stories that are merely interesting but not important

If multiple articles cover the same important event, select only the best/most informative one.

Judge all articles relative to each other and return only the important stories.

Return ONLY JSON:

{
  "importantIds": ["id1", "id2"]
}

Only use IDs provided in the input.

TODAY'S NEWS:
${JSON.stringify(news)}
`;
}

export {
  buildPrompt
};