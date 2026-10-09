function buildPrompt(article: any): string {
  const trimmedArticle = article.content.length > 3000 ? article.content.slice(0, 3000) : article.content;

  return `
Summarize this article in about 100 words.
Keep all important facts, including 
-people, 
-organizations, 
-decisions, 
-dates, 
-numbers, 
-laws, 
-judgments, 
-policies, 
-causes and outcomes.

Remove repetition and minor details. Do not add facts.

TITLE:
${article.title}

CONTENT:
${trimmedArticle}

Return only:
{"summary":"..."}
`;
}

export { buildPrompt };