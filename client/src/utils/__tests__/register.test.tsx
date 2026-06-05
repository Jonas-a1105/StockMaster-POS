import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../db/auth', () => ({
  registerOnline: vi.fn(),
}));

vi.mock('../../assets/logo.png', () => ({ default: 'logo.png' }));

import Register from '../../components/Register';

describe('Register component', () => {
  const mockProps = {
    onRegisterSuccess: vi.fn(),
    onNavigateToLogin: vi.fn(),
  };

  it('renderiza el formulario de registro', () => {
    render(<Register {...mockProps} />);
    expect(screen.getByText('Registro de Cajero')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('juan.perez@empresa.com')).toBeInTheDocument();
  });

  it('rechaza contraseña de menos de 8 caracteres', async () => {
    const user = userEvent.setup();
    render(<Register {...mockProps} />);

    await user.type(screen.getByPlaceholderText('Juan Pérez'), 'Test');
    await user.type(screen.getByPlaceholderText('juan.perez@empresa.com'), 'test@test.com');
    await user.type(screen.getByPlaceholderText('Mínimo 6 caracteres'), 'Ab1!');

    await user.click(screen.getByRole('button', { name: /registr/i }));

    expect(screen.getByText(/al menos 8 caracteres/i)).toBeInTheDocument();
  });

  it('rechaza contraseña sin mayúscula', async () => {
    const user = userEvent.setup();
    render(<Register {...mockProps} />);

    await user.type(screen.getByPlaceholderText('Juan Pérez'), 'Test');
    await user.type(screen.getByPlaceholderText('juan.perez@empresa.com'), 'test@test.com');
    await user.type(screen.getByPlaceholderText('Mínimo 6 caracteres'), 'abcdefgh1!');

    await user.click(screen.getByRole('button', { name: /registr/i }));

    expect(screen.getByText(/mayúscula/i)).toBeInTheDocument();
  });
});
