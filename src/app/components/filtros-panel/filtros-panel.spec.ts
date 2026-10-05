import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FiltrosPanel } from './filtros-panel';

describe('FiltrosPanel', () => {
  let component: FiltrosPanel;
  let fixture: ComponentFixture<FiltrosPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FiltrosPanel],
    }).compileComponents();

    fixture = TestBed.createComponent(FiltrosPanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
