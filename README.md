# Landing Page — Dom Barbearia Itajaí

Copy e design derivados de `outputs/ee-s2-posicionamento.json`, `outputs/ee-s3-manual-marca.json` e `outputs/ee-s3-landing-page.json`. Editar texto em `src/data/content.js`.

## ⚠️ Antes de rodar mídia paga

O WhatsApp usado no CTA (`src/data/content.js` → `WHATSAPP_LINK`) é **47 3046-3681**, informado pelo cliente em 28/07/2026. Esse número tem formato de **telefone fixo** (8 dígitos, sem 9º dígito, salvo como "Casa"). Confirme que o WhatsApp Business está de fato criado e verificado nesse número (linha fixa exige verificação por ligação de voz) — sem isso, o botão principal da página não funciona. Ver `honesty_alert` em `ee-s3-landing-page.json` para o histórico completo.

## Rodar localmente

```bash
npm install
npm run dev
```

## Deploy (Vercel)

```bash
npm install -g vercel   # se ainda não tiver o CLI
vercel --yes --prod
```

## Checklist pós-deploy

- [ ] Abriu corretamente no desktop e no mobile?
- [ ] PageSpeed Insights > 90?
- [ ] Botão do WhatsApp abre conversa de verdade (testar num celular)?
- [ ] Meta tags (título, descrição, OG) corretas ao compartilhar o link?
