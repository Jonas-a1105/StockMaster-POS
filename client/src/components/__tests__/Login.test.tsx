import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../db/auth', () => ({
  loginOnline: vi.fn(),
  loginOffline: vi.fn(),
  isOnline: vi.fn(() => true),
}));

vi.mock('../../assets/logo.png', () => ({ default: 'logo.png' }));

import Login from '../Login';

describe('Login component', () => {
  const mockProps = {
    onLoginSuccess: vi.fn(),
    onNavigateToRegister: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza logo, brand y campo de email', () => {
    render(<Login {...mockProps} />);
    expect(screen.getByText('StockMasterPro')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('cajero@empresa.com')).toBeInTheDocument();
  });

  it('muestra botón de inicio online cuando hay conexión', () => {
    render(<Login {...mockProps} />);
    expect(screen.getByRole('button', { name: /iniciar sesión online/i })).toBeInTheDocument();
  });

  it('alterna entre modo contraseña y PIN', async () => {
    const user = userEvent.setup();
    render(<Login {...mockProps} />);

    const passwordTab = screen.getByRole('button', { name: /contraseña/i });
    expect(passwordTab).toBeInTheDocument();
    const pinTab = screen.getByRole('button', { name: /pin cajero/i });
    await user.click(pinTab);

    expect(screen.getByText(/código pin/i)).toBeInTheDocument();
  });

  it('muestra error al enviar formulario vacío', async () => {
    const user = userEvent.setup();
    render(<Login {...mockProps} />);

    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));
    expect(screen.getByText(/debe ingresar su correo/i)).toBeInTheDocument();
  });

  it('muestra enlace de registro cuando está online', () => {
    render(<Login {...mockProps} />);
    expect(screen.getByText(/registr/i)).toBeInTheDocument();
  });

  it('alterna visibilidad de contraseña', async () => {
    const user = userEvent.setup();
    render(<Login {...mockProps} />);

    const passwordInput = screen.getByPlaceholderText('******');
    expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleBtn = screen.getByRole('button', { name: '' });
    await user.click(toggleBtn);
    expect(passwordInput).toHaveAttribute('type', 'text');
  });
});
