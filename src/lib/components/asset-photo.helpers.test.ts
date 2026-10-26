import { describe, expect, it } from 'vitest';
import { photoRoleField, setPhotoRolePath, type PhotoRole } from './asset-photo.helpers';

describe('asset photo role helpers', () => {
  it('maps the required equipment photo roles to separate asset fields', () => {
    expect(photoRoleField('typenschild')).toBe('foto_typenschild');
    expect(photoRoleField('uebersicht')).toBe('foto_uebersicht');
  });

  it('updates one role path without losing the other photo reference or metadata', () => {
    const current = {
      fotos: 'fotos/a/photo-0.png',
      foto_typenschild: 'fotos/a/photo-0.png',
      inventarnummer: 'EL-001'
    };

    expect(setPhotoRolePath(current, 'uebersicht', 'fotos/a/photo-1.jpg')).toEqual({
      ...current,
      foto_uebersicht: 'fotos/a/photo-1.jpg'
    });
    expect(setPhotoRolePath(current, 'typenschild', '')).toEqual({
      ...current,
      foto_typenschild: ''
    });
  });

  it('supports exactly the two equipment documentation roles', () => {
    const roles: PhotoRole[] = ['typenschild', 'uebersicht'];
    expect(roles).toHaveLength(2);
  });
});
