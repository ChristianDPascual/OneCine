import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MiCredito } from './mi-credito';

describe('MiCredito', () => {
  let component: MiCredito;
  let fixture: ComponentFixture<MiCredito>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MiCredito],
    }).compileComponents();

    fixture = TestBed.createComponent(MiCredito);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
