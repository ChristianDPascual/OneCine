import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccionesCompra } from './acciones-compra';

describe('AccionesCompra', () => {
  let component: AccionesCompra;
  let fixture: ComponentFixture<AccionesCompra>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccionesCompra],
    }).compileComponents();

    fixture = TestBed.createComponent(AccionesCompra);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
