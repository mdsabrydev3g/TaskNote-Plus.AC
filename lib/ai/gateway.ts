import { createOpenAICompatibleProvider, localNoopProvider, type AIProvider } from './providers';

/**
 * Single funnel for every model call. No page or component talks to a provider
 * directly, which keeps routing, budgeting and auditing in one place.
 */
export type AIGateway = {
  provider: AIProvider;
  fallback: AIProvider;
  mode: 'cloud' | 'local';
  degraded: boolean;
  reason?: string;
};

export function getAIGateway(): AIGateway {
  const cloud = createOpenAICompatibleProvider({
    apiKey: process.env.AI_API_KEY,
    baseUrl: process.env.AI_BASE_URL,
    model: process.env.AI_MODEL,
  });

  if (cloud.available()) {
    return { provider: cloud, fallback: localNoopProvider, mode: 'cloud', degraded: false };
  }

  return {
    provider: localNoopProvider,
    fallback: localNoopProvider,
    mode: 'local',
    degraded: true,
    reason: 'no_api_key',
  };
}

export function tokenBudget(): number {
  const raw = Number(process.env.AI_MONTHLY_TOKEN_BUDGET ?? '0');
  return Number.isFinite(raw) && raw > 0 ? raw : 200000;
}
