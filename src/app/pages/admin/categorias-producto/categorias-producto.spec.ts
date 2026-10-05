import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoriasProducto } from './categorias-producto';

describe('CategoriasProducto', () => {
  let component: CategoriasProducto;
  let fixture: ComponentFixture<CategoriasProducto>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoriasProducto],
    }).compileComponents();

    fixture = TestBed.createComponent(CategoriasProducto);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
