# Backend (API + Frontend)

## Requisitos
- Node.js 18+

## Como rodar
```bash
npm start
```

Servidor: `http://localhost:3000`

## Login padrão
- Usuário: `admin`
- Senha: `admin`

## Sessão
- Duração: `6 horas`
- Após expirar, é necessário fazer login novamente.

## Endpoints
### Autenticação
- `POST /api/auth/login` body: `{ "username": "...", "password": "..." }`
- `GET /api/auth/session` (Bearer token)
- `POST /api/auth/logout` (Bearer token)

### Tarefas (requer login)
- `GET /api/tarefas`
- `PUT /api/tarefas`

### Usuários (somente admin)
- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`

### Usuários para atribuição (qualquer usuário logado)
- `GET /api/users/options`

## Persistência
- Tarefas: `data/tarefas.json`
- Usuários: `data/users.json`

## Observações
- Abra pelo servidor (`http://localhost:3000`) para login e sessão.
- O frontend sincroniza tarefas automaticamente sem recarregar a página.
