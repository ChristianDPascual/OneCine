import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormResena } from './form-resena';

describe('FormResena', () => {
  let component: FormResena;
  let fixture: ComponentFixture<FormResena>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormResena],
    }).compileComponents();

    fixture = TestBed.createComponent(FormResena);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
