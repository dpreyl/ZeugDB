import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import InspectionPhotoInputs from './InspectionPhotoInputs.svelte';

afterEach(cleanup);

describe('InspectionPhotoInputs', () => {
  it('shows both optional photo roles and reports the selected file', async () => {
    const onFileSelect = vi.fn();
    render(InspectionPhotoInputs, {
      props: {
        photoRoles: [
          { role: 'uebersicht', label: 'Geräteübersichtsbild', path: '' },
          { role: 'typenschild', label: 'Typenschildbild', path: 'assets/a.jpg' }
        ],
        onFileSelect
      }
    });
    const file = new File(['photo'], 'overview.jpg', { type: 'image/jpeg' });

    await fireEvent.change(screen.getByLabelText('Geräteübersichtsbild aufnehmen (optional)'), {
      target: { files: [file] }
    });

    expect(screen.getByText('Noch kein Bild hinterlegt')).toBeTruthy();
    expect(screen.getByText('a.jpg')).toBeTruthy();
    expect(onFileSelect).toHaveBeenCalledWith('uebersicht', file);
  });
});
