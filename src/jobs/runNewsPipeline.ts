import { createAiNewsAnalyzer } from "../ai/createAiNewsAnalyzer.js";
import { connectDatabase, disconnectDatabase } from "../db/connect.js";
import { NewsPipeline } from "../services/NewsPipeline.js";
async function main() {
  console.log("News pipeline started"); await connectDatabase();
  try {
    const report = await new NewsPipeline(createAiNewsAnalyzer()).run();
    console.log("Sources:"); report.sources.forEach((source) => console.log(`- ${source.name}: ${source.count} articles`));
    console.log(`Total fetched: ${report.fetched}\nNew articles: ${report.inserted}\nDuplicates skipped: ${report.duplicates}\nAI selection: ${report.candidates} candidates, ${report.selected} important stories\nSelection batches failed: ${report.failedSelectionBatches}\nStories saved: ${report.saved}\nSummaries failed: ${report.failedSummaries}`);
    if (report.aiProcessingFailed) { console.error("News pipeline completed collection, but AI processing failed."); process.exitCode = 1; }
    else console.log("Pipeline completed successfully");
  }
  finally { await disconnectDatabase(); }
}
main().catch((error) => { console.error("News pipeline failed:", error); process.exitCode = 1; });
