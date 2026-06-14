async function run() {
  const query = `
    query {
      triples(limit: 1, order_by: { created_at: desc }) {
        creator {
          id
        }
      }
    }
  `;
  try {
    const res = await globalThis.fetch('https://testnet.intuition.sh/v1/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
}
run();
