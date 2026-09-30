import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { APP_CONFIG } from '../../../core/config/app-config';
import { TEST_CONFIG } from '../../../../testing/test-helpers';
import { ConsoleStore } from '../console.store';
import { MatrixEditorComponent } from './matrix-editor.component';

async function setup() {
  TestBed.configureTestingModule({
    imports: [MatrixEditorComponent],
    providers: [provideHttpClient(), provideHttpClientTesting(), { provide: APP_CONFIG, useValue: TEST_CONFIG }, ConsoleStore],
  });
  const fixture = TestBed.createComponent(MatrixEditorComponent);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const store = TestBed.inject(ConsoleStore);

  const setInput = async (label: string, value: string) => {
    const input = el.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const setFill = async (value: string) => {
    const select = el.querySelector<HTMLSelectElement>('select[aria-label="Relleno de la matriz"]')!;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  };
  const submit = async () => {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };
  return { el, store, fixture, setInput, setFill, submit };
}

describe('MatrixEditorComponent (matriz personalizada)', () => {
  it('crea una matriz con las filas y columnas elegidas por el usuario', async () => {
    const { el, store, setInput, setFill, submit } = await setup();

    await setInput('Número de filas', '4');
    await setInput('Número de columnas', '6');
    await setFill('zeros');
    await submit();

    expect(store.dims()).toEqual({ rows: 4, cols: 6 });
    expect(el.querySelectorAll('input.cell')).toHaveLength(24);
    expect(el.querySelector('textarea')!.value).toContain('[0, 0, 0, 0, 0, 0]');
  });

  it('valida el rango 1..100 y deshabilita el botón de crear', async () => {
    const { el, store, setInput } = await setup();

    await setInput('Número de filas', '101');

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('entre 1 y 100');
    expect(el.querySelector<HTMLButtonElement>('form button[type="submit"]')!.disabled).toBe(true);
    expect(store.dims()).toEqual({ rows: 3, cols: 3 }); // preset inicial intacto
  });

  it('conserva lo que el usuario escribe después de crear una matriz (regresión)', async () => {
    const { el, store, setInput, submit } = await setup();
    await setInput('Número de filas', '4');
    await setInput('Número de columnas', '6');
    await submit();

    await setInput('Número de filas', '101');

    expect(el.querySelector<HTMLInputElement>('input[aria-label="Número de filas"]')!.value).toBe('101');
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('entre 1 y 100');
    expect(store.dims()).toEqual({ rows: 4, cols: 6 });
  });

  it('el formulario sigue a la matriz cuando cambia desde un preset', async () => {
    const { el, store, fixture } = await setup();
    store.loadPreset('wide'); // 2×4
    await fixture.whenStable();

    expect(el.querySelector<HTMLInputElement>('input[aria-label="Número de filas"]')!.value).toBe('2');
    expect(el.querySelector<HTMLInputElement>('input[aria-label="Número de columnas"]')!.value).toBe('4');
  });

  it('matrices mayores que la grilla se editan solo desde el JSON', async () => {
    const { el, setInput, submit } = await setup();

    await setInput('Número de filas', '20');
    await setInput('Número de columnas', '20');
    await submit();

    expect(el.querySelectorAll('input.cell')).toHaveLength(0);
    expect(el.textContent).toContain('excede la grilla');
  });

  it('editar una celda actualiza el store', async () => {
    const { el, store, fixture } = await setup();
    const cell = el.querySelector<HTMLInputElement>('input[aria-label="A[0][0]"]')!;

    cell.value = '42';
    cell.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(store.matrix()[0][0]).toBe(42);
  });
});
