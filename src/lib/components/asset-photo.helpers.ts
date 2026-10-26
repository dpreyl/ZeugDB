export type PhotoRole = 'typenschild' | 'uebersicht';

const PHOTO_ROLE_FIELDS: Record<PhotoRole, string> = {
  typenschild: 'foto_typenschild',
  uebersicht: 'foto_uebersicht'
};

export function photoRoleField(role: PhotoRole): string {
  return PHOTO_ROLE_FIELDS[role];
}

export function setPhotoRolePath(
  fields: Record<string, string>,
  role: PhotoRole,
  path: string
): Record<string, string> {
  return { ...fields, [photoRoleField(role)]: path };
}
