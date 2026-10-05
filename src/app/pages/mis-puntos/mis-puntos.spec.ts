import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MisPuntos } from './mis-puntos';

describe('MisPuntos', () => {
  let component: MisPuntos;
  let fixture: ComponentFixture<MisPuntos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MisPuntos],
    }).compileComponents();

    fixture = TestBed.createComponent(MisPuntos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
