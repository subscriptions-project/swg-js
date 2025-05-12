import {InterventionType} from '../api/intervention-type';

const AUDIENCE_ACTION_TYPES_VALUES = [
  InterventionType.TYPE_BYO_CTA,
  InterventionType.TYPE_REGISTRATION_WALL,
  InterventionType.TYPE_NEWSLETTER_SIGNUP,
  InterventionType.TYPE_REWARDED_AD,
  InterventionType.TYPE_REWARDED_SURVEY,
] as const;

export type AudienceActionType = (typeof AUDIENCE_ACTION_TYPES_VALUES)[number];

const values = AUDIENCE_ACTION_TYPES_VALUES as ReadonlyArray<InterventionType>;

export function isAudienceActionType(
  actionType: InterventionType
): actionType is AudienceActionType {
  return values.includes(actionType);
}
