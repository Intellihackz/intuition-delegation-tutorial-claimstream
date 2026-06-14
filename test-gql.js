const query = `
  query GetClaims {
    triples(
      limit: 1
      order_by: { created_at: desc }
    ) {
      term_id
      predicate_term {
        atom {
          label
        }
      }
      term {
        vaults {
          curve_id
          total_shares
          position_count
        }
      }
      counter_term {
        vaults {
          curve_id
          total_shares
          position_count
        }
      }
    }
  }
`;

fetch('https://mainnet.intuition.sh/v1/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query })
}).then(r => r.json()).then(j => console.log(JSON.stringify(j, null, 2))).catch(console.error);
