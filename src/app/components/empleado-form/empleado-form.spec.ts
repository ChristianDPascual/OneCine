import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmpleadoForm } from './empleado-form';

describe('EmpleadoForm', () => {
  let component: EmpleadoForm;
  let fixture: ComponentFixture<EmpleadoForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmpleadoForm],
    }).compileComponents();

    fixture = TestBed.createComponent(EmpleadoForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
