
-- =========== ENUMS ===========
CREATE TYPE public.app_role AS ENUM ('admin', 'garcom', 'cliente');
CREATE TYPE public.pedido_status AS ENUM ('pendente', 'pago', 'cancelado');
CREATE TYPE public.forma_pagamento AS ENUM ('pix', 'credito', 'debito', 'dinheiro');

-- =========== PROFILES ===========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles: usuário vê o próprio" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Profiles: usuário atualiza o próprio" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Profiles: usuário insere o próprio" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- =========== USER ROLES ===========
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Roles: admin vê todos" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Roles: usuário vê o próprio" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Trigger: criar profile + role admin no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  -- Primeiro usuário cadastrado vira admin automaticamente
  IF (SELECT COUNT(*) FROM public.user_roles WHERE role = 'admin') = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========== MESAS ===========
CREATE TABLE public.mesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INT NOT NULL UNIQUE,
  hash TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mesas: leitura pública" ON public.mesas
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Mesas: admin gerencia" ON public.mesas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========== PRODUTOS ===========
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  preco_centavos INT NOT NULL CHECK (preco_centavos >= 0),
  categoria TEXT NOT NULL DEFAULT 'Bebidas',
  imagem_url TEXT,
  estoque INT NOT NULL DEFAULT 0 CHECK (estoque >= 0),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Produtos: leitura pública" ON public.produtos
  FOR SELECT TO anon, authenticated USING (ativo = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Produtos: admin gerencia" ON public.produtos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========== PEDIDOS ===========
CREATE TABLE public.pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mesa_id UUID NOT NULL REFERENCES public.mesas(id) ON DELETE RESTRICT,
  mesa_numero INT NOT NULL,
  itens JSONB NOT NULL,
  valor_total_centavos INT NOT NULL CHECK (valor_total_centavos >= 0),
  forma_pagamento forma_pagamento NOT NULL,
  troco_para_centavos INT,
  status pedido_status NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pedidos: criação pública" ON public.pedidos
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Pedidos: admin lê todos" ON public.pedidos
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Pedidos: admin atualiza" ON public.pedidos
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Index para dashboard
CREATE INDEX idx_pedidos_paid_at ON public.pedidos(paid_at) WHERE status = 'pago';
CREATE INDEX idx_pedidos_status ON public.pedidos(status);

-- =========== TRIGGER updated_at ===========
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER produtos_updated_at BEFORE UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========== RPC ATÔMICA DE CHECKOUT ===========
-- Decrementa estoque e cria pedido. Se faltar estoque, faz rollback e retorna qual produto faltou.
CREATE OR REPLACE FUNCTION public.criar_pedido_atomico(
  _mesa_id UUID,
  _itens JSONB,                 -- [{produto_id, nome, quantidade, preco_unit_centavos}]
  _forma_pagamento forma_pagamento,
  _troco_para_centavos INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  item JSONB;
  _produto_id UUID;
  _qtd INT;
  _afetadas INT;
  _nome_faltante TEXT;
  _total INT := 0;
  _mesa_numero INT;
  _pedido_id UUID;
BEGIN
  -- Pega número da mesa
  SELECT numero INTO _mesa_numero FROM public.mesas WHERE id = _mesa_id AND ativa = true;
  IF _mesa_numero IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'mesa_invalida');
  END IF;

  -- Itera itens, decrementa estoque atomicamente
  FOR item IN SELECT * FROM jsonb_array_elements(_itens) LOOP
    _produto_id := (item->>'produto_id')::UUID;
    _qtd := (item->>'quantidade')::INT;

    UPDATE public.produtos
       SET estoque = estoque - _qtd
     WHERE id = _produto_id AND estoque >= _qtd AND ativo = true;

    GET DIAGNOSTICS _afetadas = ROW_COUNT;
    IF _afetadas = 0 THEN
      SELECT nome INTO _nome_faltante FROM public.produtos WHERE id = _produto_id;
      RAISE EXCEPTION 'estoque_insuficiente:%', COALESCE(_nome_faltante, 'produto');
    END IF;

    _total := _total + (_qtd * (item->>'preco_unit_centavos')::INT);
  END LOOP;

  INSERT INTO public.pedidos (mesa_id, mesa_numero, itens, valor_total_centavos, forma_pagamento, troco_para_centavos)
  VALUES (_mesa_id, _mesa_numero, _itens, _total, _forma_pagamento, _troco_para_centavos)
  RETURNING id INTO _pedido_id;

  RETURN jsonb_build_object('ok', true, 'pedido_id', _pedido_id, 'total', _total);
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'estoque_insuficiente:%' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'estoque_insuficiente', 'produto', split_part(SQLERRM, ':', 2));
  END IF;
  RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_pedido_atomico(UUID, JSONB, forma_pagamento, INT) TO anon, authenticated;

-- =========== REALTIME ===========
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;
ALTER TABLE public.pedidos REPLICA IDENTITY FULL;
