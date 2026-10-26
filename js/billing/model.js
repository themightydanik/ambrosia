// Select only the configured monthly/yearly Google auto-renewing plans. No fallback fake prices.
export function plansFromOfferings(offerings, config) {
  const offering = offerings.all?.[config.offering];
  if (!offering) throw Error("PRODUCTS_UNAVAILABLE");
  return ["MONTHLY", "ANNUAL"].map((type, index) => {
    const packages = offering.availablePackages.filter(
      (p) =>
        p.packageType === type &&
        p.product.defaultOption?.productId === config.products[index],
    );
    if (packages.length !== 1) throw Error("PRODUCTS_UNAVAILABLE");
    const pkg = packages[0],
      option = pkg.product.defaultOption;
    if (
      option.isPrepaid ||
      option.installmentsInfo ||
      option.fullPricePhase?.recurrenceMode !== 1 ||
      option.billingPeriod?.iso8601 !== (index === 0 ? "P1M" : "P1Y") ||
      !option.pricingPhases?.length ||
      option.pricingPhases.length > 4
    )
      throw Error("PRODUCTS_UNAVAILABLE");
    for (const phase of option.pricingPhases) {
      if (
        !phase.price?.formatted ||
        !phase.billingPeriod?.iso8601 ||
        ![1, 2, 3].includes(phase.recurrenceMode) ||
        (phase.recurrenceMode === 2 &&
          (!Number.isInteger(phase.billingCycleCount) ||
            phase.billingCycleCount < 1))
      )
        throw Error("PRODUCTS_UNAVAILABLE");
    }
    return { type, pkg, option, phases: option.pricingPhases };
  });
}
