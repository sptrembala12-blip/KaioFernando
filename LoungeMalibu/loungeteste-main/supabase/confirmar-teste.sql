-- Cole no SQL Editor do Supabase (uma vez) para liberar o login teste.
-- Authentication > não precisa: isso confirma o e-mail interno.

update auth.users
set email_confirmed_at = now()
where email in ('teste@malibu.app', 'teste@malibu.local');
