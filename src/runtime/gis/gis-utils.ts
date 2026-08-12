import {Deps} from '../deps';
import {GisInteropManager} from './gis-interop-manager';
import {InterventionType} from '../../api/intervention-type';
import {Message} from '../../proto/api_messages';
import {StorageKeys} from '../../utils/constants';
import {XhrFetcher} from '../fetcher';
import {addQueryParam, parseUrl} from '../../utils/url';
import {serviceUrl} from '../services';

/**
 * The mode of the GIS.
 */
export enum GisMode {
  GisModeDisabled = 'GIS_MODE_DISABLED',
  GisModeNormal = 'GIS_MODE_NORMAL',
  GisModeOverlay = 'GIS_MODE_OVERLAY',
}

/**
 * Determines the mode of the GIS.
 */
export function getGisMode(
  win: Window,
  action?: InterventionType,
  gisInteropManager?: GisInteropManager,
  gisInterop?: boolean
): GisMode {
  const isGisAllowed = action === InterventionType.TYPE_REGISTRATION_WALL;
  const isSafari =
    /Safari/i.test(win.navigator.userAgent) &&
    !/Chrome|Chromium|Edg/i.test(win.navigator.userAgent);
  const gisConnecting =
    !!gisInterop || !!gisInteropManager?.isConnectionExpected();
  const useGis = isGisAllowed && gisConnecting;
  if (!useGis) {
    return GisMode.GisModeDisabled;
  }
  if (isSafari) {
    return GisMode.GisModeOverlay;
  }
  return GisMode.GisModeNormal;
}

export interface MixRrmGisTokensParams {
  idToken: string;
  gisClientId: string;
  gisOrigin?: string;
}

export interface MixRrmGisTokensResponse {
  swgUserToken?: string;
  [key: string]: unknown;
}

/**
 * Calls MixRrmGisTokensAction directly to mix/link RRM and GIS tokens.
 */
export async function mixRrmGisTokens(
  deps: Deps,
  params: MixRrmGisTokensParams
): Promise<MixRrmGisTokensResponse> {
  const fetcher = new XhrFetcher(deps.win());
  const publicationId = deps.pageConfig().getPublicationId();
  const swgUserToken = await deps.storage().get(StorageKeys.USER_TOKEN, true);
  const rrmOrigin = parseUrl(deps.win().location.href).origin;

  const baseUrl = `/publication/${encodeURIComponent(
    publicationId
  )}/mixrrmgistokens`;

  let url = serviceUrl(baseUrl);
  if (swgUserToken) {
    url = addQueryParam(url, 'sut', swgUserToken);
  }
  url = addQueryParam(url, 'id_token', params.idToken);
  url = addQueryParam(url, 'gis_client_id', params.gisClientId);
  url = addQueryParam(url, 'rrm_origin', rrmOrigin);
  if (params.gisOrigin) {
    url = addQueryParam(url, 'gis_origin', params.gisOrigin);
  }

  const emptyMessage: Message = {
    toArray: () => [],
    label: () => 'MixRrmGisTokens',
  };

  const response = (await fetcher.sendPost(
    url,
    emptyMessage
  )) as MixRrmGisTokensResponse;

  if (response?.swgUserToken) {
    await deps.entitlementsManager().updateEntitlements(response.swgUserToken);
  }

  return response;
}
