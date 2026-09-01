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

  it('centralizes the name and destination for each Cande area', () => {
    const fixture = TestBed.createComponent(CandeBrand);
    fixture.componentRef.setInput('variant', 'skins');
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link.textContent?.replace(/\s/g, '')).toBe('CANDESKINS');
    expect(link.getAttribute('href')).toBe('/skins');
    expect(link.getAttribute('aria-label')).toBe('CANDESKINS');
  });

  it('allows a navbar to specialize navigation without redefining the brand', () => {
    const fixture = TestBed.createComponent(CandeBrand);
    fixture.componentRef.setInput('variant', 'web');
    fixture.componentRef.setInput('route', '/');
    fixture.componentRef.setInput('fragment', 'inicio');
    fixture.componentRef.setInput('ariaCurrent', 'page');
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/#inicio');
    expect(link.getAttribute('aria-current')).toBe('page');
  });
});
