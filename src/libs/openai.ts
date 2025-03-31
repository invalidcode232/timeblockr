import { AzureOpenAI } from 'openai/index.mjs';

const AIClient = new AzureOpenAI({
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    baseURL: process.env.AZURE_OPENAI_BASE_URL,
});

export default AIClient;
