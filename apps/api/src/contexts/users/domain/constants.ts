export const USER_STATUS_ACTIVE = 'active';
export const USER_STATUS_INACTIVE = 'inactive';

export type UserStatus =
  | typeof USER_STATUS_ACTIVE
  | typeof USER_STATUS_INACTIVE;
