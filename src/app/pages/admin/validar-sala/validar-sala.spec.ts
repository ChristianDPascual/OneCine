import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ValidarSala } from './validar-sala';

describe('ValidarSala', () => {
  let component: ValidarSala;
  let fixture: ComponentFixture<ValidarSala>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ValidarSala],
    }).compileComponents();

    fixture = TestBed.createComponent(ValidarSala);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
