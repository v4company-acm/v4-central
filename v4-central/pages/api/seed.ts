import { kv } from '@vercel/kv'
import bcrypt from 'bcryptjs'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const existing = await kv.get('users')
  if (existing) {
    return res.status(200).send(`<html><body style="font-family:sans-serif;padding:40px;max-width:500px;margin:auto">
      <h2 style="color:#27500A">✓ Banco já configurado!</h2>
      <p>O banco de dados já foi populado anteriormente.</p>
      <a href="/login" style="display:inline-block;margin-top:16px;background:#D72B2B;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">Ir para o login →</a>
    </body></html>`)
  }

  if (req.method === 'POST') {
    const hashed = await bcrypt.hash('password', 10)
    await kv.set('users', [{ id: '1', name: 'Admin V4', email: 'admin@v4.com', password: hashed, role: 'admin' }])
    await kv.set('clients', [{
      id: 'midas-odontomed-001', nome: 'Midas Odontomed', stakeholder: 'Claudio',
      telefone: '35 9887-5930', mrr: '3565.12', valorTotal: '46985.80',
      fidelidade: '12 meses', dataEntrada: '2026-03-09', inicioProj: '2026-03-30',
      fimContrato: '2027-03-09', status: 'ativo', gestor: 'Vitor', account: 'Laura',
      estrategista: '', closer: 'CSC', sdr: 'Marina',
      linkContrato: 'https://drive.google.com/file/d/1MzN33iA3n6TbDI3y4CTk0Di9cz9L8w3R/view?usp=drive_link',
      linkCall: 'https://drive.google.com/file/d/15ueMZmU6TN6SkQ9IpWJvn6Q757fTSkHO/view?usp=sharing',
      linkTranscricao: 'https://docs.google.com/document/d/1GrvlBPjZSaRAvfPHRagpP4mTcgfJMXScVlGiSsoclvw/edit?usp=sharing',
      linkV4: 'https://v4marketing.mktlab.app/?invite=586968f6-6040-46aa-ad08-395ebacbe24a',
      linkBant: 'https://docs.google.com/document/d/1DVG5oAkGKSxQznTeVQm1TxOc0jWY68f3f1TJm3bVJOk/edit?usp=sharing',
      canalOrigem: 'Facebook', instagram: 'https://www.instagram.com/midasodontomed/',
      site: '', cohort: 'Varejo', promessa: '',
      descricao: 'ONE TIME:\nImplementação CRM - Kommo\nImplementação de Landing Page\n\nEXECUTAR:\nProfissional de Designer Gráfico\nProfissional de Gestão de Mídia Paga',
      catSaber: false, catTer: false, catExecutar: true, canais: 'Meta Ads',
      otimizacoes: [], reunioes: [], anotacoes: [], arquivos: [], criativos: [], metricas: {}, metricasHistorico: []
    }])
    return res.status(200).send(`<html><body style="font-family:sans-serif;padding:40px;max-width:500px;margin:auto">
      <h2 style="color:#27500A">✓ Banco configurado com sucesso!</h2>
      <p>Usuário admin e cliente Midas Odontomed criados.</p>
      <p style="margin-top:12px"><strong>Login:</strong> admin@v4.com<br/><strong>Senha:</strong> password</p>
      <a href="/login" style="display:inline-block;margin-top:16px;background:#D72B2B;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">Ir para o login →</a>
    </body></html>`)
  }

  return res.status(200).send(`<html><body style="font-family:sans-serif;padding:40px;max-width:500px;margin:auto">
    <h2>Configuração inicial</h2>
    <p style="color:#6B6B6B;margin-bottom:24px">Clique no botão para popular o banco de dados com o admin e a Midas Odontomed.</p>
    <form method="POST">
      <button type="submit" style="background:#D72B2B;color:#fff;padding:12px 28px;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer">
        Configurar banco de dados
      </button>
    </form>
  </body></html>`)
}
