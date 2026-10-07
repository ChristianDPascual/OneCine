import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EstadoApp } from './estado-app';

describe('EstadoApp', () => {
  let component: EstadoApp;
  let fixture: ComponentFixture<EstadoApp>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EstadoApp],
    }).compileComponents();

    fixture = TestBed.createComponent(EstadoApp);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
