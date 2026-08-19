import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormInscription } from './form-inscription';

describe('FormInscription', () => {
  let fixture: ComponentFixture<FormInscription>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormInscription],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(FormInscription);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('shows an honest pending state when the edition has no registration URL', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('iframe')).toBeFalsy();
    expect(host.textContent).toContain('El formulario todavía no está disponible');
  });

  it('renders Google Form questions as native Candeweb controls without an iframe', async () => {
    const formUrl = 'https://forms.gle/yiH1UGMCCVBtA5mG7';
    fixture.componentRef.setInput('registrationUrl', formUrl);
    fixture.detectChanges();

    const request = http.expectOne(`/api/public/google-form?url=${encodeURIComponent(formUrl)}`);
    request.flush({
      title: 'Inscripción New Era',
      description: 'Formulario oficial',
      viewUrl: formUrl,
      supported: true,
      fields: [
        {
          id: '101',
          kind: 'text',
          label: 'Nombre de piloto',
          description: 'Nombre exacto de iRacing',
          required: true,
          options: [],
        },
        {
          id: '102',
          kind: 'radio',
          label: '¿Estás de los auténticos nervios?',
          description: '',
          required: false,
          options: ['Sí', 'Muchísimo'],
        },
      ],
    });
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('iframe')).toBeFalsy();
    expect(host.querySelector('input[name="entry.101"]')).toBeTruthy();
    expect(host.querySelectorAll('input[name="entry.102"]').length).toBe(2);
    expect(host.textContent).toContain('Inscripción New Era');
    expect(host.textContent).toContain('Nombre de piloto');
  });

  it('uses the official external form as a safe fallback for unsupported providers', async () => {
    fixture.componentRef.setInput('registrationUrl', 'https://example.com/inscripcion');
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('iframe')).toBeFalsy();
    expect(host.querySelector('a[href="https://example.com/inscripcion"]')).toBeTruthy();
  });
});
