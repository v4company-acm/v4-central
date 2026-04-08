import { NextApiRequest, NextApiResponse } from 'next'
import { kv } from '@vercel/kv'
import bcrypt from 'bcryptjs'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { secret } = req.body
  if (secret !== process.env.NEXTAUTH_SECRET) {
    return res.status(403).json({ error: 'Não autorizado' })
  }

  const existing = await kv.get('users')
  if (existing) return res.status(200).json({ message: 'Já populado', skip: true })

  const hashed = await bcrypt.hash('password', 10)
  const users = [{ id: '1', name: 'Admin V4', email: 'admin@v4.com', password: hashed, role: 'admin' }]
  await kv.set('users', users)

  const clients = [{
    id: 'midas-odontomed-001',
    nome: 'Midas Odontomed',
    stakeholder: 'Claudio',
    telefone: '35 9887-5930',
    mrr: '3565.12',
    valorTotal: '46985.80',
    fidelidade: '12 meses',
    dataEntrada: '2026-03-09',
    inicioProj: '2026-03-30',
    fimContrato: '2027-03-09',
    status: 'ativo',
    gestor: 'Vitor',
    account: 'Laura',
    estrategista: '',
    closer: 'CSC',
    sdr: 'Marina',
    linkContrato: 'https://drive.google.com/file/d/1MzN33iA3n6TbDI3y4CTk0Di9cz9L8w3R/view?usp=drive_link',
    linkCall: 'https://drive.google.com/file/d/15ueMZmU6TN6SkQ9IpWJvn6Q757fTSkHO/view?usp=sharing',
    linkTranscricao: 'https://docs.google.com/document/d/1GrvlBPjZSaRAvfPHRagpP4mTcgfJMXScVlGiSsoclvw/edit?usp=sharing',
    linkV4: 'https://v4marketing.mktlab.app/?invite=586968f6-6040-46aa-ad08-395ebacbe24a',
    linkBant: 'https://docs.google.com/document/d/1DVG5oAkGKSxQznTeVQm1TxOc0jWY68f3f1TJm3bVJOk/edit?usp=sharing',
    canalOrigem: 'Facebook',
    instagram: 'https://www.instagram.com/midasodontomed/',
    site: '',
    cohort: 'Varejo',
    promessa: '',
    descricao: 'ONE TIME:\nImplementação CRM - Kommo\nImplementação de Landing Page\n\nEXECUTAR:\nProfissional de Designer Gráfico\nProfissional de Gestão de Mídia Paga',
    catSaber: false, catTer: false, catExecutar: true,
    canais: 'Meta Ads',
    otimizacoes: [], reunioes: [], anotacoes: [], arquivos: [], metricas: {}
  }]
  await kv.set('clients', clients)

  return res.status(200).json({ message: 'Banco populado com sucesso!' })
}
