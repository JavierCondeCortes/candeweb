import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Requirements } from './requirements';

describe('Requirements', () => {
  let component: Requirements;
  let fixture: ComponentFixture<Requirements>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Requirements],
    }).compileComponents();

    fixture = TestBed.createComponent(Requirements);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps every definition group semantically valid', () => {
    const host = fixture.nativeElement as HTMLElement;
    const groups = host.querySelectorAll<HTMLElement>('dl.data-grid > .data-card');

    expect(groups).toHaveLength(4);
    for (const group of groups) {
      expect(Array.from(group.children).map((child) => child.tagName)).toEqual(['DT', 'DD', 'DD']);
    }
  });
});
