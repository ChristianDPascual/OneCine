import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Cantidad de días de un mes (1 a 12). JavaScript ya contempla los bisiestos.
export function diasDelMes(anio: number, mes: number): number {
    return new Date(anio, mes, 0).getDate();
}

// Año de nacimiento según la edad y si ya cumplió años este año.
export function anioNacimiento(edad: number, mes: number, dia: number, hoy = new Date()): number {
    const mesActual = hoy.getMonth() + 1;
    const yaCumplio = mes < mesActual || (mes === mesActual && dia <= hoy.getDate());
    return hoy.getFullYear() - edad - (yaCumplio ? 0 : 1);
}

// Validador de grupo: revisa edad, mes y día en conjunto.
export function fechaNacimientoValidator(): ValidatorFn {
    return (grupo: AbstractControl): ValidationErrors | null => {
        const edad = grupo.get('edad');
        const mes = grupo.get('mes')?.value as number | null;
        const dia = grupo.get('dia')?.value as number | null;

        if (!edad || edad.invalid) {
            return null; // El error lo muestra el propio campo edad
        }

        if (mes === null || dia === null) {
            return { fechaIncompleta: true };
        }

        if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
            return null; // El error lo muestra el propio campo día
        }

        const anio = anioNacimiento(edad.value, mes, dia);
        const maximo = diasDelMes(anio, mes);

        if (dia <= maximo) {
            return null;
        }

        return mes === 2 && dia === 29
            ? { noBisiesto: { anio } }
            : { diaInexistente: { maximo } };
    };
}

export function fechaSql(anio: number, mes: number, dia: number): string {
        const dos = (n: number) => String(n).padStart(2, '0');
        return `${anio}-${dos(mes)}-${dos(dia)}`;
}