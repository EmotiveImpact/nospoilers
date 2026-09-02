import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import {
  CAMPAIGN_CAP_ERROR,
  CAMPAIGN_EXISTS_ERROR,
  CAMPAIGN_INVALID_ERROR,
  MAX_DISCOVERY_CAMPAIGNS,
  parseCampaignQuery,
  scheduledDiscoveryQuery,
} from "../src/server/discovery-campaigns.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import { DEFAULT_PROSPECT_QUERY } from "../src/server/prospects.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";

const json = { "content-type": "application/json" };
const admin = { authorization: "Bearer campaign-admin", ...json };
const QUERY = "topic:electron fork:false archived:false stars:10..200";

function unusedGithub(): GithubPort {
  const unused = async (): Promise<never> => {
    throw new Error("GitHub should not be called.");
  };
  return {
    exchangeCode: unused,
    getUser: unused,
    listUserInstallations: unused,
    getInstallation: unused,
    getRepo: unused,
    listReleaseAssets: unused,
    getLatestRelease: unused,
    downloadAsset: unused,
    ...skippedGithubWrites(),
  };
}

describe("discovery campaign helpers", () => {
  it("rejects an empty or symbol-only GitHub search query", () => {
    expect(parseCampaignQuery(QUERY)).toBe(QUERY);
    expect(() => parseCampaignQuery("")).toThrow(CAMPAIGN_INVALID_ERROR);
    expect(() => parseCampaignQuery("***")).toThrow(CAMPAIGN_INVALID_ERROR);
  });
});

describe("owner discovery campaigns", () => {
  it("stores campaigns for scheduled discovery and keeps them owner-only", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "campaign-session" });
      await store.upsertUser({ id: "customer-1", login: "acme-founder" });
      const app = createApp({
        config: loadConfig({
          adminToken: "campaign-admin",
          adminGithubLogin: "EmotiveImpact",
          sessionSecret: "campaign-session",
        }),
        store,
        github: unusedGithub(),
      });
      const customer = `ns_session=${signSession("campaign-session", await store.createSession("customer-1"))}`;

      expect((await app.request("/api/internal/prospects/campaigns")).status).toBe(401);
      expect(
        (
          await app.request("/api/internal/prospects/campaigns", {
            headers: { cookie: customer },
          })
        ).status,
      ).toBe(401);

      const missing = await app.request("/api/internal/prospects/campaigns", {
        method: "POST",
        headers: admin,
        body: JSON.stringify({ name: "Electron", query: QUERY }),
      });
      expect(missing.status).toBe(400);

      const created = await app.request("/api/internal/prospects/campaigns", {
        method: "POST",
        headers: admin,
        body: JSON.stringify({ name: "Electron", query: QUERY, confirm: QUERY }),
      });
      expect(created.status).toBe(201);
      const createdBody = (await created.json()) as {
        campaign: { id: number; query: string; enabled: boolean };
      };
      expect(createdBody.campaign.query).toBe(QUERY);
      expect(createdBody.campaign.enabled).toBe(true);

      const duplicate = await app.request("/api/internal/prospects/campaigns", {
        method: "POST",
        headers: admin,
        body: JSON.stringify({ name: "Again", query: QUERY, confirm: QUERY }),
      });
      expect(duplicate.status).toBe(409);
      expect(((await duplicate.json()) as { error: string }).error).toBe(CAMPAIGN_EXISTS_ERROR);

      const fallback = await scheduledDiscoveryQuery(store);
      expect(fallback).toEqual({ query: QUERY, campaignId: createdBody.campaign.id });

      const disabled = await app.request(
        `/api/internal/prospects/campaigns/${createdBody.campaign.id}`,
        {
          method: "PATCH",
          headers: admin,
          body: JSON.stringify({ enabled: false }),
        },
      );
      expect(disabled.status).toBe(200);
      expect(await scheduledDiscoveryQuery(store)).toEqual({
        query: DEFAULT_PROSPECT_QUERY,
        campaignId: null,
      });

      await app.request(`/api/internal/prospects/campaigns/${createdBody.campaign.id}`, {
        method: "PATCH",
        headers: admin,
        body: JSON.stringify({ enabled: true }),
      });

      const listed = await app.request("/api/internal/prospects", { headers: admin });
      const listBody = (await listed.json()) as {
        campaigns: { query: string }[];
        policy: { campaignsConfigurable: boolean };
      };
      expect(listBody.policy.campaignsConfigurable).toBe(true);
      expect(listBody.campaigns.map((row) => row.query)).toEqual([QUERY]);

      const jobsBefore = await sql.query<{ n: string }>(`SELECT count(*)::text AS n FROM jobs`);
      const prospectsBefore = await sql.query<{ n: string }>(`SELECT count(*)::text AS n FROM prospects`);

      const removed = await app.request(
        `/api/internal/prospects/campaigns/${createdBody.campaign.id}`,
        {
          method: "DELETE",
          headers: admin,
          body: JSON.stringify({ confirm: QUERY }),
        },
      );
      expect(removed.status).toBe(200);
      expect(await scheduledDiscoveryQuery(store)).toEqual({
        query: DEFAULT_PROSPECT_QUERY,
        campaignId: null,
      });
      expect((await store.listDiscoveryCampaigns()).length).toBe(0);

      const jobsAfter = await sql.query<{ n: string }>(`SELECT count(*)::text AS n FROM jobs`);
      const prospectsAfter = await sql.query<{ n: string }>(`SELECT count(*)::text AS n FROM prospects`);
      expect(jobsAfter.rows[0]?.n).toBe(jobsBefore.rows[0]?.n);
      expect(prospectsAfter.rows[0]?.n).toBe(prospectsBefore.rows[0]?.n);

      for (let i = 0; i < MAX_DISCOVERY_CAMPAIGNS; i += 1) {
        const query = `topic:library${i} fork:false`;
        const response = await app.request("/api/internal/prospects/campaigns", {
          method: "POST",
          headers: admin,
          body: JSON.stringify({ name: `Lib ${i}`, query, confirm: query }),
        });
        expect(response.status).toBe(201);
      }
      const capped = await app.request("/api/internal/prospects/campaigns", {
        method: "POST",
        headers: admin,
        body: JSON.stringify({
          name: "Ninth",
          query: "topic:ninth fork:false",
          confirm: "topic:ninth fork:false",
        }),
      });
      expect(capped.status).toBe(400);
      expect(((await capped.json()) as { error: string }).error).toBe(CAMPAIGN_CAP_ERROR);

      await migrate(sql);
      expect((await store.listDiscoveryCampaigns()).length).toBe(MAX_DISCOVERY_CAMPAIGNS);
    } finally {
      await sql.close();
    }
  });
});
