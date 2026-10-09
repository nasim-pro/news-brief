const OLLAMA_URL = process.env.OLLAMA_URL;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL;

async function generate(prompt: string): Promise<string> {
    const response = await fetch(
        `${OLLAMA_URL}/api/generate`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt,
                stream: false,
                format: 'json',
                think: false,
                options: {
                    temperature: 0.1,
                    num_ctx: 32768
                }
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `Ollama request failed: ${response.status} ${errorText}`
        );
    }

    const data: any = await response.json();

    if (!data.response) {
        throw new Error('Ollama returned an empty response');
    }

    return data.response;
}

export {
    generate,
    OLLAMA_MODEL
};