import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const orcamentistaGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.currentUser()?.roles.includes('Orcamentista')
    ? true
    : router.createUrlTree(['/inicio']);
};
