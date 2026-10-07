import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ValidadorQr } from './validador-qr';

describe('ValidadorQr', () => {
  let component: ValidadorQr;
  let fixture: ComponentFixture<ValidadorQr>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ValidadorQr],
    }).compileComponents();

    fixture = TestBed.createComponent(ValidadorQr);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
