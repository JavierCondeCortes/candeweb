import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormInscription } from './form-inscription';

describe('FormInscription', () => {
  let component: FormInscription;
  let fixture: ComponentFixture<FormInscription>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormInscription],
    }).compileComponents();

    fixture = TestBed.createComponent(FormInscription);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows accessible errors and focuses the first field when submitted empty', async () => {
    await component.submit();
    fixture.detectChanges();

    const errors = fixture.nativeElement.querySelectorAll('[role="alert"]');
    const firstField = fixture.nativeElement.querySelector('#iracingName') as HTMLInputElement;

    expect(errors.length).toBe(5);
    expect(firstField.getAttribute('aria-invalid')).toBe('true');
  });

  it('sends valid data to the official Google Form and shows success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    component.form.setValue({
      iracingName: 'Piloto Test',
      discordName: 'piloto.test',
      email: 'piloto@example.com',
      mood: 'SI',
      consent: true,
    });

    await component.submit();
    fixture.detectChanges();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toContain('/formResponse');
    expect(fetchMock.mock.calls[0][1]?.body).toContain('entry.907677391=Piloto+Test');
    expect(fetchMock.mock.calls[0][1]?.body).toContain('entry.1512476117=piloto.test');
    expect(component.status()).toBe('success');
    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      'Inscripción enviada',
    );

    vi.unstubAllGlobals();
  });
});
