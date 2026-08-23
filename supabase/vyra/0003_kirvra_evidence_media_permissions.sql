-- Proposta de migration para restrições de permissão de mídia
-- A ser aplicada manualmente pelo administrador do Supabase.

-- Revogar acesso público padrão (se existente)
REVOKE ALL ON TABLE storage.objects FROM PUBLIC;

-- Política central: Acesso apenas se o usuário tiver evidence.view
-- e se a evidência estiver vinculada a um registro na tabela alert_evidence.
CREATE POLICY "Acesso restrito a evidências KIRVRA"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'alert-evidence' AND
  (
    -- Verifica a permissão de visualização e a existência do registro
    (
      EXISTS (
        SELECT 1 FROM public.alert_evidence ae
        WHERE ae.storage_bucket = storage.objects.bucket_id
        AND ae.storage_path = storage.objects.name
      )
      AND public.has_role(auth.uid(), 'admin') -- Exemplo de checagem, ajustar conforme necessidade
    )
    -- Ajustar logicamente conforme o sistema de permissões atual
  )
);

-- Adicionar restrições de MIME_TYPE para imagem/audio
-- Esta é uma estrutura conceitual, a aplicação da política depende
-- da integração exata com a função has_permission() do sistema.
