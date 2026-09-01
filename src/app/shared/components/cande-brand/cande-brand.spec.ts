import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CandeBrand } from './cande-brand';

describe('CandeBrand', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CandeBrand],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('keeps the same brand name while resolving each area destination', () => {
    const fixture = TestBed.createComponent(CandeBrand);
    fixture.componentRef.setInput('variant', 'skins');
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link.textContent?.trim()).toBe('CANDEMOR');
    expect(link.getAttribute('href')).toBe('/skins');
    expect(link.getAttribute('aria-label')).toBe('CANDEMOR');
  });

  it('allows a navbar to specialize navigation without redefining the brand', () => {
    const fixture = TestBed.createComponent(CandeBrand);
    fixture.componentRef.setInput('variant', 'web');
    fixture.componentRef.setInput('route', '/');
    fixture.componentRef.setInput('fragment', 'inicio');
    fixture.componentRef.setInput('ariaCurrent', 'page');
    fixture.componentRef.setInput('ariaLabel', 'Página principal, inicio');
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/#inicio');
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(link.getAttribute('aria-label')).toBe('CANDEMOR — Página principal, inicio');
  });
});
