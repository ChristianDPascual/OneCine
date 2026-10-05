import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Descuentos } from './descuentos';

describe('Descuentos', () => {
  let component: Descuentos;
  let fixture: ComponentFixture<Descuentos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Descuentos],
    }).compileComponents();

    fixture = TestBed.createComponent(Descuentos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
