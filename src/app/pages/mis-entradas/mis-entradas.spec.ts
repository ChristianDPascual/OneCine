import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MisEntradas } from './mis-entradas';

describe('MisEntradas', () => {
  let component: MisEntradas;
  let fixture: ComponentFixture<MisEntradas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MisEntradas],
    }).compileComponents();

    fixture = TestBed.createComponent(MisEntradas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
