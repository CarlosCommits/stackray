import type { AppSession } from "@/lib/session/app-session";
import { getLatestScanEventId } from "@/lib/server/scans/events-service";
import {
  getAuthoritativeScanResult,
  getScanDetail,
  getScanRecord,
  getScanSubdomains,
  getTargetHistoryForScan,
} from "@/lib/server/scans/read-service";

export const SCAN_DETAIL_INITIAL_SUBDOMAIN_PAGE_SIZE = 250;

export async function getScanDetailPageData(session: AppSession, scanId: string) {
  const [latestEventId, scanRecord, scanDetail, primaryResult, targetHistory, subdomains] = await Promise.all([
    getLatestScanEventId(session, scanId),
    getScanRecord(session, scanId),
    getScanDetail(session, scanId),
    getAuthoritativeScanResult(session, scanId),
    getTargetHistoryForScan(session, scanId),
    getScanSubdomains(session, scanId, { pageSize: SCAN_DETAIL_INITIAL_SUBDOMAIN_PAGE_SIZE }),
  ]);

  return {
    latestEventId,
    scanRecord,
    scanDetail,
    primaryResult,
    targetHistory,
    subdomains,
  };
}
