import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CandyFuncion } from './candy-funcion';

describe('CandyFuncion', () => {
  let component: CandyFuncion;
  let fixture: ComponentFixture<CandyFuncion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CandyFuncion],
    }).compileComponents();

    fixture = TestBed.createComponent(CandyFuncion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
