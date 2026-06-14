import { GraphQLClient } from 'graphql-request';

export const INTUITION_GRAPHQL_URL = 'https://mainnet.intuition.sh/v1/graphql';

export const graphqlClient = new GraphQLClient(INTUITION_GRAPHQL_URL);
