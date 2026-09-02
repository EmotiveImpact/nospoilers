import type { Store } from "./store.ts";
import { DEFAULT_PROSPECT_QUERY } from "./prospects.ts";

export const MAX_DISCOVERY_CAMPAIGNS = 8;
export const MAX_CAMPAIGN_NAME = 80;
export const MAX_CAMPAIGN_QUERY = 200;
export const MIN_CAMPAIGN_QUERY = 3;

export const CAMPAIGN_INVALID_ERROR = "Give a GitHub repository search query.";
export const CAMPAIGN_NAME_ERROR = "Give a short name for this discovery campaign.";
export const CAMPAIGN_CAP_ERROR = "Artifact Leads already has 8 discovery campaigns.";
export const CAMPAIGN_EXISTS_ERROR = "That GitHub search query is already a campaign.";
export const CAMPAIGN_UNKNOWN_ERROR = "Unknown discovery campaign.";

export type PublicDiscoveryCampaign = {
  id: number;
  name: string;
  query: string;
  enabled: boolean;
  createdBy: string;
  lastRanAt: string | null;
  lastRepositories: number | null;
  lastQueued: number | null;
  createdAt: string;
  updatedAt: string;
};

export function parseCampaignName(raw: unknown): string {
  if (typeof raw !== "string") throw Object.assign(new Error(CAMPAIGN_NAME_ERROR), { status: 400 });
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name || name.length > MAX_CAMPAIGN_NAME) {
    throw Object.assign(new Error(CAMPAIGN_NAME_ERROR), { status: 400 });
  }
  return name;
}

export function parseCampaignQuery(raw: unknown): string {
  if (typeof raw !== "string") {
    throw Object.assign(new Error(CAMPAIGN_INVALID_ERROR), { status: 400 });
  }
  const query = raw.trim().replace(/\s+/g, " ");
  if (
    query.length < MIN_CAMPAIGN_QUERY ||
    query.length > MAX_CAMPAIGN_QUERY ||
    !/[A-Za-z]/.test(query)
  ) {
    throw Object.assign(new Error(CAMPAIGN_INVALID_ERROR), { status: 400 });
  }
  return query;
}

export function publicDiscoveryCampaign(row: {
  id: number;
  name: string;
  query: string;
  enabled: boolean;
  created_by: string;
  last_ran_at: string | null;
  last_repositories: number | null;
  last_queued: number | null;
  created_at: string;
  updated_at: string;
}): PublicDiscoveryCampaign {
  return {
    id: row.id,
    name: row.name,
    query: row.query,
    enabled: row.enabled,
    createdBy: row.created_by,
    lastRanAt: row.last_ran_at,
    lastRepositories: row.last_repositories,
    lastQueued: row.last_queued,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function scheduledDiscoveryQuery(
  store: Store,
): Promise<{ query: string; campaignId: number | null }> {
  const campaign = await store.nextEnabledDiscoveryCampaign();
  if (!campaign) return { query: DEFAULT_PROSPECT_QUERY, campaignId: null };
  return { query: campaign.query, campaignId: campaign.id };
}
