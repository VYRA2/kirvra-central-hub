# Plan - Update UI Text in Login Page

Update the text displayed when the backend is not available to match the user's literal request.

## User Review Required

> [!IMPORTANT]
> The new text is a question about configuration, but per instructions, it will be rendered verbatim in the application UI.

- None

## Proposed Changes

### Login Page
#### [src/routes/login.tsx](src/routes/login.tsx)
- Update the `message` prop of the `PendingIntegrationNotice` component.

## Technical Details

- Verbatim replacement of the `PendingIntegrationNotice` message.
- The text will be: `"Onde exatamente eu configuro as variáveis de ambiente VITE_VYRA_SUPABASE_URL e VITE_VYRA_SUPABASE_PUBLISHABLE_KEY neste projeto? Preciso do caminho exato nas configurações, não pelo chat"`
