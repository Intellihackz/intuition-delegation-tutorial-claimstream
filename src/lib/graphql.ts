export const INTUITION_GRAPHQL_URL = 'https://mainnet.intuition.sh/v1/graphql';

// A GraphQL request is just a POST with { query, variables }. No client library
// needed for the one query this app runs.
export async function gqlRequest<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(INTUITION_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (Array.isArray(json?.errors) && json.errors.length > 0) {
    throw new Error(json.errors.map((e: { message?: string }) => e.message ?? 'GraphQL error').join('; '));
  }
  if (!res.ok) throw new Error(`GraphQL request failed: ${res.status}`);
  return json.data as T;
}
