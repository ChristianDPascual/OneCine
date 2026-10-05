import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MisPeliculas } from './mis-peliculas';

describe('MisPeliculas', () => {
  let component: MisPeliculas;
  let fixture: ComponentFixture<MisPeliculas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MisPeliculas],
    }).compileComponents();

    fixture = TestBed.createComponent(MisPeliculas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
