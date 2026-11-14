import { test } from "node:test";
import assert from "node:assert/strict";
import { plansFromOfferings } from "../js/billing/model.js";
import { billingCopy, periodLabel } from "../js/billing/copy.js";
const cfg = {
  offering: "fixture",
  products: ["fixture_month", "fixture_year"],
};
function offerings() {
  return {
    all: {
      fixture: {
        availablePackages: ["MONTHLY", "ANNUAL"].map((type, i) => ({
          packageType: type,
          product: {
            defaultOption: {
              id: "base",
              productId: cfg.products[i],
              isBasePlan: true,
              isPrepaid: false,
              installmentsInfo: null,
              billingPeriod: { iso8601: i ? "P1Y" : "P1M" },
              fullPricePhase: { recurrenceMode: 1 },
              pricingPhases: [
                {
                  recurrenceMode: 1,
                  price: { formatted: i ? "€49,99" : "€5,49" },
                  billingPeriod: { iso8601: i ? "P1Y" : "P1M" },
                },
              ],
            },
          },
        })),
      },
    },
  };
}
test("only configured monthly/yearly store offerings accepted, localized prices are preserved", () => {
  const plans = plansFromOfferings(offerings(), cfg);
  assert.equal(plans.length, 2);
  assert.equal(plans[0].phases[0].price.formatted, "€5,49");
  for (const invalid of [
    { all: {} },
    { all: { fixture: { availablePackages: [] } } },
  ])
    assert.throws(() => plansFromOfferings(invalid, cfg));
  for (const changes of [
    { isPrepaid: true },
    { installmentsInfo: {} },
    { billingPeriod: { iso8601: "P1W" } },
    { productId: "unknown" },
  ]) {
    const o = offerings();
    Object.assign(
      o.all.fixture.availablePackages[0].product.defaultOption,
      changes,
    );
    assert.throws(() => plansFromOfferings(o, cfg));
  }
});
test("eligible trial phases are preserved and every billing message is localized", () => {
  const o = offerings(),
    option = o.all.fixture.availablePackages[0].product.defaultOption;
  option.isBasePlan = false;
  option.pricingPhases.unshift({
    recurrenceMode: 2,
    billingCycleCount: 1,
    price: { formatted: "€0,00" },
    billingPeriod: { iso8601: "P1W" },
  });
  assert.equal(
    plansFromOfferings(o, cfg)[0].phases[0].price.formatted,
    "€0,00",
  );
  for (const lang of ["uk", "ru"])
    for (const [key, value] of Object.entries(billingCopy("en")))
      assert.equal(typeof billingCopy(lang)[key], typeof value);
  assert.equal(periodLabel("P1M", "uk"), "1 міс.");
});

test("non-recurring Google trial phases may have zero billingCycleCount", () => {
  const data = offerings(),
    option = data.all.fixture.availablePackages[0].product.defaultOption;
  option.isBasePlan = false;
  option.pricingPhases.unshift({
    recurrenceMode: 3,
    billingCycleCount: 0,
    price: { formatted: "€0,00" },
    billingPeriod: { iso8601: "P1W" },
  });
  assert.equal(plansFromOfferings(data, cfg)[0].phases.length, 2);
});
