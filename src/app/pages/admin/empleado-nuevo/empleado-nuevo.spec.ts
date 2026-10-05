import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmpleadoNuevo } from './empleado-nuevo';

describe('EmpleadoNuevo', () => {
  let component: EmpleadoNuevo;
  let fixture: ComponentFixture<EmpleadoNuevo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmpleadoNuevo],
    }).compileComponents();

    fixture = TestBed.createComponent(EmpleadoNuevo);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
