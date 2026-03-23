import {InterventionResult} from '../../api/available-intervention';
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
  clientId?: string,
  action?: InterventionType,
  onResult?: (result: InterventionResult) => Promise<boolean> | boolean
): GisMode {
  const isGisAllowed = action === InterventionType.TYPE_REGISTRATION_WALL;
  const isSafari =
    /Safari/i.test(win.navigator.userAgent) &&
    !/Chrome|Chromium|Edg/i.test(win.navigator.userAgent);
  const useGis = !!clientId && !!onResult && isGisAllowed;
  if (!useGis) {
    return GisMode.GisModeDisabled;
  }
  if (isSafari) {
    return GisMode.GisModeOverlay;
  }
  return GisMode.GisModeNormal;
}
