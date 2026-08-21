-- SQL Editor do projeto nbkhlhasmgavorsegizs (Run).
-- Não mexe em confirmed_at (coluna gerada — por isso o script anterior cai).

update auth.users
set email_confirmed_at = now()
where id = '45be011b-75f2-4926-a5af-026661018892';

insert into public.user_roles (user_id, role)
select '45be011b-75f2-4926-a5af-026661018892'::uuid, 'admin'::public.app_role
where not exists (
  select 1 from public.user_roles
  where user_id = '45be011b-75f2-4926-a5af-026661018892'
    and role = 'admin'
);
