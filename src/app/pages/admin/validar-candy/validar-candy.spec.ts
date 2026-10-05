import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ValidarCandy } from './validar-candy';

describe('ValidarCandy', () => {
  let component: ValidarCandy;
  let fixture: ComponentFixture<ValidarCandy>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ValidarCandy],
    }).compileComponents();

    fixture = TestBed.createComponent(ValidarCandy);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
