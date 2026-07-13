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
});
