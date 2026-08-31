const fs = require('fs');
const path = require('path');

const KNOWLEDGE_DIR = path.join(__dirname, 'knowledge');
const VECTOR_STORE_PATH = path.join(KNOWLEDGE_DIR, 'vector_store.json');

// Load environment variables from .env if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim();
            if (key && val) {
                process.env[key] = val;
            }
        }
    });
}

const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY; 

async function getEmbedding(text) {
    if (!GEMINI_KEY) {
        throw new Error("GEMINI_API_KEY is not configured.");
    }
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_KEY}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            content: {
                parts: [{
                    text: text
                }]
            }
        })
    });
    
    if (!response.ok) {
        throw new Error(`Failed to fetch embedding: ${await response.text()}`);
    }
    
    const data = await response.json();
    if (!data.embedding || !data.embedding.values) {
        throw new Error("Invalid response format from embeddings API.");
    }
    return data.embedding.values;
}

async function buildVectorStore() {
    console.log("Starting RAG Vector Store build...");
    const files = fs.readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.md'));
    const store = [];
    
    for (const file of files) {
        console.log(`Processing ${file}...`);
        const filePath = path.join(KNOWLEDGE_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Simple chunking by headers or double newlines
        const chunks = content.split(/\n\n(?=##? )|\n\n/).map(c => c.trim()).filter(c => c.length > 20);
        
        for (let i = 0; i < chunks.length; i++) {
            const text = chunks[i];
            console.log(`  - Embedding chunk ${i+1}/${chunks.length} (${text.substring(0, 30)}...)`);
            
            try {
                const embedding = await getEmbedding(text);
                store.push({
                    id: `${file.replace('.md', '')}-chunk-${i}`,
                    source: file,
                    text: text,
                    embedding: embedding
                });
                // Small delay to prevent rate limits
                await new Promise(r => setTimeout(r, 500));
            } catch (err) {
                console.error(`Error embedding chunk from ${file}:`, err);
            }
        }
    }
    
    fs.writeFileSync(VECTOR_STORE_PATH, JSON.stringify(store, null, 2));
    console.log(`Successfully built vector store with ${store.length} chunks at ${VECTOR_STORE_PATH}`);
}

buildVectorStore();
