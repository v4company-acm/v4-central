# V4 Central de Clientes

App web completo para gerenciar a carteira de clientes da unidade V4.

---

## 🚀 Deploy na Vercel (passo a passo)

### 1. Crie uma conta na Vercel
Acesse [vercel.com](https://vercel.com) e crie uma conta gratuita (pode entrar com o GitHub).

### 2. Suba o projeto no GitHub
1. Acesse [github.com](https://github.com) e crie um repositório novo (pode ser privado)
2. Extraia o ZIP deste projeto no seu computador
3. Abra o terminal na pasta do projeto e rode:
```bash
git init
git add .
git commit -m "primeiro commit"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
git push -u origin main
```

### 3. Importe no Vercel
1. No painel da Vercel, clique em **"Add New Project"**
2. Selecione o repositório que você criou
3. Em **"Framework Preset"**, selecione **Next.js**
4. Clique em **"Environment Variables"** e adicione:

| Nome | Valor |
|------|-------|
| `NEXTAUTH_SECRET` | Uma string aleatória longa (ex: `minha-chave-super-secreta-v4-2026`) |
| `NEXTAUTH_URL` | A URL do seu app (ex: `https://v4-central.vercel.app`) — preencha depois do primeiro deploy |

5. Clique em **"Deploy"**

### 4. Após o primeiro deploy
1. Copie a URL gerada pela Vercel (ex: `https://v4-central-xyz.vercel.app`)
2. Volte em **Settings → Environment Variables**
3. Atualize `NEXTAUTH_URL` com essa URL
4. Clique em **"Redeploy"**

---

## 🔑 Primeiro acesso

Login padrão criado automaticamente:
- **Email:** `admin@v4.com`
- **Senha:** `password`

> ⚠️ **Troque a senha imediatamente!** Vá em Usuários → crie seu usuário com senha forte → delete o admin padrão.

---

## 👥 Adicionar o time

1. Faça login como admin
2. Acesse **Usuários** no menu lateral
3. Clique em **+ Novo usuário**
4. Preencha nome, email e senha para cada pessoa do time
5. Envie o link do app + credenciais para cada um

---

## 📁 Estrutura do projeto

```
v4-central/
├── pages/
│   ├── index.tsx          # Página principal (lista de clientes)
│   ├── login.tsx          # Página de login
│   ├── usuarios.tsx       # Gerenciamento de usuários (admin)
│   └── api/
│       ├── auth/[...nextauth].ts  # Autenticação
│       ├── clients.ts             # API: listar e criar clientes
│       ├── clients/[id].ts        # API: editar e excluir cliente
│       └── users.ts               # API: gerenciar usuários
├── components/
│   ├── Layout.tsx         # Layout com sidebar
│   ├── ClientForm.tsx     # Formulário de cadastro
│   └── ClientDetail.tsx   # Detalhe do cliente (abas)
├── lib/
│   └── db.ts              # Leitura/escrita de JSON
├── data/
│   ├── clients.json       # Base de clientes (já tem Midas Odontomed)
│   └── users.json         # Usuários do sistema
└── styles/
    └── globals.css        # Estilos globais
```

---

## ⚠️ Importante sobre o banco de dados

Este app usa arquivos JSON como banco de dados, o que funciona perfeitamente para começar. Porém, na Vercel os arquivos são **read-only em produção** — isso significa que alterações feitas no app não persistem entre deploys.

**Solução recomendada para uso real (gratuita):**
Migrar para [Vercel KV](https://vercel.com/docs/storage/vercel-kv) ou [PlanetScale](https://planetscale.com) (MySQL gratuito).

**Solução mais simples agora:**
Hospedar no [Railway](https://railway.app) ou [Render](https://render.com) em vez da Vercel — esses serviços permitem escrita em disco, então o JSON funciona direto.

> 📌 **Recomendação:** Se quiser usar a Vercel, avise que eu adapto o projeto para usar Vercel KV (gratuito, sem configuração extra).

---

## 🔄 Para atualizar o app

Qualquer mudança que você fizer nos arquivos e der `git push`, a Vercel faz o redeploy automaticamente.

---

## 🛠 Rodar localmente (opcional)

```bash
npm install
# Crie um arquivo .env.local com:
# NEXTAUTH_SECRET=qualquer-string-longa
# NEXTAUTH_URL=http://localhost:3000
npm run dev
```
Acesse [http://localhost:3000](http://localhost:3000)
