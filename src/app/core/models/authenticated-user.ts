export interface AuthenticatedUser {
  id: number;
  nome: string;
  email: string | null;
  roles: string[];
}
