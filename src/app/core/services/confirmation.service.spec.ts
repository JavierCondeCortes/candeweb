import { TestBed } from '@angular/core/testing';
import { ConfirmationService } from './confirmation.service';

describe('ConfirmationService', () => {
  it('resuelve la acción desde el diálogo y limpia su estado', async () => {
    const service = TestBed.inject(ConfirmationService);
    const result = service.confirm({ message: '¿Eliminar?', tone: 'danger' });

    expect(service.state()).toEqual({ message: '¿Eliminar?', tone: 'danger' });
    service.accept();

    await expect(result).resolves.toBe(true);
    expect(service.state()).toBeNull();
  });

  it('trata cerrar o sustituir el diálogo como una cancelación', async () => {
    const service = TestBed.inject(ConfirmationService);
    const first = service.confirm({ message: 'Primera acción' });
    const second = service.confirm({ message: 'Segunda acción' });

    await expect(first).resolves.toBe(false);
    service.cancel();
    await expect(second).resolves.toBe(false);
  });
});
