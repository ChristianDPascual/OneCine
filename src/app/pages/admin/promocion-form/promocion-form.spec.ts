import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PromocionForm } from './promocion-form';

describe('PromocionForm', () => {
  let component: PromocionForm;
  let fixture: ComponentFixture<PromocionForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PromocionForm],
    }).compileComponents();

    fixture = TestBed.createComponent(PromocionForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
