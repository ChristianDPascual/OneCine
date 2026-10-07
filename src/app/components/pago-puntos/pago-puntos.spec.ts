import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PagoPuntos } from './pago-puntos';

describe('PagoPuntos', () => {
  let component: PagoPuntos;
  let fixture: ComponentFixture<PagoPuntos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PagoPuntos],
    }).compileComponents();

    fixture = TestBed.createComponent(PagoPuntos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
