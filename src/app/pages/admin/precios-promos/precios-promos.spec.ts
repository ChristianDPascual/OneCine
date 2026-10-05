import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PreciosPromos } from './precios-promos';

describe('PreciosPromos', () => {
  let component: PreciosPromos;
  let fixture: ComponentFixture<PreciosPromos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PreciosPromos],
    }).compileComponents();

    fixture = TestBed.createComponent(PreciosPromos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
