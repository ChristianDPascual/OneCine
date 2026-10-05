import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PerfilPanel } from './perfil-panel';

describe('PerfilPanel', () => {
  let component: PerfilPanel;
  let fixture: ComponentFixture<PerfilPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PerfilPanel],
    }).compileComponents();

    fixture = TestBed.createComponent(PerfilPanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
