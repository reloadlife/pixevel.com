/**
 * Client-safe DNS constants. Kept free of any server-only imports (db/pg) so
 * "use client" components can import the record-type list without dragging the
 * server data layer into the browser bundle. `manage.ts` re-uses these.
 */

export const DNS_RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "CAA"] as const;

export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];

/** Types that require a numeric priority. */
export const DNS_PRIORITY_TYPES: DnsRecordType[] = ["MX", "SRV"];
