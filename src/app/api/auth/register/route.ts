import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createEmployee } from '@/services/employee-service';
import { RolEmpleado } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const { nombre, email, password } = await req.json();

    if (!nombre || !email || !password) {
      return NextResponse.json({ message: 'Todos los campos son requeridos' }, { status: 400 });
    }

    // Por defecto, los usuarios se registran como Empleados.
    const newUser = await createEmployee({ nombre, email, password, rol: RolEmpleado.EMPLEADO });

    session.user = newUser;
    await session.save();

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    if (error instanceof Error && error.message.includes('Ya existe un empleado')) {
      return NextResponse.json({ message: 'Este correo electrónico ya está en uso.' }, { status: 409 });
    }
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 });
  }
}
