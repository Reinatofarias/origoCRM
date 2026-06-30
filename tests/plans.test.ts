import { describe, expect, it } from "vitest";

import {
  billingPeriods,
  getPlanLimits,
  getPlanPriceCents,
  getPlanUserLimit,
  isSubscriptionOperational,
  planHasFeature,
  plans,
} from "../src/lib/plans";

describe("planos comerciais", () => {
  it("mantém três planos e três períodos oficiais", () => {
    expect(plans.map((plan) => plan.slug)).toEqual(["base", "pro", "prospecting"]);
    expect(billingPeriods.map((period) => period.key)).toEqual(["monthly", "semiannual", "annual"]);
  });

  it("calcula os totais cobrados pela Stripe", () => {
    expect(getPlanPriceCents("base", "monthly")).toBe(6_700);
    expect(getPlanPriceCents("base", "semiannual")).toBe(34_200);
    expect(getPlanPriceCents("base", "annual")).toBe(56_400);
    expect(getPlanPriceCents("prospecting", "annual")).toBe(116_400);
  });

  it("bloqueia prospecção no Start e libera nos planos superiores", () => {
    expect(planHasFeature("base", "prospecting")).toBe(false);
    expect(getPlanLimits("base").prospectingSearchLimit).toBe(0);
    expect(planHasFeature("pro", "prospecting")).toBe(true);
    expect(getPlanLimits("pro").campaignBatchLimit).toBe(20);
    expect(getPlanLimits("prospecting").campaignBatchLimit).toBe(50);
  });

  it("usa a quantidade paga como limite de usuários", () => {
    expect(getPlanUserLimit("base", 1)).toBe(1);
    expect(getPlanUserLimit("pro", 4)).toBe(4);
    expect(getPlanUserLimit("prospecting", 10)).toBe(10);
  });

  it("bloqueia operação quando a assinatura paga não está ativa", () => {
    expect(isSubscriptionOperational("active", "stripe")).toBe(true);
    expect(isSubscriptionOperational("trialing", "stripe")).toBe(true);
    expect(isSubscriptionOperational("past_due", "stripe")).toBe(false);
    expect(isSubscriptionOperational("canceled", "stripe")).toBe(false);
    expect(isSubscriptionOperational("trialing", "manual")).toBe(true);
  });
});
