import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CompraCandy } from './compra-candy';

describe('CompraCandy', () => {
  let component: CompraCandy;
  let fixture: ComponentFixture<CompraCandy>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompraCandy],
    }).compileComponents();

    fixture = TestBed.createComponent(CompraCandy);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
