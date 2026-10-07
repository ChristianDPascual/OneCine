import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PagoCredito } from './pago-credito';

describe('PagoCredito', () => {
  let component: PagoCredito;
  let fixture: ComponentFixture<PagoCredito>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PagoCredito],
    }).compileComponents();

    fixture = TestBed.createComponent(PagoCredito);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
