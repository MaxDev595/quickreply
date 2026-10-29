/**
 * The only runtime message in QuickReply: the popup asks the content script in
 * the active tab which site it is on (so "Disable on this site" works without
 * the `tabs` permission). Messages are validated on both ends.
 */
export const GET_PAGE_INFO = 'quickreply/get-page-info' as const;

export interface GetPageInfoRequest {
  type: typeof GET_PAGE_INFO;
}

export interface PageInfo {
  hostname: string;
}

export function isGetPageInfoRequest(value: unknown): value is GetPageInfoRequest {
  return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === GET_PAGE_INFO;
}

export function isPageInfo(value: unknown): value is PageInfo {
  return typeof value === 'object' && value !== null && typeof (value as { hostname?: unknown }).hostname === 'string';
}
