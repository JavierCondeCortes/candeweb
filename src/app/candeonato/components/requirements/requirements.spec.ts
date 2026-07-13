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
});
