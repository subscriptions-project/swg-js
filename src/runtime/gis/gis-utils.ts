import {GisInteropManager} from './gis-interop-manager';
import {InterventionType} from '../../api/intervention-type';

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
