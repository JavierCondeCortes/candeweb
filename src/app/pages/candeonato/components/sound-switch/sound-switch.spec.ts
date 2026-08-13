import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SoundSwitch } from './sound-switch';

describe('SoundSwitch', () => {
  let component: SoundSwitch;
  let fixture: ComponentFixture<SoundSwitch>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SoundSwitch],
    }).compileComponents();

    fixture = TestBed.createComponent(SoundSwitch);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('exposes keyboard-accessible play, sound and viewing buttons', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');

    expect(buttons.length).toBe(3);
    expect(buttons[0].getAttribute('aria-label')).toContain('Pausar');
    expect(buttons[1].getAttribute('aria-label')).toContain('Activar sonido');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
    expect(buttons[2].getAttribute('aria-label')).toBe('Ver vídeo sin interfaz');
    expect(buttons[2].getAttribute('aria-pressed')).toBe('false');
  });

  it('requests the viewing mode when its third button is activated', () => {
    const emit = vi.spyOn(component.viewToggle, 'emit');
    const button = fixture.nativeElement.querySelectorAll('button')[2] as HTMLButtonElement;

    button.click();

    expect(emit).toHaveBeenCalledOnce();
  });
});
