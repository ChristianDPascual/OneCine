import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CarritoResumen } from './carrito-resumen';

describe('CarritoResumen', () => {
  let component: CarritoResumen;
  let fixture: ComponentFixture<CarritoResumen>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CarritoResumen],
    }).compileComponents();

    fixture = TestBed.createComponent(CarritoResumen);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
