import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SalaForm } from './sala-form';

describe('SalaForm', () => {
  let component: SalaForm;
  let fixture: ComponentFixture<SalaForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SalaForm],
    }).compileComponents();

    fixture = TestBed.createComponent(SalaForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
