import type { Service, ServiceOption } from "@/types/booking";

/**
 * Single source of truth for treatment names, durations and pricing.
 * Nothing here is hardcoded in JSX — components look up display text
 * via `nameKey` / `descriptionKey` through next-intl, and prices
 * through the pricing helpers in lib/booking/pricing.ts.
 *
 * When this moves to a real backend, this module is the file to
 * replace with a database-backed fetch — the shape (`Service[]`)
 * should stay the same so components don't need to change.
 */
export const services: Service[] = [
  {
    id: "aroma-oil",
    nameKey: "services.aromaOil.name",
    descriptionKey: "services.aromaOil.description",
    order: 1,
    options: [
      { id: "aroma-oil-60", serviceId: "aroma-oil", durationMinutes: 60, pricePerPerson: 100_000 },
      { id: "aroma-oil-90", serviceId: "aroma-oil", durationMinutes: 90, pricePerPerson: 140_000, recommended: true },
      { id: "aroma-oil-120", serviceId: "aroma-oil", durationMinutes: 120, pricePerPerson: 180_000 },
    ],
  },
  {
    id: "hot-stone",
    nameKey: "services.hotStone.name",
    descriptionKey: "services.hotStone.description",
    order: 2,
    options: [
      { id: "hot-stone-90", serviceId: "hot-stone", durationMinutes: 90, pricePerPerson: 160_000 },
      { id: "hot-stone-120", serviceId: "hot-stone", durationMinutes: 120, pricePerPerson: 200_000 },
      { id: "hot-stone-150", serviceId: "hot-stone", durationMinutes: 150, pricePerPerson: 250_000 },
    ],
  },
  {
    id: "facial",
    nameKey: "services.facial.name",
    descriptionKey: "services.facial.description",
    order: 3,
    // No options published yet — this array is intentionally empty so
    // the treatment step can filter it out until pricing is finalized,
    // without needing any structural change to add options later.
    options: [],
  },
];

export function getService(serviceId: string): Service | undefined {
  return services.find((service) => service.id === serviceId);
}

export function getServiceOption(serviceOptionId: string): ServiceOption | undefined {
  for (const service of services) {
    const option = service.options.find((o) => o.id === serviceOptionId);
    if (option) return option;
  }
  return undefined;
}

export function getServiceForOption(serviceOptionId: string): Service | undefined {
  return services.find((service) =>
    service.options.some((o) => o.id === serviceOptionId),
  );
}

/** Services that currently have at least one bookable option. */
export function getBookableServices(): Service[] {
  return services.filter((service) => service.options.length > 0).sort((a, b) => a.order - b.order);
}
