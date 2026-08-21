-- Só se Confirm email estiver ligado. Preferível: desligar Confirm email no projeto novo.

update auth.users
set email_confirmed_at = now()
where email = 'teste@malibu.app';
