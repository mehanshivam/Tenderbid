import type { ExtractedMetadata, CompanyProfile } from "./types";

/**
 * Aggregates metadata from multiple vault documents into a single CompanyProfile.
 * Uses frequency-based selection for company name and first-found for unique fields.
 */
export function aggregateProfile(
  entries: { id: string; metadata: ExtractedMetadata }[]
): CompanyProfile {
  const allNames: string[] = [];
  let pan = "";
  let gstin = "";
  let registeredAddress = "";
  const partnersSet = new Set<string>();
  const turnoverMap = new Map<string, string>();
  const projectsMap = new Map<string, CompanyProfile["pastProjects"][number]>();
  const certsSet = new Set<string>();

  for (const { metadata } of entries) {
    // Company name — collect all for frequency analysis
    if (metadata.companyName?.trim()) {
      allNames.push(metadata.companyName.trim());
    }

    // PAN — first non-empty
    if (!pan && metadata.pan?.trim()) {
      pan = metadata.pan.trim();
    }

    // GSTIN — first non-empty
    if (!gstin && metadata.gstin?.trim()) {
      gstin = metadata.gstin.trim();
    }

    // Address — first non-empty
    if (!registeredAddress && metadata.registeredAddress?.trim()) {
      registeredAddress = metadata.registeredAddress.trim();
    }

    // Partners — deduplicated union
    if (metadata.partners) {
      for (const p of metadata.partners) {
        if (p.trim()) partnersSet.add(p.trim());
      }
    }

    // Turnover — merge by year, keep highest if conflict
    if (metadata.turnover) {
      for (const t of metadata.turnover) {
        const existing = turnoverMap.get(t.year);
        if (!existing) {
          turnoverMap.set(t.year, t.amount);
        }
      }
    }

    // Past projects — deduplicate by name
    if (metadata.pastProjects) {
      for (const proj of metadata.pastProjects) {
        const key = proj.name.toLowerCase().trim();
        if (!projectsMap.has(key)) {
          projectsMap.set(key, proj);
        }
      }
    }

    // Certifications — deduplicated union
    if (metadata.certifications) {
      for (const c of metadata.certifications) {
        if (c.trim()) certsSet.add(c.trim());
      }
    }
  }

  // Select most frequent company name
  const companyName = getMostFrequent(allNames) || "";

  // Convert turnover map to sorted array
  const turnoverHistory = Array.from(turnoverMap.entries())
    .map(([year, amount]) => ({ year, amount }))
    .sort((a, b) => a.year.localeCompare(b.year));

  const pastProjects = Array.from(projectsMap.values());

  return {
    companyName,
    pan,
    gstin,
    registeredAddress,
    partners: Array.from(partnersSet),
    turnoverHistory,
    totalProjects: pastProjects.length,
    pastProjects,
    certifications: Array.from(certsSet),
    lastUpdated: new Date().toISOString(),
  };
}

function getMostFrequent(arr: string[]): string | undefined {
  if (arr.length === 0) return undefined;
  const counts = new Map<string, number>();
  for (const item of arr) {
    const lower = item.toLowerCase();
    counts.set(lower, (counts.get(lower) || 0) + 1);
  }
  let maxCount = 0;
  let maxItem = arr[0];
  for (const [key, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      // Return the original casing from first occurrence
      maxItem = arr.find((a) => a.toLowerCase() === key) || key;
    }
  }
  return maxItem;
}
