# News Scraper

This project scrapes Indian Express news, summarizes new articles with Ollama, classifies today's important stories, and sends them to a WhatsApp group.

## Requirements

- Node.js 22.6 or newer
- MongoDB
- Ollama running with the configured model available
- WhatsApp linked-device access for the first message

Create a `.env` file in the project directory:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/news-scraper
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=your-model-name
HEADLESS=true
```

Install dependencies and run the complete pipeline:

```sh
npm install
npm start
```

The pipeline runs each stage in order: Indian Express latest, Lucknow, World, and Legal scrapers; AI summaries; today's importance classification; then the WhatsApp message. The Hindu scraper stays disabled.

The WhatsApp group is named **Daily Important News**. The linked WhatsApp account creates the group if needed, adds the existing configured phone number, and promotes that participant to admin. On first use, scan the QR code shown in the terminal. The linked-device credentials are saved in `.whatsapp-auth`.

Run the TypeScript checker with:

```sh
npm run typecheck
```
