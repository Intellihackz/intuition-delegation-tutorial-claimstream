'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { gql } from 'graphql-request';
import { graphqlClient } from '@/lib/graphql';

const PAGE_SIZE = 10;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// One query for everything the feed needs: the triple + its metadata (creator,
// created_at), the two vaults' totals, and — filtered to the connected wallet —
// that wallet's position in each vault. The generated `GetTriplesWithPositions`
// hook has the positions but drops `created_at`/`creator`; the generated
// `GetTriples` hook is the other way round. So we run our own.
const CLAIM_FEED_QUERY = gql`
  query ClaimFeed($limit: Int!, $offset: Int!, $address: String!) {
    triples(limit: $limit, offset: $offset, order_by: { created_at: desc }) {
      term_id
      counter_term_id
      created_at
      creator {
        id
        label
      }
      subject {
        label
      }
      predicate {
        label
      }
      object {
        label
      }
      term {
        vaults {
          total_shares
          positions(where: { account_id: { _ilike: $address } }) {
            shares
          }
        }
      }
      counter_term {
        vaults {
          total_shares
          positions(where: { account_id: { _ilike: $address } }) {
            shares
          }
        }
      }
    }
  }
`;

type FeedVault = {
  total_shares: string | null;
  positions: { shares: string | null }[];
};

export type FeedClaim = {
  term_id: `0x${string}`;
  counter_term_id: `0x${string}`;
  created_at: string;
  creator: { id: string; label: string | null } | null;
  subject: { label: string | null } | null;
  predicate: { label: string | null } | null;
  object: { label: string | null } | null;
  term: { vaults: FeedVault[] } | null;
  counter_term: { vaults: FeedVault[] } | null;
};

type FeedPage = { triples: FeedClaim[] };

export function useClaimFeed(address: string | null) {
  const addr = address ?? ZERO_ADDRESS;
  return useInfiniteQuery<FeedPage>({
    queryKey: ['claim-feed', addr],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      graphqlClient.request<FeedPage>(CLAIM_FEED_QUERY, {
        limit: PAGE_SIZE,
        offset: pageParam as number,
        address: addr,
      }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.triples.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE,
  });
}
